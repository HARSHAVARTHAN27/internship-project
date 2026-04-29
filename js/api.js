// api.js — shared data layer for PlaceIQ

const STORAGE_KEY = 'placeiq_added_students';

async function loadStudents() {
  let base = [];
  try {
    const res = await fetch('http://127.0.0.1:5000/api/students');
    if (!res.ok) throw new Error('fetch failed');
    base = await res.json();
  } catch (e) {
    console.warn('Could not load students from Flask:', e);
  }
  const added = getAddedStudents();
  // Merge but avoid duplicates by email
  const emails = new Set(base.map(s => (s.email || '').toLowerCase()));
  const names  = new Set(base.map(s => s.name.toLowerCase()));
  const unique = added.filter(s =>
    !emails.has((s.email || '').toLowerCase()) &&
    !names.has(s.name.toLowerCase())
  );
  return [...base, ...unique];
}

function getAddedStudents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveStudent(student) {
  const list = getAddedStudents();
  list.push(student);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function removeAddedStudent(index) {
  const list = getAddedStudents();
  list.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function deptStats(students) {
  return ['CSE','ECE','ME','CE'].map(dept => {
    const g = students.filter(s => s.dept === dept);
    const avg = g.length ? Math.round(g.reduce((a,s) => a + s.placementChance, 0) / g.length) : 0;
    return { dept, avg, count: g.length };
  });
}

function statusBadge(pct) {
  if (pct >= 70) return `<span class="stat-badge badge-green">High</span>`;
  if (pct >= 40) return `<span class="stat-badge badge-amber">Moderate</span>`;
  return `<span class="stat-badge badge-red">At Risk</span>`;
}

function pctColor(pct) {
  if (pct >= 70) return '#00D4AA';
  if (pct >= 40) return '#F5A623';
  return '#FF6B6B';
}

function setNavActive() {
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.getAttribute('href') === page);
  });
}
// ── ML Prediction API ──────────────────────────────────────────────────────────
async function predictPlacement(studentData) {
  try {
    const res = await fetch('http://127.0.0.1:5000/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cgpa:        studentData.cgpa,
        attendance:  studentData.attendance,
        resumeScore: studentData.resumeScore,
        dept:        studentData.dept
      })
    });

    if (!res.ok) throw new Error('Prediction failed');
    const result = await res.json();
    return result; // { placementChance, placed, dept, cgpa, attendance, resumeScore }

  } catch (e) {
    console.error('Prediction API error:', e);
    return null;
  }
}

