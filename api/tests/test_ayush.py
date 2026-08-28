"""Tests for always-on Dashavidha AYUSH alongside SOCRATES."""

import unittest

from app.crews.close_crew import compose_hpi_en
from app.crews.turn_crew import InterpreterOutput
from app.flows.intake_flow import IntakeFlow
from app.schemas.intake import SessionState
from app.schemas.socrates import SocratesSlots
from app.services.ayush_analysis import build_ayush_block, provisional_ayush_notes
from app.services.intake_pathways import DASHAVIDHA_ORDER, PROBE_QUESTIONS, probe_order_for_subtype
from app.services.slot_fill import progress_map


class AyushDashavidhaTests(unittest.TestCase):
    def test_non_urgent_orders_include_dashavidha_before_priors(self):
        for subtype in ("headache", "pain", "general", "abdominal_pain"):
            order = probe_order_for_subtype(subtype, site="lower back")
            for dim in DASHAVIDHA_ORDER:
                self.assertIn(dim, order)
            self.assertLess(order.index("ayush_vaya"), order.index("prior_medications"))
            self.assertEqual(order[-2:], ["prior_medications", "prior_consult"])

    def test_limb_trauma_session_ayush_is_moderate_subset(self):
        from app.services.intake_pathways import relevant_ayush_dimensions

        session = SessionState(
            chief_complaint="fell from stairs left leg pain",
            metadata={"trauma_context": True},
        )
        ayush = relevant_ayush_dimensions(session, "limb_pain")
        self.assertNotIn("ayush_agni", ayush)
        self.assertNotIn("ayush_prakriti", ayush)
        self.assertIn("ayush_vaya", ayush)

    def test_urgent_trauma_excludes_dashavidha(self):
        order = probe_order_for_subtype("urgent_trauma")
        for dim in DASHAVIDHA_ORDER:
            self.assertNotIn(dim, order)

    def test_progress_includes_ayush_dims(self):
        session = SessionState(
            metadata={"complaint_subtype": "headache"},
            slots=SocratesSlots(site="head", onset="today", severity=5),
            ayush_vaya="35 years",
        )
        prog = progress_map(session, "headache")
        self.assertIn("ayush_vaya", prog)
        self.assertTrue(prog["ayush_vaya"])
        self.assertIn("ayush_prakriti", prog)
        self.assertFalse(prog["ayush_prakriti"])

    def test_probe_questions_exist(self):
        for dim in DASHAVIDHA_ORDER:
            self.assertIn(dim, PROBE_QUESTIONS)
            self.assertTrue(PROBE_QUESTIONS[dim])

    def test_fill_ayush_last_asked_only(self):
        flow = IntakeFlow()
        session = SessionState(
            last_asked_dimension="ayush_agni",
            metadata={"complaint_subtype": "headache", "pathway": "pain"},
            slots=SocratesSlots(site="head", onset="today", character="ache", severity=5),
        )
        interpreter = InterpreterOutput(
            ayush_agni="kam bhookh",
            ayush_prakriti="should not fill",
            ayush_vaya="None",
        )
        flow._apply_interpreter(session, interpreter, "kam bhookh, der se hazam")
        self.assertEqual(session.ayush_agni, "kam bhookh")
        self.assertIsNone(session.ayush_prakriti)
        self.assertIsNone(session.ayush_vaya)

    def test_false_none_ayush_uses_patient_text(self):
        flow = IntakeFlow()
        session = SessionState(
            last_asked_dimension="ayush_vaya",
            metadata={"complaint_subtype": "headache"},
            slots=SocratesSlots(site="head", onset="today", severity=5),
        )
        interpreter = InterpreterOutput(ayush_vaya="None")
        flow._apply_interpreter(session, interpreter, "35 saal")
        self.assertEqual(session.ayush_vaya, "35 saal")

    def test_mapper_expands_six_probes_without_inventing_dosha(self):
        session = SessionState(
            chief_complaint="headache",
            slots=SocratesSlots(
                site="poora sir",
                character="pressure",
                associations="halka bukhar",
            ),
            ayush_vaya="40 years",
            ayush_prakriti="madhyam body, thanda",
            ayush_vikriti="zyada thakaan",
            ayush_agni="kam bhookh",
            ayush_bala="patla, firm muscles, 5.6 ft 60kg",
            ayush_manas_vyayam="stress zyada, climate change se dikkat, walk kam",
        )
        block = build_ayush_block(session)
        self.assertEqual(block.vaya, "40 years")
        self.assertEqual(block.prakriti, "madhyam body, thanda")
        self.assertIsNotNone(block.vikriti)
        self.assertIn("zyada thakaan", block.vikriti or "")
        self.assertEqual(block.ahara_shakti, "kam bhookh")
        self.assertIsNotNone(block.sara)
        self.assertIsNotNone(block.sattva)
        self.assertIsNotNone(block.provisional_notes)
        self.assertIn("draft", block.provisional_notes.lower())
        # Must not invent a definitive dosha label without framing as hypothesis
        self.assertNotRegex(
            block.provisional_notes or "",
            r"(?i)^patient is (vata|pitta|kapha)\b",
        )

    def test_provisional_notes_insufficient_without_cues(self):
        from app.schemas.intake import AyushBlock

        notes = provisional_ayush_notes(AyushBlock())
        self.assertIn("Insufficient", notes)

    def test_draft_includes_dashavidha_section(self):
        session = SessionState(
            slots=SocratesSlots(
                site="poora sir",
                onset="dheere dheere",
                character="kuch khash nhi only headache",
                severity=6,
            ),
            ayush_vaya="32",
            ayush_prakriti="patla, thanda",
            ayush_agni="kam bhookh",
        )
        session.ayush = build_ayush_block(session)
        en = compose_hpi_en(session)
        self.assertIn("Dashavidha", en)
        self.assertIn("Vaya", en)
        self.assertIn("32", en)
        self.assertIn("whole head", en.lower())

    def test_draft_omits_unasked_ayush(self):
        session = SessionState(
            slots=SocratesSlots(site="lower back", onset="3 days", character="mild"),
        )
        session.ayush = build_ayush_block(session)
        en = compose_hpi_en(session)
        self.assertNotIn("Dashavidha", en)

    def test_flow_asks_ayush_after_clinical_core(self):
        from types import SimpleNamespace

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
