"""Tests for complaint-adaptive banks + AYUSH-first ordering."""

import unittest
from types import SimpleNamespace

from app.flows.intake_flow import IntakeFlow
from app.schemas.intake import SessionState
from app.schemas.socrates import SocratesSlots
from app.services.intake_pathways import (
    DASHAVIDHA_ORDER,
    asserts_non_pain_chief,
    classify_complaint_subtype,
    denies_pain_frame,
    probe_order_for_subtype,
    probe_question_for,
)


class ComplaintAdaptiveTests(unittest.TestCase):
    def test_classify_fever_and_respiratory(self):
        self.assertEqual(classify_complaint_subtype("i have fever"), "fever")
        self.assertEqual(classify_complaint_subtype("mujhe bukhar hai"), "fever")
        self.assertEqual(classify_complaint_subtype("khaansi ho rahi hai"), "respiratory")
        self.assertEqual(classify_complaint_subtype("dry cough"), "respiratory")

    def test_classify_gi_loose_motion(self):
        self.assertEqual(classify_complaint_subtype("i am having loose motion"), "gi")
        self.assertEqual(classify_complaint_subtype("diarrhea since 2 days"), "gi")
        self.assertEqual(classify_complaint_subtype("ulti aur matli"), "gi")

    def test_gi_sticky_against_secondary_body_pain(self):
        subtype = classify_complaint_subtype("i am having loose motion")
        self.assertEqual(subtype, "gi")
        again = classify_complaint_subtype(
            "body pain and kamzori with loose motion",
            existing_subtype="gi",
        )
        self.assertEqual(again, "gi")

    def test_fever_sticky_against_secondary_body_pain(self):
        subtype = classify_complaint_subtype("i have fever")
        self.assertEqual(subtype, "fever")
        again = classify_complaint_subtype(
            "halka body pain with feverish and high body temperature",
            existing_subtype="fever",
        )
        self.assertEqual(again, "fever")

    def test_denies_pain_and_asserts_fever(self):
        self.assertTrue(denies_pain_frame("no dard i have bukhar/fever"))
        self.assertEqual(
            asserts_non_pain_chief("no dard i have bukhar/fever"), "fever"
        )
        self.assertEqual(asserts_non_pain_chief("sirf khaansi hai"), "respiratory")

    def test_fever_order_ayush_before_priors_no_pain_now(self):
        order = probe_order_for_subtype("fever")
        self.assertNotIn("pain_now", order)
        self.assertNotIn("exacerbating_relieving", order)
        self.assertNotIn("character", order)
        self.assertLess(order.index("associations"), order.index("ayush_vaya"))
        self.assertLess(order.index("ayush_manas_vyayam"), order.index("prior_medications"))
        self.assertEqual(order[-2:], ["prior_medications", "prior_consult"])
        for dim in DASHAVIDHA_ORDER:
            self.assertIn(dim, order)

    def test_all_non_urgent_ayush_before_priors(self):
        for subtype in (
            "fever",
            "respiratory",
            "gi",
            "general",
            "headache",
            "limb_pain",
            "abdominal_pain",
            "chest_pain_soft",
            "pain",
        ):
            order = probe_order_for_subtype(subtype, site="lower back")
            self.assertLess(
                order.index("ayush_vaya"),
                order.index("prior_medications"),
                msg=subtype,
            )
            self.assertEqual(order[-2:], ["prior_medications", "prior_consult"], msg=subtype)

    def test_urgent_excludes_ayush(self):
        order = probe_order_for_subtype("urgent_trauma")
        for dim in DASHAVIDHA_ORDER:
            self.assertNotIn(dim, order)

    def test_fever_wording_uses_bukhar_not_dard(self):
        sev = probe_question_for("severity", "fever") or ""
        assoc = probe_question_for("associations", "fever") or ""
        self.assertIn("bukhar", sev.lower())
        self.assertNotIn("dard", sev.lower())
        self.assertIn("thand", assoc.lower())
        onset = probe_question_for("onset", "fever") or ""
        self.assertIn("bukhar", onset.lower())

    def test_respiratory_wording(self):
        onset = probe_question_for("onset", "respiratory") or ""
        self.assertTrue("khaansi" in onset.lower() or "saans" in onset.lower())

    def test_midcourse_reclass_from_pain_to_fever(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "pain", "pathway": "pain"},
            last_asked_dimension="exacerbating_relieving",
            slots=SocratesSlots(
                site="body",
                onset="2 days",
                character="ache",
                severity=9,
                associations="weakness",
            ),
            chief_complaint="i have fever",
        )
        subtype = flow._update_subtype(session, "no dard i have bukhar/fever")
        self.assertEqual(subtype, "fever")
        self.assertEqual(session.metadata["complaint_subtype"], "fever")
        # Pain-only dims not in fever bank should be filled as none
        self.assertEqual(session.slots.exacerbating_relieving, "none")

    def test_flow_fever_next_is_onset_not_site_pain(self):
        flow = IntakeFlow()
        session = SessionState(metadata={"complaint_subtype": "fever"})
        msg, complete, _ = flow._next_assistant_message(
            session, SimpleNamespace(max_intake_turns=40)
        )
        self.assertFalse(complete)
        self.assertEqual(session.last_asked_dimension, "onset")
        self.assertIn("bukhar", msg.lower())

    def test_headache_asks_ayush_after_clinical_core(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"complaint_subtype": "headache"},
            slots=SocratesSlots(
                site="forehead",
                onset="last night",
                character="pressure",
                severity=8,
                associations="mild fever",
                time_course="waves",
                exacerbating_relieving="spontaneous",
            ),
        )
        msg, complete, _ = flow._next_assistant_message(
            session, SimpleNamespace(max_intake_turns=40)
        )
        self.assertFalse(complete)
        self.assertEqual(session.last_asked_dimension, "ayush_vaya")
        self.assertIn("umar", msg.lower())


if __name__ == "__main__":
    unittest.main()
