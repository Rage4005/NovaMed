/**
 * NovaMed Medical Chatbot — Frontend Logic
 * Talks to our Flask backend which proxies the Groq API (Llama 4 Maverick)
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
 * Very lightweight markdown-ish renderer:
 * - ```code blocks```
 * - `inline code`
 * - **bold**
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
  // Newlines → br (only outside pre blocks)
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

  // Append user message
  appendMessage('user', text);

  // Add to history before sending
  conversationHistory.push({ role: 'user', content: text });

  // Show typing
  showTyping();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(0, -1), // send prior history
      }),
    });

    const data = await res.json();
    hideTyping();

    if (data.error) {
      appendError(data.error);
      // Remove the user message from history if we got an error
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
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const msg = chip.dataset.msg;
    sendMessage(msg);
  });
});

// ── Clear Conversation ────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  conversationHistory = [];
  messagesEl.innerHTML = '';

  // Restore welcome screen
  const welcome = document.createElement('div');
  welcome.className = 'welcome';
  welcome.innerHTML = `
    <div class="welcome-icon">🩺</div>
    <h1 class="welcome-title">Hello! I'm NovaMed</h1>
    <p class="welcome-subtitle">Your AI-powered Medical Assistant. Describe your symptoms, ask about medications, check drug interactions, or get evidence-based health guidance.</p>
    <div class="suggestion-chips">
      <button class="chip" data-msg="I have a headache, fever of 38.5°C, and body aches for 2 days. What could this be?">🤒 Headache &amp; fever symptoms</button>
      <button class="chip" data-msg="What are the side effects and dosage of Ibuprofen?">💊 Ibuprofen — dosage &amp; side effects</button>
      <button class="chip" data-msg="Can I take Paracetamol and Ibuprofen together? Any drug interactions?">⚗️ Drug interaction check</button>
      <button class="chip" data-msg="What are the early warning signs of diabetes I should watch for?">🩸 Diabetes warning signs</button>
    </div>`;

  welcome.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => sendMessage(chip.dataset.msg));
  });

  messagesEl.appendChild(welcome);
});

// ── Init ──────────────────────────────────────────────────────────────────
checkStatus();
inputEl.focus();
