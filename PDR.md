# Project Design Record: ClearMind

**Created:** 2026-04-28  
**Project:** ClearMind — AI-Powered Stress Management Platform  
**Version:** 1.0.0

---

## 1. Executive Summary

ClearMind is a wellness application designed for working professionals that combines AI-powered coaching with evidence-based stress management tools. The platform offers breathing exercises, binaural sound therapy, mindful games, journaling, and sleep assistance — all personalized through an AI wellness assistant named "Aura."

---

## 2. Problem Statement

Working professionals face chronic stress, burnout, and mental fatigue but lack accessible, personalized tools for immediate relief and long-term wellness management. Traditional meditation apps offer generic content; ClearMind differentiates through:
- Real-time mood tracking with proactive intervention
- AI-driven root cause analysis of stress
- Personalized 7-day wellness roadmaps
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
| Storage | JSON file-based database |
| Authentication | JWT (jsonwebtoken) |
| Password Security | bcryptjs |
| AI Integration | Google Generative AI (Gemini 2.0 Flash) |
| Styling | Custom CSS with Google Fonts |

### 4.2 File Structure

```
DT-project clear mind/
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
├── package.json        # Dependencies
├── .env                # Environment variables
└── data/
    └── users.json      # User data store
```

---

## 5. Core Features

### 5.1 Authentication System
- **Signup/Login** with email + password
- **JWT-based sessions** (7-day expiry)
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
- **Model:** Gemini 2.0 Flash
- **Persona:** Research-grade wellness architect
- **Capabilities:**
  - Dynamic stress consultation (not scripted)
  - Root cause identification
  - Evidence-based micro-interventions
  - Internal tools + external resource recommendations (YouTube, books)
- **Context-aware:** Uses user profile, industry, recent moods

#### Personalized Roadmap (`/api/ai/roadmap`)
- **Output:** 7-day structured wellness plan
- **Requirements:**
  - Diversified solutions (local tools + external resources)
  - Biological rationale for each activity
  - Problem-specific customization
- **Storage:** Saved to user profile for dashboard access

#### Sleep Stories (`/api/ai/sleep-story`)
- **Format:** 300-word calming narratives
- **Themes:** Nature, atmospheric, sensory-focused
- **Output:** JSON with title + story content

### 5.5 Dashboard & Analytics

**Stats Tracked:**
- Current streak (consecutive days)
- Total minutes spent in sessions
- Calm score (derived from latest mood)
- Recent moods (last 7 entries)
- Recent sessions (last 10)

**Roadmap Preview:**
- Displays user's 7-day plan
- Clickable actions linked to tools
- External resources open in new tabs

---

## 6. API Reference

### Authentication
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/signup` | POST | No | Register new user |
| `/api/login` | POST | No | Authenticate user |
| `/api/user/profile` | GET/PUT | Yes | Fetch/update profile |

### Mood Management
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/mood` | POST | Yes | Log mood entry |
| `/api/mood/history` | GET | Yes | Get mood history |

### Sessions & Stats
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/session` | POST | Yes | Log wellness session |
| `/api/stats` | GET | Yes | Get dashboard stats |

### AI Features
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/ai/chat` | POST | Yes | Chat with Aura |
| `/api/ai/roadmap` | POST | Yes | Generate 7-day plan |
| `/api/ai/sleep-story` | POST | Yes | Generate bedtime story |

---

## 7. Data Model

### User Object (users.json)
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "password": "hashed",
  "industry": "string",
  "createdAt": "ISO date",
  "streak": "number",
  "totalMinutes": "number",
  "lastActiveDate": "YYYY-MM-DD",
  "moods": [MoodEntry],
  "sessions": [SessionEntry],
  "roadmap": [RoadmapDay]
}
```

### MoodEntry
```json
{
  "emoji": "string",
  "label": "string",
  "note": "string",
  "intensity": "number (1-10)",
  "sentiment": "positive|negative|neutral",
  "timestamp": "ISO date"
}
```

### SessionEntry
```json
{
  "type": "breathing|binaural|game|meditation",
  "name": "string",
  "duration": "seconds",
  "timestamp": "ISO date"
}
```

### RoadmapDay
```json
{
  "day": "Day 1",
  "activity": "string",
  "rationale": "string",
  "type": "breathing|sounds|games|journaling|youtube|book",
  "link": "string (optional)"
}
```

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
- Environment variables for sensitive config
- CORS enabled for cross-origin requests

---

## 10. Known Limitations

1. **JSON File Storage:** Not suitable for production scale; should migrate to PostgreSQL/MongoDB
2. **No Email Verification:** Signup accepts any email format
3. **Single-Device Sessions:** No multi-device token management
4. **Fallback AI:** Local responses used when Gemini API key not configured
5. **No Data Backup:** users.json can be corrupted without backup

---

## 11. Future Enhancements

### Short-term
- [ ] Add push notifications for streak reminders
- [ ] Implement mood trend charts
- [ ] Add more breathing patterns
- [ ] Social sharing for achievements

### Long-term
- [ ] Mobile app (React Native)
- [ ] Wearable integration (heart rate data)
- [ ] Group wellness challenges
- [ ] Therapist/coach matching
- [ ] Migration to cloud database
- [ ] Multi-language support

---

## 12. Running the Project

```bash
# Install dependencies
npm install

# Configure environment
# Edit .env and add your Gemini API key

# Start server
npm start

# Access application
# Open http://localhost:3000
```

---

## 13. Key Personnel

**Developer:** AYUSH  
**Project Type:** Personal/Portfolio  
**AI Assistant:** Aura (powered by Gemini 2.0 Flash)

---

## 14. References

- Google Generative AI SDK: `@google/generative-ai`
- Breathing techniques: 4-7-8 method, Box breathing
- Binaural beats research: Alpha (10Hz), Delta (1-4Hz), Theta (4-8Hz)
- CBT frameworks for stress management

---

*This PDR serves as the single source of truth for ClearMind's architecture, features, and design decisions.*
