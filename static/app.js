/**
 * NovaMed Medical Chatbot — Frontend Logic
 * Talks to our Flask backend which proxies the Groq API (Llama 3.3 70B)
 */

const API_BASE = window.location.origin;

// ── State ────────────────────────────────────────────────────────────────
let conversationHistory = [];
let isThinking = false;

// ── DOM Refs ─────────────────────────────────────────────────────────────
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const scene = document.querySelector('.scene');

// ── Status Check ─────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    const data = await res.json();
    if (data.token_configured) {
      setStatus('online', 'Ready');
    } else {
      setStatus('offline', 'Token missing');
    }
  } catch {
    setStatus('offline', 'Server offline');
  }
}

function setStatus(state, label) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = label;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Lightweight markdown renderer:
 * - ```code blocks```
 * - `inline code`
 * - **bold**
 * - ## headings
 * - newlines → <br>
 */
function renderMarkdown(text) {
  // Code blocks
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${lang}">${escapeHtml(code.trim())}</code></pre>`
  );
  // Inline code
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Headings
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  // Newlines → br (but not inside pre)
  text = text.replace(/\n/g, '<br>');
  return text;
}

function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
}

// ── Remove Welcome Screen ─────────────────────────────────────────────────
function removeWelcome() {
  const welcome = messagesEl.querySelector('.welcome');
  if (welcome) welcome.remove();
}

// ── Append Message ────────────────────────────────────────────────────────
function appendMessage(role, text) {
  removeWelcome();

  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '🧑‍⚕️' : '🩺';

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (role === 'bot') {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  const ts = document.createElement('span');
  ts.className = 'timestamp';
  ts.textContent = formatTime(new Date());

  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(ts);
  wrap.appendChild(avatar);
  wrap.appendChild(bubbleWrap);

  messagesEl.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

// ── Typing Indicator ──────────────────────────────────────────────────────
let typingEl = null;

function showTyping() {
  removeWelcome();
  typingEl = document.createElement('div');
  typingEl.className = 'msg bot';
  typingEl.innerHTML = `
    <div class="avatar">🩺</div>
    <div class="bubble-wrap">
      <div class="bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  messagesEl.appendChild(typingEl);
  scrollToBottom();
}

function hideTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

// ── Error Message ─────────────────────────────────────────────────────────
function appendError(msg) {
  removeWelcome();
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `
    <div class="avatar">🩺</div>
    <div class="bubble-wrap">
      <div class="error-bubble">⚠️ ${escapeHtml(msg)}</div>
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

// ── Send Message ──────────────────────────────────────────────────────────
async function sendMessage(text) {
  text = text.trim();
  if (!text || isThinking) return;

  isThinking = true;
  sendBtn.disabled = true;
  inputEl.style.height = 'auto';

  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });
  showTyping();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(0, -1),
      }),
    });

    const data = await res.json();
    hideTyping();

    if (data.error) {
      appendError(data.error);
      conversationHistory.pop();
    } else {
      const reply = data.reply || '(No response)';
      appendMessage('bot', reply);
      conversationHistory.push({ role: 'assistant', content: reply });
    }
  } catch (err) {
    hideTyping();
    appendError('Could not reach the server. Is the Flask app running?');
    conversationHistory.pop();
  }

  isThinking = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

// ── Input Auto-resize ─────────────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
});

// ── Key Handlers ──────────────────────────────────────────────────────────
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const val = inputEl.value;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendMessage(val);
  }
});

// ── Send Button ───────────────────────────────────────────────────────────
sendBtn.addEventListener('click', () => {
  const val = inputEl.value;
  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendMessage(val);
});

// ── Suggestion Chips ──────────────────────────────────────────────────────
function attachChips(container) {
  container.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => sendMessage(chip.dataset.msg));
  });
}
attachChips(document);

// ── Clear Conversation ────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  conversationHistory = [];
  messagesEl.innerHTML = '';

  const welcome = document.createElement('div');
  welcome.className = 'welcome';
  welcome.innerHTML = `
    <div class="welcome-icon-wrap">
      <div class="pulse-ring"></div>
      <div class="pulse-ring"></div>
      <div class="pulse-ring"></div>
      <div class="welcome-icon">🩺</div>
    </div>
    <h1 class="welcome-title">Hello! I'm NovaMed</h1>
    <p class="welcome-subtitle">Your AI-powered Medical Assistant. Describe your symptoms, ask about medications, check drug interactions, or get evidence-based health guidance.</p>
    <div class="welcome-stats">
      <div class="w-stat"><div class="w-stat-dot"></div> AI Online</div>
      <div class="w-stat"><div class="w-stat-dot"></div> Llama 3.3 70B</div>
      <div class="w-stat"><div class="w-stat-dot"></div> Medical Mode Active</div>
    </div>
    <div class="suggestion-chips">
      <button class="chip" data-msg="I have a headache, fever of 38.5°C, and body aches for 2 days. What could this be?">🤒 Headache &amp; fever</button>
      <button class="chip" data-msg="What are the side effects and dosage of Ibuprofen?">💊 Ibuprofen dosage</button>
      <button class="chip" data-msg="Can I take Paracetamol and Ibuprofen together? Any drug interactions?">⚗️ Drug interactions</button>
      <button class="chip" data-msg="What are the early warning signs of diabetes I should watch for?">🩸 Diabetes signs</button>
      <button class="chip" data-msg="I have sharp chest pain and shortness of breath. What should I do?">🚨 Chest pain</button>
      <button class="chip" data-msg="What are the best foods to eat for a healthy heart?">🥗 Heart-healthy diet</button>
    </div>`;

  attachChips(welcome);
  messagesEl.appendChild(welcome);
});

// ══════════════════════════════════════════════════════════════════════════
// DECORATIVE ELEMENTS — Particles & Floating Medical Crosses
// ══════════════════════════════════════════════════════════════════════════

function spawnParticles() {
  const colors = ['#00e5ff', '#2979ff', '#00bcd4', '#7c4dff', '#00e676'];
  const count = 22;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';

    const size = Math.random() * 4 + 2; // 2–6px
    const x = Math.random() * 100;      // % from left
    const delay = Math.random() * 12;   // stagger
    const duration = Math.random() * 10 + 8; // 8–18s
    const color = colors[Math.floor(Math.random() * colors.length)];

    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}%;
      bottom: ${Math.random() * 30}%;
      background: ${color};
      box-shadow: 0 0 ${size * 2}px ${color};
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
    `;

    scene.appendChild(p);
  }
}

function spawnFloatingCrosses() {
  const icons = ['✚', '⚕', '🔬', '💉', '🧬'];
  const count = 8;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'med-cross';
    el.textContent = icons[Math.floor(Math.random() * icons.length)];

    const x = Math.random() * 85 + 5;    // 5–90% from left
    const y = Math.random() * 60 + 20;   // 20–80% from top
    const delay = Math.random() * 15;
    const duration = Math.random() * 12 + 10;
    const size = Math.random() * 16 + 18; // 18–34px

    el.style.cssText = `
      left: ${x}%;
      top: ${y}%;
      font-size: ${size}px;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
    `;

    scene.appendChild(el);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
spawnParticles();
spawnFloatingCrosses();
checkStatus();
inputEl.focus();
