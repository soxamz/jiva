"""Tests for hybrid pathway classification and probe ordering."""

import unittest
from types import SimpleNamespace

from app.flows.intake_flow import (
    ACK_MESSAGE,
    CLOSING_MESSAGE,
    PROBE_QUESTIONS,
    URGENT_CLOSING_MESSAGE,
    IntakeFlow,
)
from app.schemas.intake import SessionState
from app.schemas.socrates import SocratesSlots
from app.services.intake_pathways import (
    classify_pathway,
    probe_order_for_pathway,
    should_ask_radiation,
)
from app.services.slot_fill import (
    apply_session_denial_fill,
    next_pathway_dimension,
    pathway_complete,
)


class PathwayTests(unittest.TestCase):
    def test_classify_bleeding_fall_urgent(self):
        self.assertEqual(
            classify_pathway("i am actually bleeding. Fell from stairs"),
            "urgent_trauma",
        )

    def test_classify_pain(self):
        self.assertEqual(classify_pathway("left hand pain since 2 days"), "pain")

    def test_classify_upgrade_to_urgent(self):
        self.assertEqual(
            classify_pathway("also bleeding now", existing="pain"),
            "urgent_trauma",
        )

    def test_pain_order_includes_followups(self):
        # Trimmed pain core: no time_course/pain_now; AYUSH then priors
        order = probe_order_for_pathway("pain", site="body")
        self.assertNotIn("time_course", order)
        self.assertNotIn("pain_now", order)
        self.assertIn("exacerbating_relieving", order)
        self.assertIn("ayush_vaya", order)
        self.assertIn("prior_medications", order)
        self.assertIn("prior_consult", order)
        self.assertNotIn("radiation", order)
        self.assertLess(order.index("ayush_vaya"), order.index("prior_medications"))

    def test_limb_site_uses_limb_bank(self):
        order = probe_order_for_pathway("pain", site="left hand")
        self.assertIn("mechanism", order)
        self.assertNotIn("radiation", order)
        self.assertNotIn("bleeding_now", order)

    def test_pain_chest_asks_radiation(self):
        self.assertTrue(should_ask_radiation("chest"))
        order = probe_order_for_pathway("pain", site="chest pain left")
        self.assertIn("radiation", order)

    def test_urgent_order_skips_radiation(self):
        order = probe_order_for_pathway("urgent_trauma", site="head")
        self.assertNotIn("radiation", order)
        self.assertNotIn("character", order)
        self.assertEqual(
            order,
            ["site", "bleeding_now", "consciousness", "blood_thinners"],
        )

    def test_pain_next_asks_exacerbating_after_associations(self):
        session = SessionState(
            metadata={"pathway": "pain", "complaint_subtype": "pain"},
            slots=SocratesSlots(
                site="body",
                onset="today",
                character="aching",
                severity=6,
                associations="none",
            ),
        )
        nxt = next_pathway_dimension(session, "pain")
        self.assertEqual(nxt, "exacerbating_relieving")

    def test_urgent_does_not_ask_radiation(self):
        session = SessionState(
            metadata={"pathway": "urgent_trauma"},
            slots=SocratesSlots(site="head"),
        )
        nxt = next_pathway_dimension(session, "urgent_trauma")
        self.assertEqual(nxt, "bleeding_now")
        self.assertNotEqual(nxt, "radiation")

    def test_denial_on_prior_medications(self):
        session = SessionState(last_asked_dimension="prior_medications")
        apply_session_denial_fill(session, "Nhii", "prior_medications")
        self.assertEqual(session.prior_medications, "none")

    def test_urgent_complete_closes_with_bypass_message(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"pathway": "urgent_trauma", "complaint_subtype": "urgent_trauma"},
            slots=SocratesSlots(site="head"),
            bleeding_now="stopped",
            consciousness="none",
            blood_thinners="none",
            turn_count=4,
        )
        self.assertTrue(pathway_complete(session, "urgent_trauma"))
        msg, complete, urgent_bypass = flow._next_assistant_message(
            session, SimpleNamespace(max_intake_turns=10)
        )
        self.assertTrue(complete)
        self.assertTrue(urgent_bypass)
        self.assertEqual(msg, URGENT_CLOSING_MESSAGE)

    def test_pain_complete_sends_closing(self):
        flow = IntakeFlow()
        settings = SimpleNamespace(max_intake_turns=10)
        msg1, c1, b1 = flow._next_assistant_message(
            SessionState(
                complete=False,
                metadata={"pathway": "pain", "complaint_subtype": "pain"},
                slots=SocratesSlots(
                    site="body",
                    onset="2 days",
                    character="dull",
                    severity=5,
                    associations="none",
                    exacerbating_relieving="worse with movement",
                ),
                ayush_vaya="30",
                ayush_prakriti="madhyam",
                ayush_vikriti="same",
                ayush_agni="ok",
                ayush_bala="madhyam",
                ayush_manas_vyayam="ok",
                prior_medications="none",
                prior_consult="none",
            ),
            settings,
        )
        self.assertTrue(c1)
        self.assertFalse(b1)
        self.assertEqual(msg1, CLOSING_MESSAGE)

    def test_flow_picks_ayush_after_pain_core(self):
        flow = IntakeFlow()
        session = SessionState(
            metadata={"pathway": "pain", "complaint_subtype": "pain"},
            slots=SocratesSlots(
                site="body",
                onset="today",
                character="sharp",
                severity=4,
                associations="none",
                exacerbating_relieving="none",
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
