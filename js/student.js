// student.js — Student Dashboard logic

let allStudents = [];
let attChart, subChart, resChart, donutChart;
let currentUser = null;

function getChartData(s) {
  // Generate realistic chart data based on the student's actual performance metrics
  const baseAtt = s.attendance;
  const attData = [
    Math.min(100, Math.max(0, baseAtt - 8 + Math.floor(Math.random()*10))),
    Math.min(100, Math.max(0, baseAtt - 5 + Math.floor(Math.random()*8))),
    Math.min(100, Math.max(0, baseAtt - 2 + Math.floor(Math.random()*9))),
    Math.min(100, Math.max(0, baseAtt - 4 + Math.floor(Math.random()*6))),
    Math.min(100, Math.max(0, baseAtt - 1 + Math.floor(Math.random()*4))),
    baseAtt // The current month matches their exact attendance
  ];

  const baseMarks = s.cgpa * 10;
  const subData = [
    Math.min(100, Math.max(0, baseMarks - 6 + Math.floor(Math.random()*12))),
    Math.min(100, Math.max(0, baseMarks - 3 + Math.floor(Math.random()*8))),
    Math.min(100, Math.max(0, baseMarks + 4 - Math.floor(Math.random()*8))),
    Math.min(100, Math.max(0, baseMarks - 2 + Math.floor(Math.random()*6))),
    Math.min(100, Math.max(0, baseMarks + 5 - Math.floor(Math.random()*10)))
  ];

  const baseRes = s.resumeScore;
  const resData = [
    Math.min(100, Math.max(0, baseRes - 10 + Math.floor(Math.random()*20))),
    Math.min(100, Math.max(0, baseRes - 5 + Math.floor(Math.random()*10))),
    Math.min(100, Math.max(0, baseRes + 5 - Math.floor(Math.random()*10))),
    Math.min(100, Math.max(0, baseRes - 8 + Math.floor(Math.random()*16))),
    Math.min(100, Math.max(0, baseRes + 8 - Math.floor(Math.random()*16)))
  ];

  return {
    attendance: attData,
    subjects: { labels: ['DSA','OS','DBMS','CN','ML'], data: subData },
    resume: { labels: ['Projects','Skills','Exp','Edu','Achiev'], data: resData }
  };
}

