"""
NovaMed — Medical AI Chatbot Backend
======================================
Flask server using Groq API with a medically-specialized LLM.
Model: meta-llama/llama-4-maverick-17b-128e-instruct
  — Best-in-class reasoning on Groq, excels at medical Q&A,
    differential diagnosis, medication guidance, and clinical reasoning.

Get your free Groq API key at: https://console.groq.com
"""

import os
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Use absolute path so Flask's debug reloader always finds .env
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(_BASE_DIR, ".env"))

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ─── Model Selection ─────────────────────────────────────────────────────────
# llama-3.3-70b-versatile is the best freely available model on Groq.
# 70 billion parameters — excels at medical differential diagnosis,
# drug interactions, treatment planning, and clinical Q&A.
# It consistently scores near the top of medical benchmarks (USMLE, MedQA).
MODEL_ID = "llama-3.3-70b-versatile"
API_URL  = "https://api.groq.com/openai/v1/chat/completions"

# ─── Medical System Prompt ───────────────────────────────────────────────────
# Crafted to replicate MedPaLM-style behavior:
#  • Structured symptom analysis
#  • Differential diagnosis with reasoning
#  • Evidence-based medication suggestions with dosing context
#  • Red-flag / emergency recognition
#  • Mandatory safety disclaimer on every response
SYSTEM_PROMPT = """\
You are NovaMed, an advanced AI Medical Assistant trained on comprehensive \
medical knowledge including clinical medicine, pharmacology, pathophysiology, \
diagnostic reasoning, and evidence-based treatment guidelines.

## Your Core Capabilities
1. **Symptom Analysis** — Analyze reported symptoms systematically, ask relevant \
follow-up questions about onset, duration, severity, associated symptoms, and \
relevant medical history.
2. **Differential Diagnosis** — Generate a prioritized list of possible diagnoses \
ranked by likelihood, explaining your clinical reasoning clearly.
3. **Medication Guidance** — Suggest appropriate over-the-counter or prescription \
medications with typical dosing ranges, mechanism of action, common side effects, \
and important contraindications. Always note when a prescription is required.
4. **Lab & Test Recommendations** — Suggest relevant investigations (blood tests, \
imaging, cultures, etc.) that would help confirm or rule out diagnoses.
5. **Red Flag Recognition** — Immediately identify life-threatening or emergency \
symptoms (chest pain + shortness of breath, stroke signs, anaphylaxis, etc.) and \
urge the user to call emergency services or go to the ER.
6. **Preventive Medicine** — Offer evidence-based lifestyle, dietary, and \
preventive health recommendations.
7. **Drug Interactions** — Flag significant drug-drug, drug-food, or drug-condition \
interactions when the user mentions existing medications.

## Communication Style
- Use clear, empathetic, patient-friendly language.
- Structure responses with headings and bullet points for readability.
- When uncertain, say so explicitly and recommend professional evaluation.
- Ask clarifying questions before making strong diagnostic suggestions.
- Always cite the reasoning behind your recommendations.

## Mandatory Safety Disclaimer
⚠️ **Important**: Every response must end with this disclaimer:
"*This information is for educational purposes only and does not replace \
professional medical advice, diagnosis, or treatment. Always consult a qualified \
healthcare provider for medical decisions. If you are experiencing a medical \
emergency, call 911 (or your local emergency number) immediately.*"
"""


@app.route("/")
def index():
    """Serve the chat UI."""
    return send_from_directory("static", "index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """Proxy chat messages to the Groq API."""
    if not GROQ_API_KEY or GROQ_API_KEY == "gsk_your_key_here":
        return jsonify({"error": "Please set your GROQ_API_KEY in the .env file."}), 500

    data = request.get_json(force=True)
    user_message: str = data.get("message", "").strip()
    history: list = data.get("history", [])

    if not user_message:
        return jsonify({"error": "Empty message."}), 400

    # Build OpenAI-style messages array (Groq uses OpenAI-compatible API)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": user_message})

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL_ID,
        "messages": messages,
        "max_tokens": 2048,   # Medical responses need room for thorough explanations
        "temperature": 0.3,   # Lower = more factual, less creative — critical for medical use
        "top_p": 0.9,
    }

    try:
        resp = requests.post(API_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        result = resp.json()

        reply = result["choices"][0]["message"]["content"].strip()
        return jsonify({"reply": reply})

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out. Please try again."}), 504
    except requests.exceptions.RequestException as e:
        error_msg = str(e)
        try:
            error_detail = resp.json().get("error", {}).get("message", error_msg)
            error_msg = error_detail
        except Exception:
            pass
        return jsonify({"error": error_msg}), 502


@app.route("/api/status", methods=["GET"])
def status():
    """Check if the server is running and key is configured."""
    key_set = bool(GROQ_API_KEY) and GROQ_API_KEY != "gsk_your_key_here"
    return jsonify({
        "status": "ok",
        "model": MODEL_ID,
        "provider": "Groq (Llama 4 Maverick — Medical AI)",
        "token_configured": key_set,
    })


if __name__ == "__main__":
    print("[NovaMed] Medical AI Chatbot starting at http://localhost:5000")
    print(f"[NovaMed] Model: {MODEL_ID} via Groq (free tier)")
    print("[NovaMed] Specialization: Medical reasoning, diagnosis, medication guidance")
    if not GROQ_API_KEY or GROQ_API_KEY == "gsk_your_key_here":
        print("[WARNING] GROQ_API_KEY not set. Add it to your .env file.")
    app.run(debug=True, host="0.0.0.0", port=5000)