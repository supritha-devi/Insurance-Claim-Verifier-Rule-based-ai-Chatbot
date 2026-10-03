from __future__ import annotations

import csv
import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from chat import choose_response, format_colored, match_intent, title_bar, THEME
from rules import ClaimAssessment, evaluate_claim, parse_date, parse_time


QUESTION_SETS = {
    "accident": [
        ("accident_date", "Claimant's accident date (DD-MM-YYYY)?", "date"),
        ("accident_time", "Claimant's accident time (e.g. 10:00 PM)?", "time"),
        ("location", "Claimant's accident location (e.g. Gandhipuram, Coimbatore)?", "text"),
        ("driver", "Who was driving?", "text"),
        ("damaged_part", "Damaged part (e.g. front bumper)?", "text"),
        ("before_place", "Where was the claimant before the accident?", "text"),
        ("before_time", "Until what time was the claimant there?", "text"),
        ("fir_date", "FIR date or 'none'?", "date_or_none"),
        ("policy_start_date", "Policy start date (DD-MM-YYYY)?", "date"),
        ("licence_valid", "Is the licence valid? (yes/no)", "yes_no"),
        ("repaired_part", "Garage repaired part or 'skip'?", "text_or_skip"),
        ("photo_path", "Photo path or 'skip' if no photo?", "path_or_skip"),
    ],
    "theft": [
        ("theft_date", "Theft date (DD-MM-YYYY)?", "date"),
        ("theft_time", "Theft time (e.g. 10:00 PM)?", "time"),
        ("location", "Theft location?", "text"),
        ("report_date", "Theft report date or 'none'?", "date_or_none"),
        ("policy_start_date", "Policy start date (DD-MM-YYYY)?", "date"),
        ("licence_valid", "Is the licence/RC valid? (yes/no)", "yes_no"),
        ("keys_available", "Were keys available? (yes/no)", "yes_no"),
        ("photo_path", "Photo or document path or 'skip'?", "path_or_skip"),
    ],
    "injury": [
        ("accident_date", "Accident date (DD-MM-YYYY)?", "date"),
        ("hospital_admission_date", "Hospital admission date (DD-MM-YYYY)?", "date"),
        ("claimant_injury", "Injury reported by claimant (body part + type)?", "text"),
        ("hospital_report_injury", "Injury shown in the hospital report?", "text"),
        ("days_stayed", "Days stayed in hospital?", "number"),
        ("claim_amount", "Claim amount (Rs)?", "number"),
        ("policy_start_date", "Policy start date (DD-MM-YYYY)?", "date"),
        ("hospital_bill_attached", "Is the hospital bill attached? (yes/no)", "yes_no"),
    ],
}


@dataclass
class ClaimSession:
    claim_type: Optional[str] = None
    awaiting_claim_type: bool = False
    answers: Dict[str, Any] = field(default_factory=dict)
    question_index: int = 0
    last_assessment: Optional[ClaimAssessment] = None
    last_proof: List[str] = field(default_factory=list)
    current_question: Optional[str] = None


