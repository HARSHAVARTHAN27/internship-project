// theme.js — Handles Light/Dark mode toggling globally

function getSavedTheme() {
  return localStorage.getItem('placeiq_theme') || 'dark';
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = theme === 'light' ? '#475569' : '#94a3b8';
    
    // Attempt to update charts live if they exist and functions are available
    try {
      if (typeof window.loadProfile === 'function' && document.getElementById('studentSelect') && document.getElementById('studentSelect').value !== '') {
        // Redraw student charts
        window.loadProfile();
      }
      if (typeof window.renderForecast === 'function') {
        // Redraw TPO charts
        window.renderForecast();
      }
    } catch(e) {}
  }
}

function toggleTheme() {
  const current = getSavedTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('placeiq_theme', next);
  applyTheme(next);
  
  const btn = document.getElementById('themeToggleBtn');
  const moonSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const sunSVG  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  if (btn) btn.innerHTML = next === 'light' ? moonSVG : sunSVG;
}

// Immediately apply saved theme to prevent flashing
applyTheme(getSavedTheme());

document.addEventListener('DOMContentLoaded', () => {
  const current = getSavedTheme();
  const btn = document.createElement('button');
  btn.id = 'themeToggleBtn';
  btn.title = 'Toggle Light/Dark Mode';
  const moonSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const sunSVG  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  btn.innerHTML = current === 'light' ? moonSVG : sunSVG;
  btn.style.cssText = `
    background: var(--white-10, rgba(255,255,255,0.1));
    border: 1px solid var(--white-20, rgba(255,255,255,0.2));
    color: var(--text-main, #fff);
    border-radius: 50%;
    width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-size: 18px;
    margin-left: 1rem;
    transition: all 0.3s;
    backdrop-filter: blur(10px);
  `;
  btn.onclick = toggleTheme;
  btn.onmouseover = () => btn.style.background = 'var(--white-20, rgba(255,255,255,0.2))';
  btn.onmouseout = () => btn.style.background = 'var(--white-10, rgba(255,255,255,0.1))';

  const nav = document.querySelector('.nav');
  if (nav) {
    // Inject before the avatar
    const avatar = nav.querySelector('.nav-avatar');
    if (avatar) {
      const rightWrap = document.createElement('div');
      rightWrap.style.display = 'flex';
      rightWrap.style.alignItems = 'center';
      rightWrap.style.gap = '12px';
      avatar.parentNode.insertBefore(rightWrap, avatar);
      rightWrap.appendChild(btn);
      rightWrap.appendChild(avatar);
      btn.style.margin = '0';
    } else {
      nav.appendChild(btn);
    }
  } else {
    // login page
    btn.style.position = 'absolute';
    btn.style.top = '2rem';
    btn.style.right = '2rem';
    document.body.appendChild(btn);
  }
});
