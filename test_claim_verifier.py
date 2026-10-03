import unittest
from io import StringIO
from unittest.mock import patch

from chat import match_intent
from main import InsuranceClaimChatbot
from rules import evaluate_claim


class ClaimEvaluationTests(unittest.TestCase):
    def test_injury_mismatch_and_three_flags_investigates(self):
        result = evaluate_claim({
            "claim_type": "injury",
            "accident_date": "28-09-2026",
            "hospital_admission_date": "01-10-2026",
            "claimant_injury": "head injury",
            "hospital_report_injury": "leg fracture",
            "days_stayed": 15,
            "claim_amount": 250000,
            "policy_start_date": "26-09-2026",
            "hospital_bill_attached": "no",
        })

        self.assertEqual(result.decision, "SEND FOR INVESTIGATION")
        self.assertEqual(len(result.contradictions), 1)
        self.assertEqual(
            {rule.rule_id for rule in result.fired_rules},
            {"I1", "I3", "I4", "I6"},
        )
        self.assertIn("Hospital bill", result.missing_documents)

    def test_clean_injury_claim_approves(self):
        result = evaluate_claim({
            "claim_type": "injury",
            "accident_date": "28-09-2026",
            "hospital_admission_date": "28-09-2026",
            "claimant_injury": "leg fracture",
            "hospital_report_injury": "leg fracture",
            "days_stayed": 3,
            "claim_amount": 40000,
            "policy_start_date": "15-01-2026",
            "hospital_bill_attached": "yes",
        })

        self.assertEqual(result.decision, "APPROVE")
        self.assertFalse(result.contradictions)
        self.assertFalse(result.flags)
        self.assertFalse(result.missing_documents)

    def test_missing_accident_documents_are_requested(self):
        result = evaluate_claim({
            "claim_type": "accident",
            "accident_date": "28-09-2026",
            "accident_time": "10:00 PM",
            "location": "Gandhipuram",
            "before_place": "home",
            "before_time": "9:00 PM",
            "damaged_part": "front bumper",
            "repaired_part": "front bumper",
            "fir_date": "none",
            "policy_start_date": "15-01-2026",
            "licence_valid": "yes",
            "photo_path": "skip",
        })

        self.assertEqual(result.decision, "REQUEST DOCUMENTS")
        self.assertEqual(set(result.missing_documents), {"FIR or theft report", "Photo evidence"})

    def test_empty_or_incomplete_file_cannot_be_approved(self):
        result = evaluate_claim({})

        self.assertEqual(result.decision, "REQUEST DOCUMENTS")
        self.assertIn("Claim type and required claim details", result.missing_documents)

    def test_accident_alibi_and_damage_mismatches_are_contradictions(self):
        result = evaluate_claim({
            "claim_type": "accident",
            "accident_date": "28-09-2026",
            "accident_time": "10:00 PM",
            "location": "Gandhipuram",
            "before_place": "office",
            "before_time": "11:00 PM",
            "damaged_part": "front bumper",
            "repaired_part": "rear bumper",
            "fir_date": "01-10-2026",
            "policy_start_date": "26-09-2026",
            "licence_valid": "yes",
            "photo_path": "skip",
        })

        self.assertEqual(result.decision, "SEND FOR INVESTIGATION")
        self.assertEqual(len(result.contradictions), 2)
        self.assertIn("Late report", result.flags)
        self.assertIn("New policy", result.flags)


class ConversationIntentTests(unittest.TestCase):
    def test_common_and_tolerant_phrases(self):
        cases = {
            "hello??": "greeting",
            "hii": "greeting",
            "helo officer": "greeting",
            "good morning": "greeting",
            "vanakkam": "greeting",
            "I want to check a claim": "start_claim",
            "injury claim please": "start_claim",
            "thnks": "thanks",
            "which rules fired?": "status",
            "load file": "load_file",
            "who made you?": "smalltalk",
        }
        for message, expected in cases.items():
            with self.subTest(message=message):
                self.assertEqual(match_intent(message), expected)

    def test_greeting_during_claim_repeats_pending_question(self):
        bot = InsuranceClaimChatbot()
        output = StringIO()
        replies = iter(["new claim", "accident", "hello??", "bye"])
        with patch("builtins.input", side_effect=lambda _prompt: next(replies)), patch("sys.stdout", output):
            bot.start()

        self.assertEqual(bot.session.current_question, "accident_date")
        self.assertEqual(output.getvalue().count("Claimant's accident date"), 2)
        self.assertTrue(any(greeting in output.getvalue() for greeting in ("Hello", "Good day", "Vanakkam")))


if __name__ == "__main__":
    unittest.main()
