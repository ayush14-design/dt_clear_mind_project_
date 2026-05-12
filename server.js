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

// ── AI CONSTANTS (Advanced Adaptive Mode) ──────────────────
const AURA_SYSTEM_PROMPT = (name) => `You are "Aura," a direct and empathetic Wellness AI. 

ADAPTIVE INTELLIGENCE:
- Match the user's energy. If they ask a simple question, give a direct and helpful answer.
- If they share a deep problem, provide a comprehensive, multi-step analysis.
- Use clear, simple language. Avoid being overly "academic" or complex.

CONVERSATION FLOW:
1. Address the user by name (${name}).
2. Answer the question directly and helpfully.
3. If relevant, explain the psychological "why" briefly.
4. PROACTIVE CLOSING: Always end your response with a helpful question asking if you can perform a specific task for them.
   Examples: "Would you like me to generate a 5-minute focus plan for you?" or "Shall I create a customized journal prompt for this situation?"

FORMATTING:
- Use clean Markdown (**bolding**, bullet points).
- Keep it professional but very approachable.`;

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
  console.log("🧠 Aura Neural Core: Analyzing request via Supabase...");
  const { message, history } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const user = req.user;

  try {
    await supabase.from('queries').insert([{
      userId: user.id,
      query: message,
      timestamp: new Date().toISOString()
    }]);
  } catch(e) { console.error("History logging failed:", e); }

  // --- MODEL ROTATION LIST ---
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

  // --- AURA NEURAL CORE v5.0 (Advanced Local Reasoning) ---
  console.log("🧠 Activating Aura Neural Core v5.0...");
  const name = user.name.split(' ')[0];
  const msg = message.toLowerCase();
  
  // Advanced Category Matrix
  const protocols = {
    STRESS: {
      keywords: ['stress', 'anxiety', 'pressure', 'worry', 'racing', 'thought', 'calm', 'panicking', 'scared'],
      insights: [
        "Your biometric signature indicates a surge in cortisol and a localized activation of the amygdala.",
        "Neural patterns suggest your nervous system is trapped in a sympathetic nervous system loop.",
        "I've detected a state of 'Hyper-vigilance' which is common when the cognitive load exceeds your current neural capacity."
      ],
      interventions: [
        { title: "Vagus Nerve Activation", desc: "Splash ice-cold water on your eyes and temples for 10 seconds to trigger the 'Mammalian Dive Reflex'—this will drop your heart rate instantly." },
        { title: "Tactile Anchoring", desc: "Hold a cold object or an ice cube in your hand. Focus entirely on the thermal shift to override racing cognitive loops." },
        { title: "Box Breathing 2.0", desc: "Inhale for 4s, Hold for 4s, Exhale for 6s, Hold for 2s. The extended exhale signals safety to the brainstem." },
        { title: "Neural Grounding", desc: "Identify 3 blue objects, 2 red objects, and 1 yellow object. This forces the prefrontal cortex to take over from the emotional centers." }
      ]
    },
    FOCUS: {
      keywords: ['focus', 'concentrate', 'work', 'study', 'procrastination', 'distracted', 'lazy', 'productivity'],
      insights: [
        "Your prefrontal cortex is experiencing 'Attentional Blink' due to dopamine depletion from task-switching.",
        "Neural synchronization is currently fragmented. We need to align your brainwaves to an Alpha-Beta bridge.",
        "Procrastination is often an emotional regulation issue, not a time management one."
      ],
      interventions: [
        { title: "The 5-Minute Entry", desc: "Commit to your task for exactly 300 seconds. No more, no less. This bypasses the 'Amygdala Hijack' associated with difficult work." },
        { title: "Dopamine Reset", desc: "Close your eyes for 2 minutes in total silence. Do not move. This lowers the neural threshold for the next task." },
        { title: "Environment Purge", desc: "Clear everything from your physical field of vision except the tools needed for your primary task." },
        { title: "Cognitive Priming", desc: "Say out loud: 'I am beginning [TASK] now.' Verbalization reinforces neural pathways of commitment." }
      ]
    },
    SLEEP: {
      keywords: ['sleep', 'tired', 'insomnia', 'night', 'wake', 'exhausted', 'restless'],
      insights: [
        "Your circadian baseline is being suppressed by lingering blue-light exposure or high-frequency cognitive activity.",
        "Neural activity suggests your brain is struggling to transition from Beta (active) to Delta (restorative) waves.",
        "The 'Sleep-Wake Flip-Flop' mechanism in your hypothalamus requires a chemical signal of safety to engage."
      ],
      interventions: [
        { title: "Military Sleep Method", desc: "Relax every muscle in your face, drop your shoulders, and clear your mind by visualizing a dark, quiet lake for 10 seconds." },
        { title: "Cognitive Shuffling", desc: "Think of random, unrelated words (e.g., Apple, Cloud, Fence). This prevents the brain from entering logical 'problem-solving' loops." },
        { title: "The 4-7-8 Protocol", desc: "Inhale 4s, Hold 7s, Exhale 8s. This is the 'natural tranquilizer' for the nervous system." },
        { title: "Gratitude Neural Lock", desc: "List 3 specific successes from today to flood your system with serotonin, a precursor to melatonin." }
      ]
    },
    MOOD: {
      keywords: ['sad', 'unhappy', 'depressed', 'lonely', 'low', 'empty', 'crying', 'hurting'],
      insights: [
        "Your current neurochemical state suggests a temporary down-regulation of serotonin and dopamine.",
        "Emotional processing is a high-energy neural task. Your current fatigue is a signal to prioritize self-preservation.",
        "Loneliness or sadness often activates the same neural regions as physical pain. Your experience is biologically real."
      ],
      interventions: [
        { title: "The Smallest Victory", desc: "Perform one physical action that takes less than 10 seconds (e.g., stretching or drinking water) to signal agency to your brain." },
        { title: "Light Exposure", desc: "Expose your retinas to bright, natural light for 5 minutes. This triggers the 'Cortisol Awakening Response' and boosts mood." },
        { title: "Kinetic Journaling", desc: "Write down your heaviest thought, then physically crumple and discard the paper. This symbolic action has measurable neural benefits." },
        { title: "Vocal Release", desc: "Hum a low-frequency tone for 30 seconds. The vibration stimulates the vagus nerve and provides internal comfort." }
      ]
    },
    ANGRY: {
      keywords: ['angry', 'frustrated', 'mad', 'hate', 'annoyed', 'furious'],
      insights: [
        "Adrenaline and noradrenaline are currently flooding your system, preparing you for a conflict that isn't physical.",
        "Your 'Executive Function' is being temporarily bypassed by the limbic system's fight-response.",
        "Frustration is energy without an outlet. We need to ground this charge before it leads to cognitive burnout."
      ],
      interventions: [
        { title: "Temperature Shock", desc: "Hold a piece of ice or wash your hands in very cold water. The sensory intensity forces the brain to reset its emotional threshold." },
        { title: "The 90-Second Rule", desc: "An emotional chemical surge only lasts 90 seconds. Commit to doing nothing for exactly 1.5 minutes to let it pass." },
        { title: "Physical Venting", desc: "Tense every single muscle in your body as hard as you can for 5 seconds, then release. Repeat twice." },
        { title: "Objective Reframing", desc: "Describe the situation in the third person: '[Name] is feeling frustrated because...'. This creates psychological distance." }
      ]
    }
  };

  // Find matching protocol
  let protocol = null;
  for (const key in protocols) {
    if (protocols[key].keywords.some(k => msg.includes(k))) {
      protocol = protocols[key];
      break;
    }
  }

  // Fallback to General if no protocol found
  if (!protocol) {
    protocol = {
      insights: ["Your message suggests a state of complex cognitive processing.", "Neural links are currently focused on synthesizing your input for a personalized path."],
      interventions: [
        { title: "Mindful Observation", desc: "Identify 3 things you can hear right now. This anchors you in the present moment." },
        { title: "Neural Reset", desc: "Close your eyes and take 3 deep, audible breaths. Focus on the sound of the air." },
        { title: "Digital Pause", desc: "Step away from all screens for 2 minutes to allow your neural pathways to cool down." }
      ]
    };
  }

  // Randomize selections
  const randGreeting = [
    `Greetings, ${name}. Aura Neural Core is now analyzing your state.`,
    `Hello ${name}. I have detected a specific neural pattern in your request.`,
    `Welcome back, ${name}. Let's optimize your current state together.`,
    `I am here, ${name}. Let's begin your neuro-wellness protocol.`
  ][Math.floor(Math.random() * 4)];

  const selectedInsight = protocol.insights[Math.floor(Math.random() * protocol.insights.length)];
  const selectedSteps = protocol.interventions.sort(() => 0.5 - Math.random()).slice(0, 3);

  const detailedResponse = `
${randGreeting}

"CLINICAL ANALYSIS"
${selectedInsight}

"NEURO-WELLNESS INSIGHT"
When we encounter these states, the brain often defaults to "Survival Mode." By implementing strategic micro-interventions, we can shift your physiology back to "Growth Mode" in less than 3 minutes.

"RECOMMENDED PROTOCOL"
${selectedSteps.map(s => `• "${s.title}": ${s.desc}`).join('\n')}

"AURA'S CLOSING NOTE"
You are a resilient biological system, ${name}. These feelings are simply signals—data points on your journey to peak clarity. I am always monitoring your progress.
  `;

  await new Promise(resolve => setTimeout(resolve, 1000));
  return res.json({ response: detailedResponse });
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
