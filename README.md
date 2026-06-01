# NovaMed — AI Medical Assistant 🩺

NovaMed is an AI-powered medical chatbot that helps users understand their symptoms, explore possible diagnoses, get medication guidance, and check drug interactions — all in real time.

## ✨ Features

- 🤒 **Symptom Analysis** — Describe your symptoms and get a structured differential diagnosis
- 💊 **Medication Guidance** — Ask about drugs, dosages, side effects, and when prescriptions are needed
- ⚗️ **Drug Interaction Checks** — Find out if two medications are safe to take together
- 🚨 **Emergency Recognition** — Immediate red-flag alerts for life-threatening symptoms
- 🩺 **Preventive Health** — Evidence-based lifestyle and wellness recommendations

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · Flask |
| AI Model | Meta Llama 3.3 70B (via Groq API) |
| Frontend | HTML · CSS · Vanilla JavaScript |
| Fonts | Google Fonts (Inter) |

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Rage4005/NovaMed.git
cd NovaMed
```

### 2. Install dependencies
```bash
pip install flask flask-cors requests python-dotenv
```

### 3. Set up your API key
Create a `.env` file in the project root:
```
GROQ_API_KEY=your_groq_api_key_here
```
Get your free key at [console.groq.com](https://console.groq.com)

### 4. Run the app
```bash
python app.py
```

Open your browser at **http://localhost:5000**

## ⚠️ Disclaimer

> NovaMed is for **informational and educational purposes only**. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical decisions. In case of emergency, call your local emergency number immediately.

## 📄 License

MIT License