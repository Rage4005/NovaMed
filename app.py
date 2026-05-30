"""
Chatbot Backend — Flask server using Groq API
Groq is free, blazing fast, and supports Llama 3, Mistral & more.
Get your free key at: https://console.groq.com
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
# Groq supports: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768, gemma2-9b-it
MODEL_ID = "llama-3.3-70b-versatile"
API_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are NovaMind, a helpful, friendly, and knowledgeable AI assistant. "
    "You answer clearly and concisely. If you don't know something, say so honestly."
)


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
        "max_tokens": 1024,
        "temperature": 0.7,
        "top_p": 0.95,
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
        "provider": "Groq",
        "token_configured": key_set,
    })


if __name__ == "__main__":
    print("[NovaMind] Chatbot server starting at http://localhost:5000")
    print(f"[NovaMind] Model: {MODEL_ID} via Groq")
    if not GROQ_API_KEY or GROQ_API_KEY == "gsk_your_key_here":
        print("[WARNING] GROQ_API_KEY not set. Add it to your .env file.")
    app.run(debug=True, host="0.0.0.0", port=5000)
