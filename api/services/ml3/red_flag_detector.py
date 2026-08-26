import re

def detect_emergencies(voice_transcript: str) -> dict:
    """
    Scans real-time ML 1 voice transcripts for critical emergencies.
    Bypasses LLM latency to trigger instant Next.js alerts.
    """
    critical_keywords = [
        r"\bchest pain\b", r"\bheart attack\b", r"\bdyspnoea\b", 
        r"\bcan't breathe\b", r"\bstroke\b", r"\bface drooping\b"
    ]
    
    flags = []
    text_lower = voice_transcript.lower()
    
    for pattern in critical_keywords:
        if re.search(pattern, text_lower):
            flags.append(pattern.replace(r"\b", ""))
            
    if flags:
        return {"triage_alert": True, "reasons": flags, "action": "IMMEDIATE_BYPASS"}
    return {"triage_alert": False, "reasons": [], "action": "PROCEED_TO_SYNTHESIS"}