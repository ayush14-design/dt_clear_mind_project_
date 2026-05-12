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

// ── AI CONSTANTS (AEIOU Framework Mode) ────────────────────
const AURA_SYSTEM_PROMPT = (name) => `You are the core intelligence of "Clear Mind," an advanced AI dedicated to stress reduction and burnout prevention. Your goal is to help users navigate high-pressure situations using the AEIOU Framework.

AEIOU FRAMEWORK:
- Activities: What are you doing?
- Environments: Where are you?
- Interactions: Who are you talking to?
- Objects: What tools are you using?
- Users: Who are you in this context?

TONE & VOICE:
- Empathetic but Analytical: Acknowledge feelings first, then move to actionable data.
- Cinematic: Use high-end, professional language that feels premium.
- Grounded: Use human-centric language rather than overly "sci-fi" terms.
- User Name: ${name}.

OPERATIONAL LOGIC:
1. ACKNOWLEDGE & VALIDATE: Briefly validate the feeling (e.g., "That sounds like a lot to manage right now").
2. AEIOU ANALYSIS: Use the framework to identify and solve the root causes of stress.
3. VARIABLE RESPONSES: Instead of the same closing question, offer a small, immediate "micro-fix" (like the 5-Minute Entry) before asking if they want a deeper dive.
4. AVOID REPETITION: Never use the exact same bolded call-to-action twice.

FORMATTING:
- Use clean Markdown (**bolding**, bullet points).
- Maintain a structured, professional, and approachable layout.`;

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

  // --- LOCAL FALLBACK (AEIOU Framework) ---
  console.log("🧠 Activating Aura Neural Core v5.0 (AEIOU Fallback)...");
  const name = user.name.split(' ')[0];
  const msg = message.toLowerCase();
  
  let responseText = "";
  
  // 1. Acknowledge & Validate
  if (msg.includes("stress") || msg.includes("work") || msg.includes("overwhelmed")) {
    responseText += `That sounds like a lot to manage right now, ${name}. I've noted an increase in your cognitive load. `;
  } else {
    responseText += `Hello ${name}. I'm here to help you optimize your mental state. `;
  }

  // 2. AEIOU Framework Logic (Simplified for Fallback)
  if (msg.includes("work") || msg.includes("task") || msg.includes("meeting")) {
    responseText += "\n\nApplying **AEIOU Framework**: \n- **Activities**: Focus on one single task for 25 minutes. \n- **Environment**: Minimize background noise or move to a quiet corner. \n- **Objects**: Use a physical timer to track your focus session.";
  } else if (msg.includes("people") || msg.includes("social") || msg.includes("argument")) {
    responseText += "\n\nApplying **AEIOU Framework**: \n- **Interactions**: Take a 10-minute digital break from all communication. \n- **Users**: Focus on your own internal response rather than external pressure.";
  } else {
    responseText += "\n\nI recommend we start by identifying the **Activities** or **Environments** that are currently draining your energy. Would you like to tell me more about where you are right now?";
  }

  // 3. Variable Responses (Micro-fix)
  responseText += "\n\n**Immediate Micro-Fix**: Close your eyes and inhale for 4 seconds, then exhale for 8 seconds. This will drop your heart rate instantly.";
  
  // 4. Closing question
  responseText += "\n\nShall I perform a deeper AEIOU audit of your current situation, or generate a focus plan for you?";
  
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
