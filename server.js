// ClearMind — Backend Server v4.7 (Simple & Fast)
// Heartbeat Update: 2026-05-13 — Cloud Stability Fix
// ============================================================

require('dotenv').config();
console.log("🛠️ Environment Check:", process.env.SUPABASE_URL ? "Supabase URL Detected" : "No Supabase URL");
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { run, get, all, initDB } = require('./database');
const supabase = require('./supabase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize AI globally
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clearmind-fallback-secret';

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
// Serve static files (needed for localhost)
app.use(express.static(__dirname));

// Global Request Logger
app.use((req, res, next) => {
  console.log(`🚀 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: process.env.POSTGRES_URL ? 'production' : 'local' });
});

// ── Database Initialization ────────────────────────────────
async function startApp() {
  if (process.env.SUPABASE_URL) {
    console.log("✅ Supabase Cloud Engine: Active.");
    return;
  }
  try {
    await initDB();
    console.log("✅ Database Ready.");
  } catch (err) {
    console.error("❌ DB Error:", err.message);
  }
}
startApp();

// ── Auth middleware ────────────────────────────────────────
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check Supabase for user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', decoded.email)
      .single();

    if (error || !user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Error:", err.message);
    return res.status(401).json({ error: 'Invalid session' });
  }
}

// ── AI CONSTANTS (Direct Solution Mode) ────────────────────
const AURA_SYSTEM_PROMPT = (name) => `You are the core intelligence of "Clear Mind," an advanced AI dedicated to stress reduction and burnout prevention. Your goal is to help users navigate high-pressure situations.

TONE & VOICE:
- Empathetic but Direct: Acknowledge ${name}'s feelings first with warmth, then move IMMEDIATELY to a specific, actionable solution.
- Grounded: Use human-centric, natural language. Avoid all sci-fi or technical jargon.

OPERATIONAL LOGIC:
1. Acknowledge & Validate: Briefly validate the user's stress (e.g., "That sounds like a lot to manage right now").
2. Direct Solution: Provide the most effective solution or protocol immediately. Do not ask follow-up questions to understand the situation further—just solve it based on the data provided.
3. Proactive Closing: End with a single, clear question asking if you can perform a specific task (e.g., "Would you like me to generate a 5-minute focus plan for you?").

FORMATTING:
- Use clean Markdown (**bolding** for emphasis, bullet points for lists).
- Keep the structure minimalist and focused on the solution.`;

// ── AUTH ROUTES ────────────────────────────────────────────

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, industry } = req.body;
    
    // Check existing
    const { data: existing } = await supabase.from('users').select('*').eq('email', email).single();
    if (existing) return res.status(409).json({ error: 'Email registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString(36);
    
    const { error } = await supabase.from('users').insert([{
      id: userId,
      name,
      email,
      password: hashedPassword,
      industry: industry || 'Technology',
      createdAt: new Date().toISOString(),
      streak: 1,
      totalMinutes: 0
    }]);

    if (error) throw error;

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, name, email, industry } });
  } catch (err) { 
    console.error("Signup Error:", err.message);
    res.status(500).json({ error: 'Signup failed' }); 
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
    
    if (error || !user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/user/profile', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, industry, createdAt')
      .eq('id', userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    
    const { data: journals } = await supabase
      .from('journals')
      .select('content')
      .eq('userId', userId)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    res.json({ ...user, journals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  const { message, history } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const user = req.user;

  // Log query
  try {
    await supabase.from('queries').insert([{
      userId: user.id,
      query: message,
      timestamp: new Date().toISOString()
    }]);
  } catch(e) { console.error("History logging failed:", e); }

  // --- CLOUD AI ATTEMPT ---
  const models = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  const systemPrompt = AURA_SYSTEM_PROMPT(user.name);
  
  for (let modelName of models) {
    try {
      console.log(`📡 Attempting connection via ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: `Aura Neural Core initialized for ${user.name}. How can I assist your cognitive state today?` }] },
          ...(history || []).slice(-10).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }))
        ]
      });

      const result = await chat.sendMessage(message);
      const response = await result.response;
      const responseText = response.text();
      console.log(`✅ Success with ${modelName}`);
      return res.json({ response: responseText });
    } catch (err) {
      console.log(`⚠️ ${modelName} failed: ${err.message.substring(0, 80)}...`);
      continue;
    }
  }

  // --- LOCAL FALLBACK (Context-Aware & Direct) ---
  const name = user.name.split(' ')[0];
  const msg = message.toLowerCase();
  const lastAiMessage = history && history.length > 0 ? history[history.length - 1].content.toLowerCase() : "";
  
  let responseText = "";
  if (!history || history.length === 0) {
    responseText += `Hello ${name}. I'm here to support you. `;
  }

  // Context-Aware Logic (Handling "Yes" to CTAs)
  if (msg === "yes" || msg.includes("yes do it") || msg.includes("please do")) {
    if (lastAiMessage.includes("focus plan")) {
      responseText += "Excellent. Here is your **5-Minute Focus Protocol**: \n1. Clear your desk of everything except one item. \n2. Set a timer for 5 minutes. \n3. Do not look away from your task until it rings.";
    } else if (lastAiMessage.includes("journal prompt")) {
      responseText += "Here is a prompt for you: **'What is one thing I am tolerating right now that I could change?'** Write for 3 minutes without stopping.";
    } else if (lastAiMessage.includes("grounding exercise")) {
      responseText += "Let's do the **5-4-3-2-1 Technique**: Name 5 things you see, 4 things you can touch, 3 things you hear, 2 things you can smell, and 1 thing you can taste.";
    } else {
      responseText += "I'm ready. Tell me exactly what you'd like me to solve or generate for you.";
    }
  } 
  // Standard Adaptive logic
  else if (msg.includes("hello") || msg.includes("hi")) {
    responseText += "I'm ready to help you optimize your wellness. What can I solve for you today?";
  } else if (msg.includes("stress") || msg.includes("anxious") || msg.includes("overwhelmed") || msg.includes("pressure")) {
    responseText += "That sounds like a lot to manage. To lower your immediate stress, I recommend a **90-Second Reset**: Close your eyes and focus entirely on your breathing. An emotional surge only lasts 90 seconds if you don't feed it with more thoughts.";
  } else if (msg.includes("work") || msg.includes("focus") || msg.includes("study")) {
    responseText += "For immediate focus, try the **2-Minute Rule**: If a task takes less than 2 minutes, do it now to clear your cognitive load.";
  } else {
    responseText += "I've analyzed your input. To help you best, should I generate a **focus plan**, a **journal prompt**, or a **grounding exercise** for you?";
  }

  // Proactive closing (if not already handled)
  if (!responseText.includes("Here is your") && !responseText.includes("I recommend")) {
    const ctas = [
      "Would you like me to generate a 5-minute focus plan for you?",
      "Shall I create a customized journal prompt for this situation?",
      "Would you like me to walk you through a quick grounding exercise?"
    ];
    // Filter out CTAs that might have been recently mentioned
    const filteredCtas = ctas.filter(cta => !lastAiMessage.toLowerCase().includes(cta.split(' ')[5]));
    const finalCta = filteredCtas.length > 0 ? filteredCtas[Math.floor(Math.random() * filteredCtas.length)] : ctas[0];
    
    responseText += `\n\n**${finalCta}**`;
  }
  
  return res.json({ response: responseText });
});

