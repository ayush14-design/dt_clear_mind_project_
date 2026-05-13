# Project Design Record: ClearMind

**Created:** 2026-04-28  
**Updated:** 2026-05-13
**Project:** ClearMind — AI-Powered Stress Management Platform  
**Version:** 1.1.0

---

## 1. Executive Summary

ClearMind is a wellness application designed for working professionals that combines AI-powered coaching with evidence-based stress management tools. The platform offers breathing exercises, binaural sound therapy, mindful games, journaling, and sleep assistance — all personalized through an AI wellness assistant named "Aura."

---

## 2. Problem Statement

Working professionals face chronic stress, burnout, and mental fatigue but lack accessible, personalized tools for immediate relief and long-term wellness management. Traditional meditation apps offer generic content; ClearMind differentiates through:
- Real-time mood tracking with proactive intervention
- AI-driven root cause analysis of stress
- Personalized 3-day and 7-day wellness roadmaps
- Science-backed micro-interventions

---

## 3. Target Users

**Primary:** High-performance working professionals (ages 25-45)  
**Industries:** Technology, Finance, Healthcare, Legal  
**Pain Points:**
- Work pressure and overwhelm
- Cognitive fatigue and brain fog
- Sleep disruption
- Difficulty maintaining wellness routines

---

## 4. System Architecture

### 4.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js + Express |
| Storage | Supabase (PostgreSQL) / Local SQLite fallback |
| Authentication | JWT (jsonwebtoken) + Supabase |
| Password Security | bcryptjs |
| AI Integration | Google Generative AI (Gemini 3.1/1.5 Models) with local fallback |
| Styling | Custom CSS with Google Fonts |
| Deployment | Vercel (Configured via `vercel.json`) |

### 4.2 File Structure

```
dt clear mind project/
├── index.html          # Landing page + Dashboard
├── breathing.html      # Breathing exercises
├── sounds.html         # Binaural beats / sound therapy
├── games.html          # Mindful cognitive games
├── mood.html           # Mood tracking interface
├── journal.html        # Journaling interface
├── sleep.html          # Sleep stories + ambient mixer
├── onboarding.html     # AI-powered user onboarding
├── shared.js           # Shared utilities (auth, stars, toast)
├── style.css           # Global styles
├── server.js           # Express backend + API routes
├── database.js         # PostgreSQL/SQLite hybrid database connector
├── supabase.js         # Supabase client initialization
├── vercel.json         # Deployment configuration for Vercel
├── package.json        # Dependencies
├── .env                # Environment variables
└── data/               # Local SQLite data directory (fallback)
```

---

## 5. Core Features

### 5.1 Authentication System
- **Signup/Login** with email + password
- **JWT-based sessions** (7-day expiry)
- **Supabase Integration** for user data persistence
- **Streak tracking** (resets if day missed)
- **Industry profiling** for personalization

### 5.2 Mood Tracking
- **5 emoji-based moods:** Happy, Calm, Anxious, Sad, Angry, Neutral
- **Intensity slider** (1-10 scale)
- **Optional notes** with sentiment analysis
- **Proactive alerts** when 3-day mood drop detected
- **Tool recommendations** based on mood state

| Mood | Recommended Tool | Session |
|------|------------------|---------|
| Happy | sounds.html | Alpha Focus |
| Calm | breathing.html | Deep Reset |
| Anxious | breathing.html | Box 4-4-4-4 |
| Sad | sounds.html | Delta Restoration |
| Angry | breathing.html | 4-7-8 Calm |
| Neutral | games.html | Mindful Dots |

### 5.3 Wellness Tools

#### Breathing Exercises (`breathing.html`)
- Box breathing (4-4-4-4)
- 4-7-8 technique
- Deep reset patterns
- Visual guidance with animations

#### Sound Therapy (`sounds.html`)
- Alpha waves (focus)
- Delta waves (sleep)
- Theta waves (relaxation)
- Binaural beats for cognitive enhancement

#### Mindful Games (`games.html`)
- Memory match exercises
- Cognitive engagement tasks
- Stress-spiral interruption

#### Journaling (`journal.html`)
- Guided reflection prompts
- Free-form writing
- Mood context integration

#### Sleep Assistant (`sleep.html`)
- AI-generated bedtime stories
- Ambient sound mixer
- Sleep-focused binaural tracks

### 5.4 AI Integration (Aura)

