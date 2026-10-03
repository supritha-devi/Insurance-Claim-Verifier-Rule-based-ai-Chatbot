from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple


@dataclass
class Fact:
    name: str
    value: str
    source: str

    def __str__(self) -> str:
        return f"{self.name}({self.value}) [{self.source}]"


@dataclass
class RuleResult:
    rule_id: str
    message: str
    evidence: List[str]


@dataclass
class ClaimAssessment:
    decision: str
    contradictions: List[str]
    flags: List[str]
    fired_rules: List[RuleResult]
    missing_documents: List[str]
    proof: List[str]


def parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value or value.lower() == "none":
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(value).strip(), fmt)
        except ValueError:
            continue
    return None


def parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    for fmt in ("%I:%M %p", "%H:%M", "%I%p"):
        try:
            return datetime.strptime(str(value).strip(), fmt)
        except ValueError:
            continue
    return None


def safe_date_diff_days(date_a: Optional[datetime], date_b: Optional[datetime]) -> Optional[int]:
    if date_a is None or date_b is None:
        return None
    return (date_a - date_b).days


def build_fact(name: str, value: str, source: str) -> Fact:
    return Fact(name=name, value=str(value), source=source)


def build_rule_proof(rule_id: str, message: str, evidence: Iterable[str]) -> RuleResult:
    return RuleResult(rule_id=rule_id, message=message, evidence=list(evidence))