app.post('/api/ai/roadmap', authMiddleware, async (req, res) => {
  console.log("🗺️ Roadmap Engine: Synthesizing path...");
  const { history } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `Based on this chat history: ${JSON.stringify(history)}, generate a personalized 3-day wellness roadmap.
  Return ONLY a JSON array of 3 objects, each with: "day" (1, 2, or 3), "activity" (a short title), "type" (one of: "breathing", "focus", "sleep", "journal", "sounds", "games", "mood"), and "rationale" (a short 1-sentence explanation).
  Example: [{"day": 1, "activity": "Deep Breath Sync", "type": "breathing", "rationale": "To lower your immediate heart rate."}]`;

  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Clean up markdown if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const roadmap = JSON.parse(text);
    return res.json({ roadmap });
  } catch (err) {
    console.error("Roadmap AI Error:", err.message);
    // Fallback roadmap
    const fallback = [
      { day: 1, activity: "Digital Detox & Breath", type: "breathing", rationale: "To reset your nervous system after a long day." },
      { day: 2, activity: "Gratitude Reflection", type: "journal", rationale: "To shift your focus toward positive growth." },
      { day: 3, activity: "Sleep Synthesis", type: "sleep", rationale: "To ensure deep recovery for the week ahead." }
    ];
    return res.json({ roadmap: fallback });
  }
});

app.get('/api/search-history', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: queries } = await supabase
      .from('queries')
      .select('query, timestamp')
      .eq('userId', userId)
      .order('timestamp', { ascending: false })
      .limit(10);
    res.json(queries || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch search history' });
  }
});

app.post('/api/journal', authMiddleware, async (req, res) => {
  const { content, prompt } = req.body;
  const userId = req.user.id;
  const timestamp = new Date().toISOString();

  try {
    const { error } = await supabase.from('journals').insert([{
      userId,
      content,
      prompt,
      timestamp
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Journal Save Error:", err.message);
    res.status(500).json({ error: 'Failed to save journal entry' });
  }
});

// ── Start server ───────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🌿 ClearMind v4.7 Running on http://localhost:${PORT}`);
  });
}
module.exports = app;
