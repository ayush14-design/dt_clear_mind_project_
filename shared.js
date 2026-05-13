const API_BASE = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000/api' 
  : window.location.origin + '/api';
let authToken = localStorage.getItem('cm_token');
let currentUser = JSON.parse(localStorage.getItem('cm_user') || 'null');

function showToast(title, msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-msg').textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(100px)'; }, 3000);
}

function checkAuth() {
  if (!authToken) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem('cm_token');
  localStorage.removeItem('cm_user');
  window.location.href = '/index.html';
}

// Stars background logic for all pages
function initStarsOnPage() {
  const canvas = document.getElementById('stars-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  function init(){
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    stars = Array.from({length:150}, ()=>({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      r:Math.random()*1.2, s:Math.random()*0.3, o:Math.random()
    }));
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    stars.forEach(s=>{
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle=`rgba(255,255,255,${s.o})`; ctx.fill();
      s.y -= s.s; if(s.y<0) s.y=canvas.height;
    });
    requestAnimationFrame(draw);
  }
  window.onresize=init; init(); draw();
}

window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initStarsOnPage();
  applyTranslations();
});

// i18n Logic
let currentLanguage = localStorage.getItem('cm_lang') || 'en';

function changeLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('cm_lang', lang);
    applyTranslations();
  }
}

function applyTranslations() {
  if (typeof translations === 'undefined') return;
  const t = translations[currentLanguage];
  if (!t) return;
  
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = t[key];
      } else {
        // Only replace text nodes if possible, or simple innerHTML
        // Careful with nested elements
        el.innerHTML = t[key];
      }
    }
  });

  // Update language select dropdown if present
  const langSelect = document.getElementById('langSwitcher');
  if (langSelect) {
    langSelect.value = currentLanguage;
  }
}
