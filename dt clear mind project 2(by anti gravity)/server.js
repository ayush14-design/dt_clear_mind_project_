require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'clearmind_secret_key_2025_change_in_production';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Auth Middleware ───────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token expired or invalid.' });
        req.user = user;
        next();
    });
};

// ─── Helper: update streak ─────────────────────────────────────────────────
function updateStreak(userId) {
    const today = new Date().toISOString().split('T')[0];
    db.get(`SELECT last_active_date, streak FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err || !user) return;
        const last = user.last_active_date;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let newStreak = user.streak || 0;
        if (last === today) return; // already counted today
        if (last === yesterday) {
            newStreak += 1; // extend streak
        } else {
            newStreak = 1; // reset streak
        }
        db.run(`UPDATE users SET streak = ?, last_active_date = ? WHERE id = ?`, [newStreak, today, userId]);
    });
}

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const today = new Date().toISOString().split('T')[0];
        db.run(`INSERT INTO users (name, email, password_hash, streak, last_active_date) VALUES (?, ?, ?, 1, ?)`,
            [name, email, hash, today],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already in use.' });
                    return res.status(500).json({ error: 'Database error.' });
                }
                const token = jwt.sign({ id: this.lastID, name, email }, JWT_SECRET, { expiresIn: '7d' });
                res.status(201).json({ token, user: { id: this.lastID, name, email, streak: 1 } });
            });
    } catch (e) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields are required.' });
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!user) return res.status(400).json({ error: 'Invalid email or password.' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(400).json({ error: 'Invalid email or password.' });
        updateStreak(user.id);
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, streak: user.streak } });
    });
});

// ─── USER ROUTES ───────────────────────────────────────────────────────────

// Get my profile
app.get('/api/user/me', authenticateToken, (req, res) => {
    db.get(`SELECT id, name, email, streak, last_active_date, created_at FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    });
});

// ─── MOOD ROUTES ───────────────────────────────────────────────────────────

// Log mood
app.post('/api/mood', authenticateToken, (req, res) => {
    const { emoji, mood_label, intensity, note } = req.body;
    if (!emoji || !intensity) return res.status(400).json({ error: 'Emoji and intensity required.' });
    db.run(`INSERT INTO mood_logs (user_id, emoji, mood_label, intensity, note) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, emoji, mood_label || '', intensity, note || ''],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to save mood.' });
            updateStreak(req.user.id);
            res.status(201).json({ id: this.lastID, message: 'Mood logged.' });
        });
});

// Get mood history (last 14)
app.get('/api/mood/history', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM mood_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 14`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows);
    });
});

// ─── JOURNAL ROUTES ────────────────────────────────────────────────────────

// Create journal entry
app.post('/api/journal', authenticateToken, (req, res) => {
    const { title, content, mood_emoji } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required.' });
    db.run(`INSERT INTO journal_entries (user_id, title, content, mood_emoji) VALUES (?, ?, ?, ?)`,
        [req.user.id, title || 'Untitled Entry', content, mood_emoji || ''],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to save entry.' });
            updateStreak(req.user.id);
            res.status(201).json({ id: this.lastID, message: 'Entry saved.' });
        });
});

// Get all journal entries
app.get('/api/journal', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM journal_entries WHERE user_id = ? ORDER BY timestamp DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows);
    });
});

// Delete journal entry
app.delete('/api/journal/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM journal_entries WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to delete.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Entry not found.' });
        res.json({ message: 'Entry deleted.' });
    });
});

// ─── AURA AI CHAT ─────────────────────────────────────────────────────────
const { GoogleGenAI } = require('@google/genai');
let ai;
if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

app.post('/api/aura/chat', authenticateToken, async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required.' });
    
    try {
        if (!process.env.GEMINI_API_KEY) {
            const auraResponses = [
                "I hear you. Let's take a moment — try 4 slow breaths with me. Inhale for 4, hold for 4, exhale for 4.",
                "Your feelings are valid. A 5-minute walk or some box breathing can help shift your state.",
                "It sounds like you're carrying a lot today. Remember: rest is productive too.",
                "Stress is your body's signal that something matters. Let's work through this together.",
                "Have you tried the breathing module? It's designed exactly for moments like this.",
                "You're not alone in this. Many professionals feel the same pressure. Let's find your reset.",
                "A quick tip: name 3 things you can see right now. This grounds you in the present moment.",
                "I'd suggest logging your mood so we can spot patterns over time. Small data, big insights."
            ];
            const resp = auraResponses[Math.floor(Math.random() * auraResponses.length)];
            return setTimeout(() => res.json({ response: resp }), 700 + Math.random() * 600);
        }

        const systemPrompt = `You are Aura, an AI personal wellness coach for professionals experiencing stress or burnout. 
        Keep your responses extremely concise (1-3 sentences max). 
        Be empathetic, non-clinical, and actionable. 
        Occasionally suggest simple micro-interventions like box breathing (4-4-4-4), a quick walk, or noting 3 things they are grateful for.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: message,
            config: {
                systemInstruction: systemPrompt,
            }
        });
        
        res.json({ response: response.text });
    } catch (err) {
        console.error('Gemini AI error:', err);
        res.status(500).json({ error: 'Aura is resting right now. Please try again later.' });
    }
});

// ─── SERVE SPA ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`✅  Clear Mind server running → http://localhost:${PORT}`);
});
