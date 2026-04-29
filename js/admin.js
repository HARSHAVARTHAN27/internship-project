// admin.js — Admin Panel

let allStudents = [];
let sessionAdded = 0;
let datasetsUploaded = 0;
let currentDept = 'all';
let currentQuery = '';

async function init() {
  const user = requireLogin(['Admin']);
  if (!user) return;
  injectLogoutButton();
  setNavActive();
  allStudents = await loadStudents();
  renderTable();
  updateStats();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 3000);
}

function flash(el, msg) {
  el.classList.add('error'); el.placeholder = msg;
  setTimeout(() => { el.classList.remove('error'); el.placeholder = ''; }, 2000);
}

async function addStudent() {
  const nameEl       = document.getElementById('inputName');
  const emailEl      = document.getElementById('inputEmail');
  const deptEl       = document.getElementById('inputDept');
  const cgpaEl       = document.getElementById('inputCgpa');
  const attendanceEl = document.getElementById('inputAttendance');
  const resumeEl     = document.getElementById('inputResumeScore');

  const name        = nameEl.value.trim();
  const email       = emailEl.value.trim();
  const dept        = deptEl.value.trim();
  const cgpa        = parseFloat(cgpaEl.value);
  const attendance  = parseInt(attendanceEl.value);
  const resumeScore = parseInt(resumeEl.value);

  if (!name)                                               { flash(nameEl, 'Enter a name'); return; }
  if (!email)                                              { flash(emailEl, 'Enter email'); return; }
  if (!dept)                                               { flash(deptEl, 'Select department'); return; }
  if (isNaN(cgpa) || cgpa < 0 || cgpa > 10)               { flash(cgpaEl, 'CGPA must be 0–10'); return; }
  if (isNaN(attendance) || attendance < 0 || attendance > 100) { flash(attendanceEl, 'Must be 0–100'); return; }
  if (isNaN(resumeScore) || resumeScore < 0 || resumeScore > 100) { flash(resumeEl, 'Must be 0–100'); return; }

  const resultBox     = document.getElementById('addResult');
  const resultContent = document.getElementById('addResultContent');
  resultBox.style.display = 'block';
  resultContent.innerHTML = '<span style="color:var(--text3);">🤖 Running AI prediction...</span>';

  const prediction = await predictPlacement({ cgpa, attendance, resumeScore, dept });
  const placementChance = prediction ? prediction.placementChance : Math.round((cgpa/10)*40 + (attendance/100)*30 + (resumeScore/100)*30);
  const placed = prediction ? prediction.placed : (placementChance >= 60 ? 'Placed' : 'Not Placed');

  const s = { name, email, dept, cgpa, attendance, resumeScore, placementChance, placed, _addedViaAdmin: true };

  // Save to students.json via backend
  try {
    await fetch('http://127.0.0.1:5000/api/add_student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, dept, cgpa, attendance, resumeScore, placementChance, placed })
    });
  } catch(e) {
    console.warn('Could not save to backend:', e);
  }

  saveStudent(s);
  allStudents.push(s);
  sessionAdded++;

  const isPlaced = placed === 'Placed';
  resultContent.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;">Student</div><div style="font-size:15px;font-weight:700;color:var(--text1);">${name}</div></div>
      <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;">Email</div><div style="font-size:15px;font-weight:700;color:var(--text1);">${email}</div></div>
      <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;">Dept</div><div style="font-size:15px;font-weight:700;color:var(--text1);">${dept}</div></div>
      <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;">CGPA</div><div style="font-size:15px;font-weight:700;color:var(--text1);">${cgpa}</div></div>
      <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;">Placement Chance</div><div style="font-size:15px;font-weight:700;color:var(--accent);">${placementChance}%</div></div>
      <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;">AI Prediction</div><div style="font-size:15px;font-weight:700;color:${isPlaced?'#00D4AA':'#FF6B6B'};">${isPlaced?'✓ Placed':'✗ Not Placed'}</div></div>
    </div>`;

  nameEl.value = ''; emailEl.value = ''; deptEl.value = ''; cgpaEl.value = ''; attendanceEl.value = ''; resumeEl.value = '';
  renderTable(); updateStats();
  toast(`✓ ${name} added — ${placed}`);
}

function exportCSV() {
  const headers = ['Name','Dept','CGPA','Attendance','Resume Score','Placement Chance','AI Prediction'];
  const rows = allStudents.map(s => [
    s.name, s.dept, s.cgpa, s.attendance, s.resumeScore, s.placementChance + '%',
    s.placed || (s.placementChance >= 60 ? 'Placed' : 'Not Placed')
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'placeiq_students.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('✓ CSV exported!');
}

function handleUpload(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  toast('⏳ Processing CSV...');
  const reader = new FileReader();
  reader.onload = async function(ev) {
    const text    = ev.target.result;
    const lines   = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows    = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim());
      const obj  = {};
      headers.forEach((h, idx) => obj[h] = vals[idx]);
      rows.push(obj);
    }
    const results = [];
    for (const row of rows) {
      const cgpa        = parseFloat(row.cgpa) || 0;
      const attendance  = parseFloat(row.attendance) || 75;
      const resumeScore = parseFloat(row.resumescore || row.resume_score || row.resumeScore) || 50;
      const dept        = row.dept || 'CSE';
      const name        = row.name || 'Student';
      const prediction  = await predictPlacement({ cgpa, attendance, resumeScore, dept });
      const placementChance = prediction ? prediction.placementChance : 50;
      const placed = prediction ? prediction.placed : 'Not Placed';
      const s = { name, dept, cgpa, attendance, resumeScore, placementChance, placed, _addedViaAdmin: true };
      results.push(s); saveStudent(s); allStudents.push(s);
    }
    sessionAdded += results.length; datasetsUploaded++;
    renderTable(); updateStats();
    toast(`✓ ${results.length} students predicted from CSV`);
    document.getElementById('predictionResults').innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px;">✓ ${results.length} students processed</div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Name</th><th>Dept</th><th>CGPA</th><th>Attendance</th><th>Resume Score</th><th>Placement Chance</th><th>AI Prediction</th></tr></thead>
        <tbody>${results.map(s => `<tr><td>${s.name}</td><td>${s.dept}</td><td>${s.cgpa}</td><td>${s.attendance}%</td><td>${s.resumeScore}</td><td>${s.placementChance}%</td><td style="color:${s.placed==='Placed'?'#00D4AA':'#FF6B6B'};font-weight:600;">${s.placed==='Placed'?'✓ Placed':'✗ Not Placed'}</td></tr>`).join('')}</tbody>
      </table></div>`;
  };
  reader.readAsText(file);
}

