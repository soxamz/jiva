# JivaHQ

Citizen-owned digital health vault + intelligent clinical intake (MVP slice: conversational AI).

## Quick start

### 1. API (FastAPI + CrewAI)

Requires **Python 3.10–3.13** (not 3.14). On this machine, Anaconda 3.13 works well:

```bash
cd api
C:\Users\KIIT\anaconda3\python.exe -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env                # add GROQ_API_KEY and GEMINI_API_KEY
uvicorn main:app --host 127.0.0.1 --port 5328 --reload --reload-exclude "runtime/*" --reload-exclude "*.json"
```

Details: [api/README.md](api/README.md)

### 2. Frontend (Next.js)

```bash
bun install
bun dev
```

- Home: http://localhost:3000  
- Intake UI: http://localhost:3000/intake  

## Stack (this module)

| Piece | Tech |
|-------|------|
| Turn agents | Groq `llama-3.1-8b-instant` via CrewAI |
| Close agents | Gemini `gemini-3.6-flash` via CrewAI |
| ASR | Groq Whisper |
| Red flags | Deterministic rules (+ LLM assist) |
| API | FastAPI on `:5328` |
| UI | Next.js App Router |
