import unittest

from app.services.red_flags import evaluate_red_flags, merge_red_flags
from app.schemas.intake import RedFlagResult


class RedFlagEngineTests(unittest.TestCase):
    def test_chest_pain_bypass(self):
        result = evaluate_red_flags("I have severe chest pain since this morning")
        self.assertTrue(result.is_emergency)
        self.assertEqual(result.triage_action, "bypass_queue")
        self.assertIn("chest_pain_acute", result.matched_rules)
        self.assertIn("acute_chest_pain", result.flags)

    def test_hinglish_breathlessness(self):
        result = evaluate_red_flags("mujhe saans nahi aa rahi")
        self.assertTrue(result.is_emergency)
        self.assertIn("sob_at_rest", result.matched_rules)

    def test_benign_headache_continues(self):
        result = evaluate_red_flags("I have a mild headache for two days")
        self.assertFalse(result.is_emergency)
        self.assertEqual(result.triage_action, "continue")
        self.assertEqual(result.matched_rules, [])

    def test_llm_cannot_clear_rule_emergency(self):
        rules = evaluate_red_flags("crushing chest pain")
        llm = RedFlagResult(
            is_emergency=False,
            flags=[],
            matched_rules=[],
            triage_action="continue",
            reason="looks fine",
            source="llm",
        )
        merged = merge_red_flags(rules, llm)
        self.assertTrue(merged.is_emergency)
        self.assertEqual(merged.triage_action, "bypass_queue")
        self.assertIn("acute_chest_pain", merged.flags)

    def test_llm_cannot_force_bypass_when_rules_continue(self):
        rules = evaluate_red_flags("mild headache")
        llm = RedFlagResult(
            is_emergency=True,
            flags=["possible_meningitis"],
            matched_rules=["llm_assist"],
            triage_action="bypass_queue",
            reason="neck stiffness concern",
            source="llm",
        )
        merged = merge_red_flags(rules, llm)
        self.assertFalse(merged.is_emergency)
        self.assertEqual(merged.triage_action, "continue")
        self.assertIn("possible_meningitis", merged.flags)
        self.assertIn("LLM advisory", merged.reason)


if __name__ == "__main__":
    unittest.main()