function deleteStudent(globalIdx) {
  const s = allStudents[globalIdx];
  if (!s._addedViaAdmin) { toast('⚠ Base students cannot be removed'); return; }
  const added = getAddedStudents();
  const i = added.findIndex(a => a.name === s.name && a.dept === s.dept);
  if (i !== -1) removeAddedStudent(i);
  allStudents.splice(globalIdx, 1);
  renderTable(); updateStats();
  toast(`Removed ${s.name}`);
}

function renderTable() {
  const tbody   = document.getElementById('recordsTbody');
  const countEl = document.getElementById('recordCount');
  const filtered = allStudents.filter(s => {
    const deptMatch = currentDept === 'all' || s.dept === currentDept;
    const nameMatch = s.name.toLowerCase().includes(currentQuery.toLowerCase());
    return deptMatch && nameMatch;
  });
  countEl.textContent = filtered.length + ' record' + (filtered.length !== 1 ? 's' : '');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text3);">No records found</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map((s, i) => {
    const chance  = s.placementChance;
    const color   = chance >= 70 ? '#00D4AA' : chance >= 40 ? '#F5A623' : '#FF6B6B';
    const badge   = chance >= 70 ? 'High' : chance >= 40 ? 'Moderate' : 'At Risk';
    const placed  = s.placed || (chance >= 60 ? 'Placed' : 'Not Placed');
    const isPlaced = placed === 'Placed';
    return `<tr>
      <td>${i+1}</td>
      <td style="font-weight:600;">${s.name}</td>
      <td><span class="stat-badge badge-purple">${s.dept}</span></td>
      <td>${s.cgpa}</td>
      <td>${s.attendance}%</td>
      <td>${s.resumeScore}/100</td>
      <td><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;height:6px;background:var(--bg);border-radius:3px;overflow:hidden;"><div style="width:${chance}%;height:100%;background:${color};border-radius:3px;"></div></div><span style="font-size:12px;font-weight:600;color:${color};min-width:36px;">${chance}%</span></div></td>
      <td style="font-weight:700;color:${isPlaced?'#00D4AA':'#FF6B6B'};">${isPlaced?'✓ Placed':'✗ Not Placed'}</td>
      <td><span class="stat-badge ${chance>=70?'badge-green':chance>=40?'badge-amber':'badge-red'}">${badge}</span></td>
      <td>${s._addedViaAdmin?`<button class="remove-btn" onclick="deleteStudent(${i})">Remove</button>`:`<span style="font-size:12px;color:var(--text3);">Base</span>`}</td>
    </tr>`;
  }).join('');
}

function updateStats() {
  document.getElementById('statTotal').textContent    = allStudents.length;
  document.getElementById('statAdded').textContent    = sessionAdded;
  document.getElementById('statDatasets').textContent = datasetsUploaded;
  document.getElementById('statAtRisk').textContent   = allStudents.filter(s => s.placementChance < 40).length;
  document.getElementById('statHigh').textContent     = allStudents.filter(s => s.placementChance > 80).length;
}

function applyFilter(dept, btn) {
  currentDept = dept;
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTable();
}

function applySearch() {
  currentQuery = document.getElementById('adminSearch').value;
  renderTable();
}

init();