from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from app.schemas.intake import RedFlagResult, TriageAction

RULES_PATH = Path(__file__).resolve().parent.parent / "data" / "red_flag_rules.json"

ACTION_RANK: dict[TriageAction, int] = {
    "continue": 0,
    "bypass_queue": 1,
    "escalate": 2,
}


@lru_cache
def _load_rules_pack() -> dict:
    with RULES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def get_emergency_redirect_message() -> str:
    return _load_rules_pack()["emergency_redirect_message"]


def evaluate_red_flags(text: str, severity: int | None = None) -> RedFlagResult:
    """Deterministic red-flag engine. Primary safety gate before TurnCrew."""
    normalized = _normalize(text)
    pack = _load_rules_pack()

    flags: list[str] = []
    matched_rules: list[str] = []
    best_action: TriageAction = "continue"
    reasons: list[str] = []

    for rule in pack["rules"]:
        for pattern in rule["patterns"]:
            if _pattern_in_text(pattern, normalized):
                flags.append(rule["flag"])
                matched_rules.append(rule["id"])
                action = rule["action"]
                if ACTION_RANK[action] > ACTION_RANK[best_action]:
                    best_action = action
                reasons.append(f"Matched rule '{rule['id']}' via '{pattern}'")
                break

    # High reported severity alone does not force bypass, but reinforces reason text.
    if severity is not None and severity >= 8 and best_action == "continue":
        reasons.append(f"Reported severity {severity}/10 noted (rules did not escalate)")

    is_emergency = best_action in ("bypass_queue", "escalate")
    return RedFlagResult(
        is_emergency=is_emergency,
        flags=sorted(set(flags)),
        matched_rules=sorted(set(matched_rules)),
        triage_action=best_action,
        reason="; ".join(reasons) if reasons else "No emergency patterns matched",
        source="rules",
    )


def merge_red_flags(rule_result: RedFlagResult, llm_result: RedFlagResult) -> RedFlagResult:
    """Rules own hard triage. LLM may add advisory flags/reasons only — never force bypass."""
    flags = sorted(set(rule_result.flags + llm_result.flags))
    matched = sorted(set(rule_result.matched_rules + llm_result.matched_rules))

    # Hard gate: only rules can set bypass_queue / escalate / is_emergency
    action = rule_result.triage_action
    is_emergency = rule_result.is_emergency

    reasons = [rule_result.reason] if rule_result.reason else []
    if llm_result.reason and (
        llm_result.is_emergency or llm_result.triage_action != "continue"
    ):
        reasons.append(f"LLM advisory (not applied to triage): {llm_result.reason}")
    elif llm_result.reason and llm_result.reason != rule_result.reason:
        reasons.append(llm_result.reason)

    return RedFlagResult(
        is_emergency=is_emergency,
        flags=flags,
        matched_rules=matched,
        triage_action=action,
        reason=" | ".join(r for r in reasons if r),
        source="merged",
    )


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s']", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text


def _pattern_in_text(pattern: str, normalized_text: str) -> bool:
    pat = _normalize(pattern)
    if not pat:
        return False
    # Word-boundary-ish: allow substring for multi-word clinical phrases
    return pat in normalized_text
