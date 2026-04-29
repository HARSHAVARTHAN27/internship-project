// auth.js — Session protection + logout for all pages

function getUser() {
  try { return JSON.parse(localStorage.getItem('placeiq_user')); }
  catch { return null; }
}

function requireLogin(allowedRoles) {
  const user = getUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

function logout() {
  localStorage.removeItem('placeiq_user');
  window.location.href = 'login.html';
}

function injectLogoutButton(avatarLetter) {
  const user = getUser();
  if (!user) return;

  // Update avatar letter and setup dropdown
  const avatar = document.querySelector('.nav-avatar');
  if (avatar) {
    avatar.textContent = user.name[0].toUpperCase();
    avatar.style.cursor = 'pointer';
    avatar.title = `View Profile & Settings`;
  }

  // Inject profile dropdown in nav
  const nav = document.querySelector('.nav');
  if (nav && avatar && !document.getElementById('profileDropdown')) {
    const dropdown = document.createElement('div');
    dropdown.id = 'profileDropdown';
    dropdown.style.cssText = `
      position: absolute;
      top: 70px;
      right: 2.5rem;
      background: var(--nav-dropdown-bg, rgba(15, 23, 42, 0.95));
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid var(--border-light, rgba(255,255,255,0.1));
      border-radius: 12px;
      padding: 8px 0;
      min-width: 220px;
      box-shadow: 0 15px 50px var(--black-80, rgba(0,0,0,0.8)), 0 0 0 1px var(--white-05, rgba(255,255,255,0.05));
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      font-family: var(--font-body);
    `;

    // Dropdown arrow (caret)
    const caret = document.createElement('div');
    caret.style.cssText = `
      position: absolute;
      top: -6px;
      right: 18px;
      width: 12px;
      height: 12px;
      background: var(--nav-dropdown-bg, rgba(15, 23, 42, 0.95));
      border-top: 1px solid var(--border-light, rgba(255,255,255,0.1));
      border-left: 1px solid var(--border-light, rgba(255,255,255,0.1));
      transform: rotate(45deg);
      z-index: -1;
    `;
    dropdown.appendChild(caret);

    dropdown.innerHTML += `
      <div style="padding: 14px 20px; border-bottom: 1px solid var(--white-08); margin-bottom: 4px;">
        <div style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 3px;">${user.name}</div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">${user.role}</div>
      </div>
      
      <a href="profile.html" style="display: flex; align-items: center; gap: 12px; padding: 10px 20px; font-size: 13px; font-weight: 600; color: var(--text-main); text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #818cf8;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        My Profile
      </a>
      
      <a href="#" onclick="openSettings(); return false;" style="display: flex; align-items: center; gap: 12px; padding: 10px 20px; font-size: 13px; font-weight: 600; color: var(--text-main); text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        Settings
      </a>
      
      <div style="height: 1px; background: var(--white-08); margin: 6px 0;"></div>
      
      <a href="#" id="dropLogoutBtn" style="display: flex; align-items: center; gap: 12px; padding: 10px 20px; font-size: 13px; font-weight: 600; color: #f87171; text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='transparent'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        Logout
      </a>
    `;

    nav.appendChild(dropdown);

    document.getElementById('dropLogoutBtn').onclick = (e) => {
      e.preventDefault();
      if (confirm(`Logout as ${user.name}?`)) logout();
    };

    avatar.onclick = (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.visibility === 'visible';
      dropdown.style.opacity = isVisible ? '0' : '1';
      dropdown.style.visibility = isVisible ? 'hidden' : 'visible';
      dropdown.style.transform = isVisible ? 'translateY(-10px)' : 'translateY(0)';
    };

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== avatar) {
        dropdown.style.opacity = '0';
        dropdown.style.visibility = 'hidden';
        dropdown.style.transform = 'translateY(-10px)';
      }
    });
  }

  // ── SETTINGS MODAL & CHANGE PASSWORD ──
  window.openSettings = function() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('.modal-content').style.transform = 'translateY(0)';
      }, 10);
    }
  };

  window.closeSettings = function() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.style.opacity = '0';
      modal.querySelector('.modal-content').style.transform = 'translateY(-20px)';
      setTimeout(() => modal.style.display = 'none', 300);
      
      // Clear inputs
      document.getElementById('cpCurrent').value = '';
      document.getElementById('cpNew').value = '';
      document.getElementById('cpConfirm').value = '';
      document.getElementById('cpAlert').textContent = '';
    }
  };

  window.doChangePassword = async function() {
    const cpCurrent = document.getElementById('cpCurrent').value;
    const cpNew     = document.getElementById('cpNew').value;
    const cpConfirm = document.getElementById('cpConfirm').value;
    const cpAlert   = document.getElementById('cpAlert');

    if (!cpCurrent || !cpNew || !cpConfirm) {
      cpAlert.textContent = 'All fields are required';
      cpAlert.style.color = '#f87171';
      return;
    }
    if (cpNew.length < 6) {
      cpAlert.textContent = 'New password must be at least 6 characters';
      cpAlert.style.color = '#f87171';
      return;
    }
    if (cpNew !== cpConfirm) {
      cpAlert.textContent = 'New passwords do not match';
      cpAlert.style.color = '#f87171';
      return;
    }

    cpAlert.textContent = 'Processing...';
    cpAlert.style.color = '#94a3b8';

    try {
      const res = await fetch('http://127.0.0.1:5000/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, currentPassword: cpCurrent, newPassword: cpNew })
      });
      const data = await res.json();
      if (!res.ok) {
        cpAlert.textContent = data.error || 'Password change failed';
        cpAlert.style.color = '#f87171';
        return;
      }

      cpAlert.textContent = 'Password changed successfully!';
      cpAlert.style.color = '#34d399';
      setTimeout(() => { closeSettings(); }, 1500);
    } catch (e) {
      cpAlert.textContent = 'Failed to connect to server';
      cpAlert.style.color = '#f87171';
    }
  };

  if (!document.getElementById('settingsModal')) {
    const modalHtml = `
      <div id="settingsModal" style="display: none; position: fixed; inset: 0; background: var(--black-60, rgba(0,0,0,0.6)); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 2000; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;">
        <div class="modal-content" style="background: var(--nav-dropdown-bg, rgba(15, 23, 42, 0.95)); padding: 2rem; border-radius: 16px; border: 1px solid var(--border-light, rgba(255,255,255,0.1)); width: 400px; max-width: 90%; box-shadow: 0 20px 50px var(--black-80, rgba(0,0,0,0.8)); transform: translateY(-20px); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: 'Plus Jakarta Sans', sans-serif;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 700; color: var(--text-main, #fff); margin-bottom: 8px;">Account Settings</h3>
          <p style="font-size: 13px; color: var(--text-muted, #94a3b8); margin-bottom: 1.5rem;">Update your password to keep your account secure.</p>
          
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted, #cbd5e1); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Current Password</label>
            <input type="password" id="cpCurrent" style="width: 100%; padding: 12px; background: var(--black-30, rgba(0,0,0,0.3)); border: 1px solid var(--border-light, rgba(255,255,255,0.1)); border-radius: 8px; font-family: inherit; font-size: 14px; color: var(--text-main, #fff); outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent, #6366f1)'" onblur="this.style.borderColor='var(--border-light)'" />
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted, #cbd5e1); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">New Password</label>
            <input type="password" id="cpNew" style="width: 100%; padding: 12px; background: var(--black-30, rgba(0,0,0,0.3)); border: 1px solid var(--border-light, rgba(255,255,255,0.1)); border-radius: 8px; font-family: inherit; font-size: 14px; color: var(--text-main, #fff); outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent, #6366f1)'" onblur="this.style.borderColor='var(--border-light)'" />
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted, #cbd5e1); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Confirm New Password</label>
            <input type="password" id="cpConfirm" style="width: 100%; padding: 12px; background: var(--black-30, rgba(0,0,0,0.3)); border: 1px solid var(--border-light, rgba(255,255,255,0.1)); border-radius: 8px; font-family: inherit; font-size: 14px; color: var(--text-main, #fff); outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent, #6366f1)'" onblur="this.style.borderColor='var(--border-light)'" />
          </div>
          
          <div id="cpAlert" style="font-size: 13px; font-weight: 600; margin-bottom: 1.5rem; min-height: 20px;"></div>
          
          <div style="display: flex; gap: 12px;">
            <button onclick="closeSettings()" style="flex: 1; padding: 12px; background: var(--white-05); border: 1px solid var(--border-light); border-radius: 8px; color: var(--text-main); font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--white-10)'" onmouseout="this.style.background='var(--white-05)'">Cancel</button>
            <button onclick="doChangePassword()" style="flex: 1; padding: 12px; background: var(--accent, #6366f1); border: none; border-radius: 8px; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--accent-hover, #8b5cf6)'" onmouseout="this.style.background='var(--accent, #6366f1)'">Change Password</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // Enforce Navigation Links Visibility
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (user.role === 'Student') {
      // Students can only see student.html
      if (href.includes('admin.html') || href.includes('tpo.html')) {
        link.style.display = 'none';
      }
    } else if (user.role === 'TPO') {
      // TPO can see TPO and Student
      if (href.includes('admin.html')) {
        link.style.display = 'none';
      }
    }
  });
}