class InsuranceClaimChatbot:
    def __init__(self) -> None:
        self.session = ClaimSession()

    def start(self) -> None:
        print(format_colored(title_bar("Insurance Claim Verifier"), THEME["header"]))
        print(format_colored("Claim pre-screening assistant for insurance officers.", THEME["text"]))
        print(format_colored("You can say 'new claim', 'upload', 'help' or 'bye'.", THEME["accent"]))
        print()
        while True:
            try:
                user_text = input("Officer> ")
            except KeyboardInterrupt:
                print("\nSession ended.")
                break
            if not user_text.strip():
                continue
            intent = match_intent(user_text)
            if intent == "farewell":
                print(format_colored(choose_response("farewell"), THEME["bot"]))
                break
            if self.session.awaiting_claim_type:
                normalized = user_text.strip().lower()
                selected_type = next((kind for kind in QUESTION_SETS if re.search(rf"\b{kind}\b", normalized)), None)
                if selected_type:
                    self._begin_claim(selected_type)
                    continue
                if intent in {"greeting", "thanks", "smalltalk", "help"}:
                    print(format_colored(choose_response(intent), THEME["bot"]))
                else:
                    print("Please choose accident, theft or injury.")
                print("Which claim type would you like to review?")
                continue

            if self.session.claim_type:
                if intent in {"greeting", "thanks", "smalltalk"}:
                    print(format_colored(choose_response(intent), THEME["bot"]))
                    self._repeat_current_question()
                elif intent == "help":
                    print(format_colored(
                        f"You're reviewing a {self.session.claim_type} claim. Enter the requested claimant or evidence detail; say 'cancel' to stop.",
                        THEME["bot"],
                    ))
                    self._repeat_current_question()
                elif intent in {"restart", "start_claim"}:
                    self._reset_session(clear_last=False)
                    if intent == "start_claim":
                        self._start_claim_flow(user_text)
                    else:
                        print("Claim cancelled. Say 'new claim' to start again.")
                elif intent == "load_file":
                    self._reset_session(clear_last=False)
                    self._load_claim_file()
                elif intent == "status":
                    self._show_status()
                    self._repeat_current_question()
                elif intent == "unknown":
                    self._answer_current_question(user_text)
                continue

            if intent in {"greeting", "thanks", "help", "smalltalk"}:
                print(format_colored(choose_response(intent), THEME["bot"]))
            elif intent == "start_claim":
                self._start_claim_flow(user_text)
            elif intent == "load_file":
                self._load_claim_file()
            elif intent == "restart":
                self._reset_session()
                print("Starting over. Say 'new claim' to choose a claim type.")
            elif intent == "status":
                self._show_status()
            else:
                print(format_colored("I didn't understand that. You can say 'new claim', 'help' or 'bye'.", THEME["bot"]))

    def _start_claim_flow(self, text: str) -> None:
        text_value = text.lower()
        claim_type = None
        if "accident" in text_value:
            claim_type = "accident"
        elif "theft" in text_value:
            claim_type = "theft"
        elif "injury" in text_value:
            claim_type = "injury"
        if not claim_type:
            self.session.awaiting_claim_type = True
            print("Which claim type would you like to review? accident, theft or injury?")
            return
        self._begin_claim(claim_type)

    def _begin_claim(self, claim_type: str) -> None:
        self.session.claim_type = claim_type
        self.session.awaiting_claim_type = False
        self.session.answers = {}
        self.session.question_index = 0
        self.session.current_question = None
        print(f"Okay, {claim_type} claim.")
        self._ask_next_question()

    def _repeat_current_question(self) -> None:
        if self.session.claim_type:
            self._ask_next_question()

    def _ask_next_question(self) -> None:
        if not self.session.claim_type:
            return
        question_set = QUESTION_SETS[self.session.claim_type]
        if self.session.question_index >= len(question_set):
            self._finish_claim()
            return
        field_name, prompt, kind = question_set[self.session.question_index]
        self.session.current_question = field_name
        print(format_colored(prompt, THEME["bot"]))

    def _answer_current_question(self, user_text: str) -> None:
        if not self.session.claim_type:
            return
        question_set = QUESTION_SETS[self.session.claim_type]
        if self.session.question_index >= len(question_set):
            self._finish_claim()
            return
        field_name, prompt, kind = question_set[self.session.question_index]
        normalized = user_text.strip()

        if normalized.lower() in {"help", "cancel", "bye", "restart", "quit", "exit"}:
            if normalized.lower() == "help":
                print(format_colored("You are in the claim flow. Use 'cancel' to restart, or 'bye' to leave the assistant.", THEME["bot"]))
            elif normalized.lower() in {"cancel", "restart"}:
                self._reset_session()
                print("Claim flow restarted. Say 'new claim' to begin again.")
            elif normalized.lower() in {"bye", "quit", "exit"}:
                print(format_colored(choose_response("farewell"), THEME["bot"]))
            return

        value = self._validate_and_store(field_name, normalized, kind)
        if value is None:
            self._show_validation_hint(kind)
            self._repeat_current_question()
            return
        self.session.answers[field_name] = value
        self.session.question_index += 1
        self._ask_next_question()

    def _validate_and_store(self, field_name: str, value: str, kind: str):
        value = value.strip()
        if kind == "date":
            if re.fullmatch(r"\d{2}-\d{2}-\d{4}", value) and parse_date(value):
                return value
            return None
        if kind == "time":
            if parse_time(value):
                return value
            return None
        if kind == "yes_no":
            normalized = value.lower()
            if normalized in {"yes", "y", "no", "n"}:
                return "yes" if normalized in {"yes", "y"} else "no"
            return None
        if kind == "date_or_none":
            if value.lower() == "none":
                return "none"
            if re.fullmatch(r"\d{2}-\d{2}-\d{4}", value) and parse_date(value):
                return value
            return None
        if kind == "number":
            if re.fullmatch(r"\d+", value):
                return int(value)
            return None
        if kind == "text_or_skip":
            if value.lower() == "skip":
                return "skip"
            return value
        if kind == "path_or_skip":
            if value.lower() == "skip":
                return "skip"
            return value
        return value

    def _show_validation_hint(self, kind: str) -> None:
        if kind == "date":
            print("Please enter the date in DD-MM-YYYY format, for example 15-02-2024.")
        elif kind == "time":
            print("Please use a time like 10:00 PM or 22:00.")
        elif kind == "yes_no":
            print("Please answer yes or no.")
        elif kind == "number":
            print("Please enter a whole number, for example 12000.")

    def _finish_claim(self) -> None:
        if not self.session.claim_type:
            return
        assessment = evaluate_claim({**self.session.answers, "claim_type": self.session.claim_type})
        self.session.last_assessment = assessment
        self.session.last_proof = assessment.proof
        print(format_colored(title_bar("Claim Decision"), THEME["header"]))
        print(f"Claim type: {self.session.claim_type}")
        print(f"Decision: {assessment.decision}")
        if assessment.flags:
            print("Flags: " + ", ".join(assessment.flags))
        if assessment.contradictions:
            print("Contradictions:")
            for item in assessment.contradictions:
                print(f" - {item}")
        if assessment.missing_documents:
            print("Missing evidence: " + ", ".join(assessment.missing_documents))

        print("\nProof steps:")
        for step in assessment.proof:
            print(f" - {step}")

        print("\nFired rules:")
        if not assessment.fired_rules:
            print(" - No rules fired.")
        else:
            for rule in assessment.fired_rules:
                print(f" - {rule.rule_id}: {rule.message}")
                if rule.evidence:
                    print("   Evidence: " + ", ".join(rule.evidence))

        print("\nReasoning: ")
        if assessment.decision == "APPROVE":
            print("The facts are consistent and no policy rule triggered. The claim is ready for approval.")
        elif assessment.decision == "REQUEST DOCUMENTS":
            print("The story is plausible but supporting evidence is missing. Request the listed documents before final decision.")
        else:
            print("The claim has contradictions or multiple policy flags, so it should be investigated by a human officer.")

        self.session.claim_type = None
        self.session.answers.clear()
        self.session.question_index = 0
        self.session.current_question = None
        print("\nYou can start a new claim or ask for help.")

    def _show_status(self) -> None:
        if self.session.last_assessment is None:
            print("No recent claim decision is available yet.")
            return
        assessment = self.session.last_assessment
        print("Last decision:")
        print(f" - Decision: {assessment.decision}")
        if assessment.contradictions:
            print(" - Contradictions: " + "; ".join(assessment.contradictions))
        if assessment.flags:
            print(" - Flags: " + "; ".join(assessment.flags))
        if assessment.missing_documents:
            print(" - Missing evidence: " + "; ".join(assessment.missing_documents))
        print(" - Proof:")
        for item in self.session.last_proof:
            print(f"   - {item}")
        print(" - Rules fired:")
        if assessment.fired_rules:
            for rule in assessment.fired_rules:
                print(f"   - {rule.rule_id}: {rule.message}")
        else:
            print("   - None")
        if assessment.contradictions or len(assessment.flags) >= 2:
            print(" - Explanation: a contradiction or at least two flags requires human investigation.")
        elif assessment.missing_documents:
            print(" - Explanation: supporting evidence is missing, so request the listed documents.")
        else:
            print(" - Explanation: no contradiction, rule flag or required evidence gap was found.")

    def _load_claim_file(self) -> None:
        print("Enter the path to a JSON or CSV claim file, or type 'skip'.")
        path = input("File path> ").strip()
        if path.lower() in {"skip", "cancel"}:
            return
        if not os.path.exists(path):
            print("File not found. Please check the path and try again.")
            return

        try:
            if path.lower().endswith(".json"):
                with open(path, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
            elif path.lower().endswith(".csv"):
                with open(path, newline="", encoding="utf-8") as fh:
                    reader = csv.DictReader(fh)
                    rows = list(reader)
                    data = rows[0] if rows else {}
            else:
                with open(path, "r", encoding="utf-8") as fh:
                    data = {"raw_text": fh.read()}

            print("Loaded claim file successfully.")
            if isinstance(data, dict):
                assessment = evaluate_claim(data)
                self.session.last_assessment = assessment
                self.session.last_proof = assessment.proof
                print(f"Decision: {assessment.decision}")
                for item in assessment.contradictions:
                    print(f"CONTRADICTION: {item}")
                if assessment.flags:
                    print("Flags: " + ", ".join(assessment.flags))
                if assessment.missing_documents:
                    print("Missing evidence / fields: " + ", ".join(assessment.missing_documents))
                print("Proof:")
                for item in assessment.proof:
                    print(f" - {item}")
                print("Rules fired: " + (
                    ", ".join(rule.rule_id for rule in assessment.fired_rules)
                    if assessment.fired_rules else "none"
                ))
            else:
                print("File structure is not a supported claim object.")
        except Exception as exc:
            print(f"Unable to load file: {exc}")

    def _reset_session(self, clear_last: bool = True) -> None:
        self.session.claim_type = None
        self.session.awaiting_claim_type = False
        self.session.answers.clear()
        self.session.question_index = 0
        self.session.current_question = None
        if clear_last:
            self.session.last_assessment = None
            self.session.last_proof = []


if __name__ == "__main__":
    InsuranceClaimChatbot().start()