def evaluate_claim(data: Dict[str, Any]) -> ClaimAssessment:
    contradictions: List[str] = []
    flags: List[str] = []
    fired_rules: List[RuleResult] = []
    missing_documents: List[str] = []
    proof: List[str] = []
    claim_type = str(data.get("claim_type") or "").strip().lower()
    if claim_type not in {"accident", "theft", "injury"}:
        if data.get("theft_date"):
            claim_type = "theft"
        elif data.get("claimant_injury") or data.get("hospital_admission_date"):
            claim_type = "injury"
        elif data.get("accident_date"):
            claim_type = "accident"
        else:
            claim_type = ""
    incident_date = parse_date(data.get("accident_date") or data.get("theft_date") or data.get("incident_date"))
    incident_time = parse_time(data.get("accident_time") or data.get("theft_time"))
    policy_start = parse_date(data.get("policy_start_date"))
    fir_date = parse_date(data.get("fir_date") or data.get("report_date"))
    hospital_admission = parse_date(data.get("hospital_admission_date"))
    hospital_report = str(data.get("hospital_report_injury") or "").strip()
    claimant_injury = str(data.get("claimant_injury") or "").strip()
    if hospital_report.lower() in {"none", "skip"}:
        hospital_report = ""
    if claimant_injury.lower() in {"none", "skip"}:
        claimant_injury = ""
    damaged_part = str(data.get("damaged_part") or "")
    repaired_part = str(data.get("repaired_part") or "")
    try:
        claim_amount = int(data.get("claim_amount") or 0)
        days_stayed = int(data.get("days_stayed") or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("Claim amount and hospital stay must be whole numbers.") from exc
    licence_valid = data.get("licence_valid")
    if isinstance(licence_valid, str):
        licence_valid = licence_valid.strip().lower() in {"yes", "y", "true"}

    def fire(rule_id: str, message: str, evidence: List[str]) -> None:
        fired_rules.append(build_rule_proof(rule_id, message, evidence))

    def contradict(message: str, proof_step: str) -> None:
        contradictions.append(message)
        proof.append(proof_step)

    def flag(label: str, rule_id: str, message: str, evidence: List[str]) -> None:
        flags.append(label)
        fire(rule_id, message, evidence)

    def date_label(value: Optional[datetime]) -> str:
        return value.strftime("%d-%m-%Y") if value else "unknown"

    def normalized_part(value: str) -> str:
        normalized = value.casefold()
        for direction in ("front", "rear", "left", "right"):
            if direction in normalized:
                return direction
        return re.sub(r"\b(bumper|panel|damage|damaged|the|a|an)\b", "", normalized).strip()

    required_fields = {
        "accident": {
            "accident_date": "Claimant's accident date",
            "accident_time": "Claimant's accident time",
            "location": "Claimant's accident location",
            "damaged_part": "Claimant's damaged part",
            "policy_start_date": "Policy start date",
            "licence_valid": "Licence validity",
        },
        "theft": {
            "theft_date": "Claimant's theft date",
            "theft_time": "Claimant's theft time",
            "location": "Claimant's theft location",
            "policy_start_date": "Policy start date",
            "licence_valid": "Licence/RC validity",
            "keys_available": "Key availability",
        },
        "injury": {
            "accident_date": "Claimant's accident date",
            "hospital_admission_date": "Hospital admission date",
            "claimant_injury": "Claimant-reported injury",
            "hospital_report_injury": "Hospital report injury",
            "days_stayed": "Hospital stay duration",
            "claim_amount": "Claim amount",
            "policy_start_date": "Policy start date",
            "hospital_bill_attached": "Hospital bill status",
        },
    }
    if claim_type:
        for field_name, label in required_fields[claim_type].items():
            value = data.get(field_name)
            date_field = field_name.endswith("_date")
            time_field = field_name.endswith("_time")
            invalid_format = date_field and parse_date(value) is None
            invalid_format = invalid_format or (time_field and parse_time(str(value or "")) is None)
            if value is None or str(value).strip().lower() in {"", "skip"} or invalid_format:
                missing_documents.append(f"Required claim field: {label}")
    else:
        missing_documents.append("Claim type and required claim details")

    proof.append("Facts are evaluated with their entered source; matching facts remain consistent.")
    if incident_date and policy_start and incident_date < policy_start:
        fire("R1", "Incident occurred before the policy start date.", [
            f"IncidentDate({date_label(incident_date)}) [claimant]",
            f"PolicyStart({date_label(policy_start)}) [policy]",
        ])
        contradict(
            "Contradiction: the incident date precedes the policy start date.",
            "Resolution refutation: IncidentDate < PolicyStart conflicts with the policy-validity clause; derive the empty clause.",
        )

    if incident_date and policy_start:
        delta = (incident_date - policy_start).days
        if 0 <= delta < 7 and claim_type != "injury":
            flag("New policy", "R2", f"Policy started {delta} days before the incident (under 7 days).", [
                f"PolicyStart({date_label(policy_start)}) [policy]",
                f"IncidentDate({date_label(incident_date)}) [claimant]",
            ])
            proof.append(f"Forward chaining: R2 fires because the policy began {delta} days before the incident.")

    if incident_date and fir_date and (claim_type in {"accident", "theft"} or data.get("fir_date") or data.get("report_date")):
        delta = (fir_date - incident_date).days
        if delta > 2:
            flag("Late report", "R3", f"Report was filed {delta} days after the incident (over 48 hours).", [
                f"IncidentDate({date_label(incident_date)}) [claimant]",
                f"ReportDate({date_label(fir_date)}) [FIR]",
            ])
            proof.append(f"Forward chaining: R3 fires because the report was filed {delta} days after the incident.")

    if licence_valid is False:
        fire("R4", "Licence or RC validity does not satisfy the policy requirement.", ["LicenceOrRC(Invalid) [officer/evidence]"])
        contradict(
            "Contradiction: the licence or RC is recorded as invalid, conflicting with the policy eligibility requirement.",
            "Resolution refutation: LicenceOrRC(Invalid) conflicts with the required-valid-document clause; derive the empty clause.",
        )

    if damaged_part and repaired_part and normalized_part(damaged_part) != normalized_part(repaired_part):
        fire("R5", "Claimed damage differs from the part repaired on the garage invoice.", [
            f"Damage({damaged_part}) [claimant]",
            f"Repaired({repaired_part}) [garage]",
        ])
        contradict(
            f"Contradiction: the claimant reports {damaged_part} damage, but the garage invoice records {repaired_part} repaired.",
            f"Resolution refutation: Damage({damaged_part}) and Repaired({repaired_part}) are incompatible; derive the empty clause.",
        )
    elif claim_type == "accident" and not repaired_part:
        missing_documents.append("Garage invoice")

    before_place = str(data.get("before_place") or "").strip()
    before_time_text = str(data.get("before_time") or "")
    until_match = re.search(r"\buntil\s+(.+)$", before_time_text, re.IGNORECASE)
    before_time = parse_time(until_match.group(1) if until_match else before_time_text)
    if before_place and incident_time and before_time and before_time.time() >= incident_time.time():
        fire("R6", "The claimant's stated prior location overlaps the reported incident time.", [
            f"At(Claimant,{before_place},until {before_time.strftime('%I:%M %p')}) [claimant]",
            f"IncidentTime({incident_time.strftime('%I:%M %p')}) [claimant]",
        ])
        contradict(
            f"Contradiction: the claimant was reportedly at {before_place} until {before_time.strftime('%I:%M %p')}, but the incident is reported at {incident_time.strftime('%I:%M %p')}.",
            f"Resolution refutation: At(Claimant,{before_place},until {before_time.strftime('%I:%M %p')}) overlaps AccidentTime({incident_time.strftime('%I:%M %p')}); derive the empty clause.",
        )
    elif before_place and incident_time and before_time:
        proof.append(f"The claimant's stated location ({before_place}) ended before the reported incident time; the times are consistent.")

    photo_path = str(data.get("photo_path") or "").strip()
    if photo_path and photo_path.lower() != "skip":
        metadata = extract_exif_metadata(photo_path)
        photo_date = parse_date(metadata.get("DateTimeOriginal") or metadata.get("DateTime"))
        if photo_date is None:
            missing_documents.append("Photo metadata or other dated photo evidence")
        elif incident_date and photo_date.date() < incident_date.date():
            flag("Photo predates incident", "R6", "Photo metadata predates the reported incident.", [
                f"PhotoDate({date_label(photo_date)}) [photo]",
                f"IncidentDate({date_label(incident_date)}) [claimant]",
            ])
        else:
            proof.append(f"Photo date ({date_label(photo_date)}) does not predate the incident.")
    elif claim_type in {"accident", "theft"}:
        missing_documents.append("Photo evidence")

    if claim_type == "theft" and data.get("keys_available") is None:
        missing_documents.append("Key availability information")

    if claimant_injury and hospital_report and claimant_injury.lower() != hospital_report.lower():
        fire("I1", "Claimant-reported injury differs from the hospital report.", [
            f"Injury({claimant_injury}) [claimant]",
            f"HospitalReport({hospital_report}) [hospital]",
        ])
        contradict(
            f"Contradiction: the claimant reports {claimant_injury}, while the hospital report states {hospital_report}.",
            f"Resolution refutation: Injury({claimant_injury}) and HospitalReport({hospital_report}) conflict; derive the empty clause.",
        )
    if incident_date and hospital_admission and hospital_admission < incident_date:
        fire("I2", "Hospital admission date precedes the accident date.", [
            f"AccidentDate({date_label(incident_date)}) [claimant]",
            f"AdmissionDate({date_label(hospital_admission)}) [hospital]",
        ])
        contradict("Contradiction: hospital admission is dated before the accident.", "Resolution refutation: AdmissionDate < AccidentDate conflicts with the injury-claim chronology; derive the empty clause.")
    if incident_date and hospital_admission:
        delta = (hospital_admission - incident_date).days
        if delta > 2:
            flag("Late admission", "I3", f"Hospital admission was {delta} days after the accident (over 48 hours).", [
                f"AccidentDate({date_label(incident_date)}) [claimant]",
                f"AdmissionDate({date_label(hospital_admission)}) [hospital]",
            ])
    if days_stayed >= int(data.get("long_stay_threshold", 15)):
        flag("Long hospital stay", "I4", f"{days_stayed}-day hospital stay exceeds the configured threshold.", [f"HospitalStay({days_stayed} days) [hospital]"])
    if claim_amount > int(data.get("claim_amount_threshold", 500000)):
        flag("Claim amount above threshold", "I5", "Claim amount exceeds the configured threshold.", [f"ClaimAmount(Rs {claim_amount}) [claimant]"])
    if incident_date and policy_start and 0 <= (incident_date - policy_start).days < 7 and claim_type == "injury":
        days_before = (incident_date - policy_start).days
        flag("New policy", "I6", f"Policy started {days_before} days before the accident (under 7 days).", [
            f"PolicyStart({date_label(policy_start)}) [policy]",
            f"AccidentDate({date_label(incident_date)}) [claimant]",
        ])
    if claim_type == "injury" and not hospital_report:
        missing_documents.append("Hospital medical report")
    bill_attached = data.get("hospital_bill_attached")
    if isinstance(bill_attached, str):
        bill_attached = bill_attached.strip().lower() in {"yes", "y", "true"}
    if claim_type == "injury" and bill_attached is False:
        missing_documents.append("Hospital bill")
    if claim_type in {"accident", "theft"} and not fir_date:
        missing_documents.append("FIR or theft report")

    if contradictions or len(flags) >= 2:
        decision = "SEND FOR INVESTIGATION"
    elif missing_documents:
        decision = "REQUEST DOCUMENTS"
    else:
        decision = "APPROVE"

    if decision == "REQUEST DOCUMENTS":
        proof.append("Missing evidence requires supporting documents before an approval recommendation.")

    proof.append(f"Forward chaining result: {decision} ({len(contradictions)} contradiction(s), {len(flags)} flag(s)).")
    return ClaimAssessment(
        decision=decision,
        contradictions=contradictions,
        flags=flags,
        fired_rules=fired_rules,
        missing_documents=list(dict.fromkeys(missing_documents)),
        proof=proof,
    )


def extract_exif_metadata(photo_path: str) -> Dict[str, Any]:
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS

        image = Image.open(photo_path)
        exif_data = image.getexif()
        meta: Dict[str, Any] = {"file": photo_path}
        if not exif_data:
            meta["status"] = "no metadata"
            return meta
        exif_dict = {}
        for tag, value in exif_data.items():
            decoded = TAGS.get(tag, tag)
            exif_dict[decoded] = value
        meta.update(exif_dict)
        meta["status"] = "metadata available"
        return meta
    except Exception:
        return {"file": photo_path, "status": "missing or unreadable"}
