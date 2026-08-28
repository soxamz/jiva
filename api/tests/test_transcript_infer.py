"""Tests for rule-based transcript inference (no LLM)."""

import unittest

from app.schemas.intake import SessionState, TranscriptTurn
from app.schemas.socrates import SocratesSlots
from app.services.slot_fill import next_subtype_dimension
from app.services.transcript_infer import (
    apply_transcript_inferences,
    mechanism_inferable,
    patient_transcript_blob,
)


class TranscriptInferTests(unittest.TestCase):
    def test_fall_stairs_infers_mechanism_and_site(self):
        session = SessionState(
            chief_complaint="fell from stairs and now left leg pains",
        )
        apply_transcript_inferences(session)
        self.assertEqual(session.mechanism, "fall")
        self.assertIn("left", (session.slots.site or "").lower())
        self.assertIn("leg", (session.slots.site or "").lower())

    def test_mechanism_inferable_skips_mechanism_probe(self):
        session = SessionState(
            chief_complaint="fell from stairs and now left leg pains",
            metadata={"complaint_subtype": "limb_pain", "trauma_context": True},
            slots=SocratesSlots(site="left leg", onset="today"),
        )
        apply_transcript_inferences(session)
        self.assertTrue(mechanism_inferable(session))
        nxt = next_subtype_dimension(session, "limb_pain")
        self.assertNotEqual(nxt, "mechanism")
        self.assertEqual(nxt, "bleeding_now")

    def test_fever_onset_inferred_from_duration(self):
        session = SessionState(chief_complaint="fever 102 for 4 days")
        apply_transcript_inferences(session)
        self.assertEqual(session.slots.onset, "4 days ago")

    def test_shin_site_from_opening(self):
        session = SessionState(
            chief_complaint="pain closer to shin after fall",
            transcript=[
                TranscriptTurn(role="patient", content="left shin hurts"),
            ],
        )
        apply_transcript_inferences(session)
        self.assertIn("shin", (session.slots.site or "").lower())

    def test_blob_includes_chief_and_transcript(self):
        session = SessionState(
            chief_complaint="headache",
            transcript=[TranscriptTurn(role="patient", content="since last night")],
        )
        blob = patient_transcript_blob(session)
        self.assertIn("headache", blob)
        self.assertIn("last night", blob)


if __name__ == "__main__":
    unittest.main()
