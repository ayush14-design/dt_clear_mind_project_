document.addEventListener('DOMContentLoaded', async () => {
    
// --- SPA Navigation ---
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.nav-link');
    const gotoBtns = document.querySelectorAll('[data-goto]');

    function navigateTo(pageId) {
        pages.forEach(p => p.classList.remove('active'));
        navLinks.forEach(n => n.classList.remove('active'));
        
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) targetPage.classList.add('active');
        
        const targetNav = document.querySelector(`.nav-link[data-page="${pageId}"]`);
        if (targetNav) targetNav.classList.add('active');

        // Close mobile menu if open
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }

        // Fetch data based on page
        if (pageId === 'dashboard') fetchDashboardData();
        if (pageId === 'mood') fetchMoodHistory();
        if (pageId === 'journal') fetchJournals();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    gotoBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(btn.dataset.goto);
        });
    });

    // Mobile Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('active');
        });
    }

    // --- Auth Check & App Init ---
    const token = localStorage.getItem('token');
    const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html');
    
    if (!token && !isAuthPage) {
        window.location.href = '/login.html';
        return;
    }

    if (token && !isAuthPage) {
        const appShell = document.getElementById('app');
        const loadingScreen = document.getElementById('loading-screen');
        
        if (appShell) {
            appShell.style.display = 'block';
            if (loadingScreen) loadingScreen.style.display = 'none';
            navigateTo('dashboard');
        }
    }

    // --- Fetch User Data ---
    async function fetchDashboardData() {
        if (!token) return;
        try {
            const res = await fetch('/api/user/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                const greeting = document.getElementById('user-greeting');
                const streak = document.getElementById('stat-streak');
                const sidebarStreak = document.getElementById('sidebar-streak');
                const mobileStreak = document.getElementById('mobile-streak');
                
                if (greeting) greeting.textContent = `Good Evening, ${user.name.split(' ')[0]}`;
                if (streak) streak.textContent = user.streak;
                if (sidebarStreak) sidebarStreak.textContent = user.streak;
                if (mobileStreak) mobileStreak.textContent = user.streak;

                // Also fetch moods for stats
                fetchMoodHistory();
            } else {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
            }
        } catch(err) {
            console.error('Error fetching user data:', err);
        }
    }

    if (token) fetchDashboardData();

    // --- Logout ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        });
    }

    // --- Data Fetching ---
    async function fetchMoodHistory() {
        if (!token) return;
        try {
            const res = await fetch('/api/mood/history', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const logs = await res.json();
                
                // Update stats
                const logsStat = document.getElementById('stat-logs');
                if (logsStat) logsStat.textContent = logs.length;

                const grid = document.getElementById('mood-history-grid');
                const list = document.getElementById('mood-history-list');
                const renderHTML = logs.length === 0 
                    ? `<div class="empty-state"><i class="fa-regular fa-face-smile"></i><p>No moods logged yet.</p></div>`
                    : logs.map(l => `
                        <div class="mood-item glass-card" style="padding: 1rem;">
                            <div style="font-size: 2rem;">${l.emoji}</div>
                            <div>Intensity: ${l.intensity}</div>
                            ${l.note ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${l.note}</div>` : ''}
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem;">${new Date(l.timestamp).toLocaleDateString()}</div>
                        </div>`).join('');
                
                if (grid) grid.innerHTML = renderHTML;
                if (list) list.innerHTML = renderHTML;
            }
        } catch(err) { console.error('Error fetching mood history', err); }
    }

    async function fetchJournals() {
        if (!token) return;
        try {
            const res = await fetch('/api/journal', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const journals = await res.json();
                const entriesContainer = document.getElementById('journal-entries');
                if (entriesContainer) {
                    entriesContainer.innerHTML = journals.length === 0 
                        ? `<div class="empty-state"><i class="fa-solid fa-book-open"></i><p>No journal entries yet. Click <strong>New Entry</strong> to start writing!</p></div>`
                        : journals.map(j => `
                            <div class="journal-item glass-card" style="margin-bottom: 1rem; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h3 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">${j.mood_emoji || ''} ${j.title}</h3>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">${new Date(j.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p style="white-space: pre-wrap; font-size: 0.95rem;">${j.content}</p>
                            </div>`).join('');
                }
            }
        } catch(err) { console.error('Error fetching journals', err); }
    }

    // --- Mood Log Interactions ---
    const emojis = document.querySelectorAll('.emoji-btn');
    const intensitySlider = document.getElementById('mood-intensity');
    const intensityVal = document.getElementById('intensity-display');
    const logMoodBtn = document.getElementById('log-mood-btn');
    const moodStatus = document.getElementById('mood-feedback');
    const moodNote = document.getElementById('mood-note');
    let selectedEmoji = '😐'; // default
    let selectedMoodLabel = 'Okay';

    // Emoji Selection
    emojis.forEach(emoji => {
        emoji.addEventListener('click', () => {
            emojis.forEach(e => e.classList.remove('active'));
            emoji.classList.add('active');
            selectedEmoji = emoji.dataset.emoji || emoji.textContent.trim();
            selectedMoodLabel = emoji.dataset.mood || '';
        });
    });

    // Intensity Slider Update
    if(intensitySlider && intensityVal) {
        intensitySlider.addEventListener('input', (e) => {
            intensityVal.textContent = `${e.target.value} / 10`;
        });
    }

    // Log Mood API Call
    if (logMoodBtn) {
        logMoodBtn.addEventListener('click', async () => {
            const intensity = intensitySlider ? intensitySlider.value : 5;
            const note = moodNote ? moodNote.value.trim() : '';
            logMoodBtn.disabled = true;
            
            try {
                const res = await fetch('/api/mood', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ emoji: selectedEmoji, mood_label: selectedMoodLabel, intensity, note })
                });
                
                if (res.ok) {
                    if (moodStatus) {
                        moodStatus.textContent = 'Mood logged successfully.';
                        moodStatus.style.display = 'block';
                        setTimeout(() => moodStatus.style.display = 'none', 3000);
                    }
                    if (moodNote) moodNote.value = '';
                    fetchMoodHistory();
                    fetchDashboardData();
                } else {
                    const data = await res.json().catch(() => ({}));
                    if (moodStatus) {
                        moodStatus.textContent = data.error || 'Failed to log mood.';
                        moodStatus.style.display = 'block';
                    }
                }
            } catch(err) {
                console.error('Error logging mood:', err);
                if (moodStatus) {
                    moodStatus.textContent = 'Network error. Please try again.';
                    moodStatus.style.display = 'block';
                }
            } finally {
                logMoodBtn.disabled = false;
            }
        });
    }

    // --- Breathing Exercise ---
    const breatheToggleBtn = document.getElementById('breathe-toggle');
    const breatheCircle = document.getElementById('breathe-circle');
    const phaseLabel = document.getElementById('phase-label');
    const phaseCount = document.getElementById('phase-count');
    const cyclesCount = document.getElementById('cycles-count');
    const techniqueTabs = document.querySelectorAll('#technique-tabs .tab-btn');
    const techniqueDesc = document.getElementById('technique-desc');
    
    let isBreathing = false;
    let breathTimeout;
    let currentCycles = 0;
    
    const techniques = {
        'box': { name: 'Box 4-4-4-4', desc: 'Inhale for 4s, Hold for 4s, Exhale for 4s, Hold for 4s. Excellent for stress reset.', phases: [{name:'Inhale', t:4000}, {name:'Hold', t:4000}, {name:'Exhale', t:4000}, {name:'Hold', t:4000}] },
        '478': { name: 'Relax 4-7-8', desc: 'Inhale for 4s, Hold for 7s, Exhale for 8s. Best for falling asleep or acute anxiety.', phases: [{name:'Inhale', t:4000}, {name:'Hold', t:7000}, {name:'Exhale', t:8000}] },
        'deep': { name: 'Deep Reset', desc: 'Deep inhale for 5s, Exhale slowly for 10s. Best for severe fatigue and burnout recovery.', phases: [{name:'Inhale', t:5000}, {name:'Exhale', t:10000}] }
    };
    
    let currentTech = techniques['box'];

    techniqueTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if(isBreathing) stopBreathing();
            techniqueTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTech = techniques[tab.dataset.technique];
            if(techniqueDesc) techniqueDesc.textContent = currentTech.desc;
        });
    });

    function runBreathingPhase(phaseIndex) {
        if(!isBreathing) return;
        
        if(phaseIndex === 0 && currentCycles > 0) {
            currentCycles++;
            if(cyclesCount) cyclesCount.textContent = currentCycles;
        } else if (phaseIndex === 0 && currentCycles === 0) {
            currentCycles = 1;
            if(cyclesCount) cyclesCount.textContent = currentCycles;
        }

        const phase = currentTech.phases[phaseIndex];
        if(phaseLabel) phaseLabel.textContent = phase.name;
        
        if (breatheCircle) {
            breatheCircle.style.transition = `transform ${phase.t}ms linear`;
            if (phase.name === 'Inhale') breatheCircle.style.transform = 'scale(1.5)';
            else if (phase.name === 'Exhale') breatheCircle.style.transform = 'scale(1)';
        }

        let secondsLeft = phase.t / 1000;
        if(phaseCount) phaseCount.textContent = secondsLeft;
        
        const countdownInterval = setInterval(() => {
            if(!isBreathing) return clearInterval(countdownInterval);
            secondsLeft--;
            if(secondsLeft > 0 && phaseCount) phaseCount.textContent = secondsLeft;
        }, 1000);

        breathTimeout = setTimeout(() => {
            clearInterval(countdownInterval);
            const nextPhase = (phaseIndex + 1) % currentTech.phases.length;
            runBreathingPhase(nextPhase);
        }, phase.t);
    }

    function stopBreathing() {
        isBreathing = false;
        clearTimeout(breathTimeout);
        currentCycles = 0;
        if(breatheToggleBtn) breatheToggleBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
        if(breatheCircle) breatheCircle.style.transform = 'scale(1)';
        if(phaseLabel) phaseLabel.textContent = 'Ready';
        if(phaseCount) phaseCount.textContent = '';
        if(cyclesCount) cyclesCount.textContent = '0';
    }

    if(breatheToggleBtn) {
        breatheToggleBtn.addEventListener('click', () => {
            if(!isBreathing) {
                isBreathing = true;
                breatheToggleBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
                runBreathingPhase(0);
            } else {
                stopBreathing();
            }
        });
    }

    // --- Sound Therapy (Web Audio API Binaural Beats) ---
    const soundOptions = document.querySelectorAll('.sound-option');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = document.getElementById('play-icon');
    const volSlider = document.getElementById('vol-slider');
    const nowPlaying = document.getElementById('now-playing');
    
    let audioCtx;
    let leftOsc, rightOsc;
    let gainNode;
    let isPlaying = false;
    let currentFreqDiff = 10; // Default Alpha
    
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioCtx.createGain();
            gainNode.gain.value = volSlider ? volSlider.value / 100 : 0.6;
            gainNode.connect(audioCtx.destination);
        }
    }

    function startBinauralBeats() {
        initAudio();
        const baseFreq = 200; // Carrier frequency
        
        leftOsc = audioCtx.createOscillator();
        rightOsc = audioCtx.createOscillator();
        
        // Setup stereo panning
        const leftPan = audioCtx.createStereoPanner();
        const rightPan = audioCtx.createStereoPanner();
        leftPan.pan.value = -1;
        rightPan.pan.value = 1;
        
        leftOsc.frequency.value = baseFreq;
        rightOsc.frequency.value = baseFreq + currentFreqDiff;
        
        leftOsc.connect(leftPan);
        rightOsc.connect(rightPan);
        
        leftPan.connect(gainNode);
        rightPan.connect(gainNode);
        
        leftOsc.start();
        rightOsc.start();
        isPlaying = true;
        if (playIcon) {
            playIcon.classList.remove('fa-play');
            playIcon.classList.add('fa-pause');
        }
    }

    function stopBinauralBeats() {
        if (leftOsc) leftOsc.stop();
        if (rightOsc) rightOsc.stop();
        isPlaying = false;
        if (playIcon) {
            playIcon.classList.remove('fa-pause');
            playIcon.classList.add('fa-play');
        }
    }

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (isPlaying) {
                stopBinauralBeats();
            } else {
                startBinauralBeats();
            }
        });
    }

    if (volSlider) {
        volSlider.addEventListener('input', (e) => {
            if (gainNode) {
                gainNode.gain.value = e.target.value / 100;
            }
        });
    }

    soundOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            soundOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            currentFreqDiff = parseFloat(opt.dataset.freq);
            if (nowPlaying) nowPlaying.textContent = opt.dataset.name;
            
            if (isPlaying) {
                stopBinauralBeats();
                startBinauralBeats();
            }
        });
    });

    // --- Journal Interactions ---
    const newEntryBtn = document.getElementById('new-entry-btn');
    const cancelEntryBtn = document.getElementById('cancel-entry');
    const saveEntryBtn = document.getElementById('save-entry-btn');
    const journalWrite = document.getElementById('journal-write');
    const journalTitle = document.getElementById('journal-title');
    const journalContent = document.getElementById('journal-content');
    
    let selectedJournalEmoji = '😐';
    const journalEmojis = document.querySelectorAll('#journal-emoji-pick .emoji-sm');
    journalEmojis.forEach(btn => {
        btn.addEventListener('click', () => {
            journalEmojis.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedJournalEmoji = btn.dataset.emoji;
        });
    });

    if (newEntryBtn && journalWrite) {
        newEntryBtn.addEventListener('click', () => {
            journalWrite.style.display = 'block';
            newEntryBtn.style.display = 'none';
        });
    }

    if (cancelEntryBtn) {
        cancelEntryBtn.addEventListener('click', () => {
            journalWrite.style.display = 'none';
            newEntryBtn.style.display = 'inline-block';
            if (journalTitle) journalTitle.value = '';
            if (journalContent) journalContent.value = '';
        });
    }

    if (saveEntryBtn) {
        saveEntryBtn.addEventListener('click', async () => {
            const title = journalTitle ? journalTitle.value.trim() : '';
            const content = journalContent ? journalContent.value.trim() : '';
            
            if (!content) {
                alert('Journal content cannot be empty.');
                return;
            }
            
            saveEntryBtn.disabled = true;
            try {
                const res = await fetch('/api/journal', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ title, content, mood_emoji: selectedJournalEmoji })
                });
                
                if (res.ok) {
                    journalWrite.style.display = 'none';
                    newEntryBtn.style.display = 'inline-block';
                    if (journalTitle) journalTitle.value = '';
                    if (journalContent) journalContent.value = '';
                    fetchJournals();
                } else {
                    alert('Failed to save journal entry.');
                }
            } catch(err) {
                console.error('Error saving journal:', err);
                alert('Network error.');
            } finally {
                saveEntryBtn.disabled = false;
            }
        });
    }

    // --- Aura Chat Integration ---
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');

    function appendMessage(text, isUser = true) {
        if (!chatMessages) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${isUser ? 'user' : 'aura'}`;

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.textContent = text;
        msgDiv.appendChild(bubble);

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function handleSend() {
        const text = chatInput.value.trim();
        if(text) {
            appendMessage(text, true);
            chatInput.value = '';
            
            // Show typing indicator
            const typingId = 'typing-' + Date.now();
            const typingDiv = document.createElement('div');
            typingDiv.id = typingId;
            typingDiv.className = 'msg aura';
            const typingBubble = document.createElement('div');
            typingBubble.className = 'msg-bubble';
            typingBubble.textContent = '...';
            typingDiv.appendChild(typingBubble);
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const res = await fetch('/api/aura/chat', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ message: text })
                });
                
                const data = await res.json();
                
                // Remove typing indicator
                const tDiv = document.getElementById(typingId);
                if(tDiv) tDiv.remove();

                if(res.ok && data.response) {
                    appendMessage(data.response, false);
                } else {
                    appendMessage("Sorry, I'm having trouble connecting right now.", false);
                }
            } catch(err) {
                const tDiv = document.getElementById(typingId);
                if(tDiv) tDiv.remove();
                appendMessage("Network error. Please try again later.", false);
            }
        }
    }

    if(sendBtn && chatInput) {
        sendBtn.addEventListener('click', handleSend);
        chatInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') handleSend();
        });
    }

});
