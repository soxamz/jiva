from services.ml3.crew_engine import run_synthesis_crew

print("🚀 Starting Clinical Synthesis Crew...")

voice_input = "Patient states: 'I feel fine, just a mild headache. I have absolutely no medical history, no allergies, and I don't take any medications.'"
ocr_input = "Discharge Summary 04/2025: Patient diagnosed with Type 2 Diabetes. Prescribed Metformin 500mg. NOTE: Patient has a severe allergy to Penicillin."

try:
    result = run_synthesis_crew(
        voice_transcript=voice_input,
        ocr_data=ocr_input
    )
    print("\n✅ SUCCESS! Here is the JSON output:\n")
    print(result)
except Exception as e:
    print("\n❌ CRASH DETECTED. HERE IS THE EXACT ERROR:\n")
    import traceback
    traceback.print_exc()