#### Wellness Chat (`/api/ai/chat`)
- **Models:** Gemini 3.1 Flash Lite Preview, 1.5 Flash, 1.5 Pro, etc.
- **Persona:** Research-grade wellness architect
- **Capabilities:**
  - Dynamic stress consultation
  - Root cause identification
  - Evidence-based micro-interventions
  - Context-aware proactive CTAs
- **Fallback:** Direct solution mode when cloud AI is unreachable.

#### Personalized Roadmap (`/api/ai/roadmap`)
- **Output:** 3-day or 7-day structured wellness plan
- **Requirements:**
  - Diversified solutions
  - Biological rationale for each activity
- **Storage:** Synced to user profile

### 5.5 Dashboard & Analytics

**Stats Tracked:**
- Current streak (consecutive days)
- Total minutes spent in sessions
- Recent search queries
- Recent journals

---

## 6. API Reference

### Authentication
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/signup` | POST | No | Register new user |
| `/api/login` | POST | No | Authenticate user |
| `/api/user/profile` | GET | Yes | Fetch user profile and recent journal |

### Content & Logs
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/journal` | POST | Yes | Log journal entry |
| `/api/search-history` | GET | Yes | Fetch user's recent search queries |

### AI Features
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/ai/chat` | POST | Yes | Chat with Aura and log queries |
| `/api/ai/roadmap` | POST | Yes | Generate 3-day wellness plan |

---

## 7. Data Model (Supabase/PostgreSQL Schema)

### Users Table (`users`)
- `id` (TEXT, Primary Key)
- `name` (TEXT)
- `email` (TEXT, Unique)
- `password` (TEXT, Hashed)
- `industry` (TEXT)
- `createdAt` (TEXT)
- `streak` (INTEGER)
- `totalMinutes` (INTEGER)
- `lastActiveDate` (TEXT)
- `roadmap` (TEXT)

### Moods Table (`moods`)
- `id` (SERIAL/INTEGER, Primary Key)
- `userId` (TEXT)
- `emoji` (TEXT)
- `label` (TEXT)
- `note` (TEXT)
- `intensity` (INTEGER)
- `timestamp` (TEXT)

### Sessions Table (`sessions`)
- `id` (SERIAL/INTEGER, Primary Key)
- `userId` (TEXT)
- `type` (TEXT)
- `subtype` (TEXT)
- `duration` (INTEGER)
- `timestamp` (TEXT)

### Queries Table (`queries`)
- `id` (SERIAL/INTEGER, Primary Key)
- `userId` (TEXT)
- `query` (TEXT)
- `timestamp` (TEXT)

### Journals Table (`journals`)
- `id` (SERIAL/INTEGER, Primary Key)
- `userId` (TEXT)
- `content` (TEXT)
- `prompt` (TEXT)
- `timestamp` (TEXT)

---

## 8. Design System

### Color Palette
| Variable | Value | Usage |
|----------|-------|-------|
| `--midnight` | `#03050C` | Background |
| `--teal` | `#00C9A7` | Primary accent |
| `--teal-light` | `#00FFC7` | Highlights |
| `--rose` | `#FF6B9D` | Secondary accent |
| `--text` | `#B0B0B0` | Body text |
| `--white` | `#FFFFFF` | Headings |

### Typography
- **Headings:** Cormorant Garamond (serif, elegant)
- **Body:** DM Sans (sans-serif, clean)

### Visual Effects
- Animated starfield canvas background
- Glass morphism cards with backdrop blur
- Smooth transitions and hover states

---

## 9. Security Considerations

- Passwords hashed with bcrypt (salt rounds: 10)
- JWT tokens expire after 7 days
- Authentication middleware protects user routes
- Supabase backend for reliable user data storage
- Environment variables for sensitive config (Supabase URL/Key, Gemini API Key)
- CORS enabled for cross-origin requests

---

## 10. Running the Project

```bash
# Install dependencies
npm install

# Configure environment (.env)
# SUPABASE_URL=...
# SUPABASE_KEY=...
# GEMINI_API_KEY=...
# JWT_SECRET=...

# Start server
npm start

# Access application
# Open http://localhost:3000
```

---

## 11. Key Personnel

**Developer:** AYUSH  
**Project Type:** Personal/Portfolio  
**AI Assistant:** Aura (powered by Gemini models)

---

*This PDR serves as the single source of truth for ClearMind's architecture, features, and design decisions.*
