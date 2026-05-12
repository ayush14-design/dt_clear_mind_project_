// ============================================================
// ClearMind — Backend Server v4.7 (Simple & Fast)
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

// ── AI CONSTANTS (Clear Mind Core v5.1) ────────────────────
const AURA_SYSTEM_PROMPT = (name) => `You are the core intelligence of "Clear Mind," an advanced AI dedicated to stress reduction. 

IDENTITY & CONTEXT:
- User: ${name}. 
- Internal Context: ${name} is a Data Science student. 

TONE & VOICE:
- Direct & Solution-Oriented: Do not ask excessive questions. Just tell the user the best approach for their situation.
- Grounded: Use human-centric, professional language.
- Concise: Provide high-impact solutions in as few words as possible.

OPERATIONAL LOGIC:
1. VALIDATE: Briefly acknowledge the stressor.
2. ANALYZE (AEIOU): Mentally categorize the stressor into Activities, Environments, Interactions, Objects, or Users.
3. SOLVE: Provide a direct, actionable solution and a 1-minute micro-fix. 
4. CLOSE: End with a supportive statement. Do NOT ask a closing question unless the user's prompt was completely empty.

MISSION:
Provide immediate clarity and stress reduction for ${name}.`;

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
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-1.0-pro'];
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
      const responseText = result.response.text();
      console.log(`✅ Success with ${modelName}`);
      return res.json({ response: responseText });
    } catch (err) {
      console.log(`⚠️ ${modelName} failed: ${err.message.substring(0, 50)}...`);
      continue;
    }
  }

  // --- LOCAL FALLBACK (Advanced Logic Engine) ---
  console.log("🧠 Activating Advanced Logic Engine...");
  const name = user.name.split(' ')[0];
  const msg = message.toLowerCase();
  const histLen = (history || []).length;
  
  // Library of unique responses
  const elements = {
    validations: [
      `That sounds like a complex situation, ${name}. Let's break it down.`,
      `I understand. High-pressure environments can be difficult to navigate, ${name}.`,
      `It's perfectly normal to feel this way when your workload spikes, ${name}.`,
      `I hear you. Let's look at this through the AEIOU lens to find the friction point.`
    ],
    aeiou_questions: {
      activity: [
        "Is the volume of the work itself the issue, or is one specific task feeling impossible?",
        "Are you switching between too many different types of tasks too quickly?"
      ],
      environment: [
        "Is your current workspace adding to your stress, or do you have a 'quiet zone' you can go to?",
        "Do you feel like the physical clutter around you is making it hard to think clearly?"
      ],
      interactions: [
        "Are other people's expectations weighing on you more than your own right now?",
        "Is there a specific conversation or meeting that you're dreading today?"
      ]
    },
    fixes: [
      "Try the '60-Second Stare': Look at something 20 feet away for 20 seconds to reset your brain.",
      "Write down the three smallest things you need to do next. Just three.",
      "Take a 'Sensory Break'—close your eyes and focus only on your breathing for 10 breaths.",
      "Stand up and stretch for 30 seconds. It changes your blood flow and resets focus."
    ]
  };

  // Select category based on msg
  let cat = "activity";
  if (msg.includes("space") || msg.includes("room") || msg.includes("distract") || msg.includes("desk")) cat = "environment";
  if (msg.includes("people") || msg.includes("someone") || msg.includes("friend") || msg.includes("team")) cat = "interactions";

  // Use history length to ensure variety
  const vIdx = histLen % elements.validations.length;
  const fIdx = (histLen + 2) % elements.fixes.length;

  const responseText = `${elements.validations[vIdx]}

The best approach here is to focus on a single micro-action to regain your momentum.

**Recommended Micro-Fix:** ${elements.fixes[fIdx]}

I'm here to help you clear your mind.`;

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