async function init() {
  // Session protection
  currentUser = requireLogin(['Student', 'Admin']);
  if (!currentUser) return;
  injectLogoutButton();
  setNavActive();

  // Personalized greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetEl = document.getElementById('dashGreeting');
  if (greetEl) greetEl.textContent = `${greet}, ${currentUser.name.split(' ')[0]} 👋`;

  allStudents = await loadStudents();

  const selectWrap = document.getElementById('selectWrap');
  const sel        = document.getElementById('studentSelect');

  if (currentUser.role === 'Admin') {
    // Admin — show dropdown with all students
    selectWrap.style.display = 'flex';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Select a student...';
    sel.appendChild(defaultOpt);

    allStudents.forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${s.name} — ${s.dept}`;
      sel.appendChild(opt);
    });

    showEmptyState();

  } else {
    // Student — hide dropdown, auto-load their own profile
    selectWrap.style.display = 'none';

    // Match by email first, then roll number, then full name, then first name
    const loginEmail = (currentUser.email || '').toLowerCase().trim();
    const loginName  = currentUser.name.toLowerCase().trim();
    const loginRoll  = (currentUser.roll  || '').toLowerCase().trim();
    const loginFirst = loginName.split(' ')[0];

    const matchIdx = allStudents.findIndex(s => {
      const sEmail = (s.email || '').toLowerCase().trim();
      const sName  = s.name.toLowerCase().trim();
      const sFirst = sName.split(' ')[0];
      const sRoll  = (s.roll  || '').toLowerCase().trim();
      return (
        (loginEmail && sEmail === loginEmail) ||  // email match (most reliable)
        (loginRoll  && sRoll  === loginRoll)  ||  // roll number match
        sName  === loginName                  ||  // full name match
        sFirst === loginFirst                     // first name match
      );
    });

    if (matchIdx !== -1) {
      const opt = document.createElement('option');
      opt.value = matchIdx;
      sel.appendChild(opt);
      sel.value = matchIdx;
      loadProfile();
    } else {
      // No match found — show friendly message with login info
      showNoProfileState();
    }
  }
}

function showEmptyState() {
  document.getElementById('profileAvatar').textContent  = '?';
  document.getElementById('profileName').textContent    = 'Select a Student';
  document.getElementById('navAvatar') && (document.getElementById('navAvatar').textContent = currentUser ? currentUser.name[0].toUpperCase() : 'A');
  document.getElementById('profileMeta').innerHTML = `<div class="profile-badge"><div class="profile-badge-dot"></div>No student selected</div>`;
  document.getElementById('mAttendance').textContent    = '—';
  document.getElementById('mAttBadge').innerHTML        = '';
  document.getElementById('mResume').textContent        = '—';
  document.getElementById('mResBadge').innerHTML        = '';
  document.getElementById('mPlacement').textContent     = '—';
  document.getElementById('mPlcBadge').innerHTML        = '';
  document.getElementById('mAIPrediction').textContent  = '—';
  document.getElementById('mAIPrediction').style.color  = 'var(--text1)';
  document.getElementById('mAIBadge').innerHTML         = '';
  document.getElementById('donutPct').textContent       = '—';
  document.getElementById('readinessLabel').textContent = 'Select a student to view';
  document.getElementById('skillGapList').innerHTML     = '';
  if (attChart)   { attChart.destroy();   attChart   = null; }
  if (subChart)   { subChart.destroy();   subChart   = null; }
  if (resChart)   { resChart.destroy();   resChart   = null; }
  if (donutChart) { donutChart.destroy(); donutChart = null; }
}

function showNoProfileState() {
  document.getElementById('profileAvatar').textContent  = currentUser.name[0].toUpperCase();
  document.getElementById('profileName').textContent    = currentUser.name;
  document.getElementById('profileMeta').innerHTML = `
    <div class="profile-badge"><div class="profile-badge-dot"></div>Department: ${currentUser.dept}</div>
    <div class="profile-badge"><div class="profile-badge-dot"></div>Roll No: ${currentUser.roll}</div>
  `;
  document.getElementById('mAttendance').textContent    = '—';
  document.getElementById('mAttBadge').innerHTML        = '<span class="stat-badge badge-amber">Not in database</span>';
  document.getElementById('mResume').textContent        = '—';
  document.getElementById('mResBadge').innerHTML        = '<span class="stat-badge badge-amber">Not in database</span>';
  document.getElementById('mPlacement').textContent     = '—';
  document.getElementById('mPlcBadge').innerHTML        = '<span class="stat-badge badge-amber">Not in database</span>';
  document.getElementById('mAIPrediction').textContent  = '—';
  document.getElementById('mAIBadge').innerHTML         = '';
  document.getElementById('donutPct').textContent       = '—';
  document.getElementById('readinessLabel').textContent = 'Your profile is not in the database yet';
  document.getElementById('skillGapList').innerHTML     = `
    <div class="gap-item">
      <div class="gap-bullet" style="background:#F5A623;"></div>
      <div class="gap-text">Your academic data has not been added yet. Please contact your Admin to add your profile.</div>
    </div>`;
}

function loadProfile() {
  const idx = document.getElementById('studentSelect').value;
  if (idx === '' || idx === null) { showEmptyState(); return; }

  const s = allStudents[parseInt(idx)];
  if (!s) return;

  document.getElementById('profileAvatar').textContent = s.name[0];
  document.getElementById('profileName').textContent   = s.name;

  document.getElementById('profileMeta').innerHTML = `
    <div class="profile-badge"><div class="profile-badge-dot"></div>Department: ${s.dept}</div>
    <div class="profile-badge"><div class="profile-badge-dot"></div>Semester 7</div>
    <div class="profile-badge"><div class="profile-badge-dot"></div>CGPA: ${s.cgpa}</div>
  `;

  document.getElementById('mAttendance').textContent = s.attendance + '%';
  document.getElementById('mAttBadge').innerHTML = s.attendance >= 80
    ? '<span class="stat-badge badge-green">✓ Above threshold</span>'
    : '<span class="stat-badge badge-amber">⚠ Below 80%</span>';

  document.getElementById('mResume').textContent = s.resumeScore + ' / 100';
  document.getElementById('mResBadge').innerHTML = s.resumeScore >= 75
    ? '<span class="stat-badge badge-green">Good</span>'
    : '<span class="stat-badge badge-amber">Moderate</span>';

  document.getElementById('mPlacement').textContent = s.placementChance + '%';
  document.getElementById('mPlcBadge').innerHTML = s.placementChance >= 70
    ? '<span class="stat-badge badge-green">↑ High chance</span>'
    : s.placementChance >= 40
      ? '<span class="stat-badge badge-amber">Moderate</span>'
      : '<span class="stat-badge badge-red">Needs work</span>';

  document.getElementById('donutPct').textContent = s.placementChance + '%';

  const rRow = document.getElementById('readinessRow');
  const rDot  = document.getElementById('readinessDot');
  const rLbl  = document.getElementById('readinessLabel');
  if (s.placementChance >= 70) {
    rRow.style.borderColor = 'rgba(16, 185, 129, 0.3)'; rRow.style.background = 'rgba(16, 185, 129, 0.1)';
    rDot.style.background  = '#34d399'; rLbl.textContent = 'Placement Ready ✓'; rLbl.style.color = '#34d399';
  } else if (s.placementChance >= 40) {
    rRow.style.borderColor = 'rgba(245, 166, 35, 0.3)'; rRow.style.background = 'rgba(245, 166, 35, 0.1)';
    rDot.style.background  = '#fbbf24'; rLbl.textContent = 'Needs Improvement ⚠'; rLbl.style.color = '#fbbf24';
  } else {
    rRow.style.borderColor = 'rgba(239, 68, 68, 0.3)'; rRow.style.background = 'rgba(239, 68, 68, 0.1)';
    rDot.style.background  = '#f87171'; rLbl.textContent = 'At Risk ✗'; rLbl.style.color = '#f87171';
  }

  const gaps = [];
  if (s.resumeScore < 75)
    gaps.push({ color:'#FF6B6B', text: 'Resume score is below 75 — this is the #1 rejection reason. Add projects, certifications and skills urgently.' });
  if (s.resumeScore >= 75)
    gaps.push({ color:'#00D4AA', text: 'Resume score is good — keep it updated with latest projects and internships.' });
  if (s.attendance < 80)
    gaps.push({ color:'#F5A623', text: 'Attendance below 80% — many companies verify this during background checks. Improve immediately.' });
  if (s.attendance >= 80)
    gaps.push({ color:'#00D4AA', text: 'Attendance is above threshold — maintain this throughout the semester.' });
  if (s.cgpa < 7.0)
    gaps.push({ color:'#FF6B6B', text: 'CGPA below 7.0 — focus on upcoming exams to improve your academic standing.' });
  if (s.cgpa >= 7.0 && s.cgpa < 8.0)
    gaps.push({ color:'#F5A623', text: 'CGPA is average — aim for 8.0+ to qualify for top product-based companies.' });
  if (s.cgpa >= 8.0)
    gaps.push({ color:'#00D4AA', text: 'CGPA is strong — you qualify for most placement drives including top-tier companies.' });
  if (s.placementChance < 50)
    gaps.push({ color:'#FF6B6B', text: 'Overall placement chance is low — focus on resume, DSA practice and mock interviews urgently.' });

  document.getElementById('skillGapList').innerHTML = gaps.map(g =>
    `<div class="gap-item"><div class="gap-bullet" style="background:${g.color};"></div><div class="gap-text">${g.text}</div></div>`
  ).join('');

  renderCharts(s);
  updateAIPrediction(s);
}

async function updateAIPrediction(student) {
  const predEl  = document.getElementById('mAIPrediction');
  const badgeEl = document.getElementById('mAIBadge');
  predEl.textContent = '...';
  badgeEl.innerHTML  = '';
  const result = await predictPlacement({
    cgpa: student.cgpa, attendance: student.attendance,
    resumeScore: student.resumeScore, dept: student.dept
  });
  if (!result) {
    predEl.textContent = 'Error';
    badgeEl.innerHTML  = '<span class="stat-badge badge-red">API Offline</span>';
    return;
  }
  const isPlaced = result.placed === 'Placed';
  predEl.textContent = result.placed;
  predEl.style.color = isPlaced ? '#34d399' : '#f87171';
  badgeEl.innerHTML  = isPlaced
    ? `<span class="stat-badge badge-green">↑ ${result.placementChance}% chance</span>`
    : `<span class="stat-badge badge-red">↓ ${result.placementChance}% chance</span>`;
}

function renderCharts(s) {
  const cd = getChartData(s);
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.color       = '#94a3b8';
  Chart.defaults.animation   = { duration: 2000, easing: 'easeOutQuart' };
  
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const radarGrid = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
  const radarText = isLight ? '#475569' : '#94a3b8';
  const donutBg = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

  // Attendance Line Chart
  if (attChart) attChart.destroy();
  const attCtx = document.getElementById('attendanceChart').getContext('2d');
  const attGradient = attCtx.createLinearGradient(0, 0, 0, 300);
  attGradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
  attGradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  attChart = new Chart(attCtx, {
    type: 'line',
    data: {
      labels: ['Aug','Sep','Oct','Nov','Dec','Jan'],
      datasets: [{ label: 'Attendance %', data: cd.attendance, borderColor: '#6366f1', backgroundColor: attGradient, borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#fff', pointBorderColor: '#6366f1', pointBorderWidth: 2, pointRadius: 0, pointHoverRadius: 6, pointHitRadius: 10 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { padding: 12, cornerRadius: 8, titleFont: { size: 13 }, bodyFont: { size: 13 } } }, interaction: { mode: 'index', intersect: false }, scales: { y: { min: 50, max: 100, grid: { color: gridColor, borderDash: [5, 5], drawBorder: false }, ticks: { callback: v => v + '%', font: { size: 11 }, padding: 10 } }, x: { grid: { display: false, drawBorder: false }, ticks: { font: { size: 11 }, padding: 10 } } } }
  });

  // Subjects Bar Chart
  if (subChart) subChart.destroy();
  const subCtx = document.getElementById('subjectChart').getContext('2d');
  const subGradient1 = subCtx.createLinearGradient(0, 0, 0, 300); subGradient1.addColorStop(0, '#8b5cf6'); subGradient1.addColorStop(1, '#6366f1');
  const subGradient2 = subCtx.createLinearGradient(0, 0, 0, 300); subGradient2.addColorStop(0, '#34d399'); subGradient2.addColorStop(1, '#10b981');
  const subGradient3 = subCtx.createLinearGradient(0, 0, 0, 300); subGradient3.addColorStop(0, '#ec4899'); subGradient3.addColorStop(1, '#f43f5e');
  const subGradient4 = subCtx.createLinearGradient(0, 0, 0, 300); subGradient4.addColorStop(0, '#f59e0b'); subGradient4.addColorStop(1, '#d97706');
  const subGradient5 = subCtx.createLinearGradient(0, 0, 0, 300); subGradient5.addColorStop(0, '#0ea5e9'); subGradient5.addColorStop(1, '#0284c7');

  subChart = new Chart(subCtx, {
    type: 'bar',
    data: { labels: cd.subjects.labels, datasets: [{ label: 'Marks', data: cd.subjects.data, backgroundColor: [subGradient1, subGradient2, subGradient3, subGradient4, subGradient5], borderRadius: 8, borderSkipped: false, barThickness: 24 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { padding: 12, cornerRadius: 8 } }, scales: { y: { min: 0, max: 100, grid: { color: gridColor, borderDash: [5, 5], drawBorder: false }, ticks: { font: { size: 11 }, padding: 10 } }, x: { grid: { display: false, drawBorder: false }, ticks: { font: { size: 11 }, padding: 10 } } } }
  });

  // Resume Radar Chart
  if (resChart) resChart.destroy();
  const resCtx = document.getElementById('resumeChart').getContext('2d');
  resChart = new Chart(resCtx, {
    type: 'radar',
    data: { labels: cd.resume.labels, datasets: [{ label: 'Score', data: cd.resume.data, borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.25)', borderWidth: 2.5, pointBackgroundColor: '#fff', pointBorderColor: '#ec4899', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { padding: 12, cornerRadius: 8 } }, scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: radarGrid, circular: true }, angleLines: { color: radarGrid }, pointLabels: { font: { size: 11, weight: '600' }, color: radarText, padding: 15 } } } }
  });

  // Placement Probability Doughnut Chart
  if (donutChart) donutChart.destroy();
  const donutCtx = document.getElementById('donutChart').getContext('2d');
  donutChart = new Chart(donutCtx, {
    type: 'doughnut',
    data: { datasets: [{ data: [s.placementChance, 100 - s.placementChance], backgroundColor: ['#8b5cf6', donutBg], borderWidth: 0, borderRadius: [20, 0], hoverOffset: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  });
}

init();