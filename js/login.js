// login.js — handles role selection and login routing

let selectedRole = 'student';

function selectRole(btn) {
  document.querySelectorAll('.role-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedRole = btn.dataset.role;
}

function doLogin() {
  const email = document.getElementById('emailInput').value.trim();
  const pass  = document.getElementById('passInput').value.trim();
  const errEl = document.getElementById('errorMsg');

  if (!email || !pass) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }

  errEl.style.display = 'none';

  // Simple demo credentials — replace with real auth
  const creds = {
    student: { email: 'student@placeiq.com', pass: 'student123' },
    tpo:     { email: 'tpo@placeiq.com',     pass: 'tpo123'     },
    admin:   { email: 'admin@placeiq.com',   pass: 'admin123'   },
  };

  const c = creds[selectedRole];
  // In demo mode, accept any non-empty credentials and route by role
  // Remove the condition below and uncomment the one after for strict auth
  const ok = true; // demo: always pass
  // const ok = email === c.email && pass === c.pass;

  if (!ok) {
    errEl.textContent = 'Invalid credentials. Please try again.';
    errEl.style.display = 'block';
    return;
  }

  // Store role so pages can personalise
  sessionStorage.setItem('placeiq_role', selectedRole);
  sessionStorage.setItem('placeiq_user', email);

  const routes = { student: 'student.html', tpo: 'tpo.html', admin: 'admin.html' };
  window.location.href = routes[selectedRole];
}
