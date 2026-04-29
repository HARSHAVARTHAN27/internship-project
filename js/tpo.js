// tpo.js — TPO Dashboard

let allStudents = [];
let currentDept = 'All';
let currentQuery = '';
let forecastChart = null;

async function init() {
  const user = requireLogin(['Admin', 'TPO']);
  if (!user) return;
  injectLogoutButton();
  setNavActive();
  allStudents = await loadStudents();
  updateStats();
  renderTable();
  renderForecast();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 3000);
}

function updateStats() {
  const total = allStudents.length;
  const avg   = total ? Math.round(allStudents.reduce((a, s) => a + s.placementChance, 0) / total) : 0;
  const risk  = allStudents.filter(s => s.placementChance < 40).length;
  const high  = allStudents.filter(s => s.placementChance > 80).length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAvg').textContent   = avg + '%';
  document.getElementById('statRisk').textContent  = risk;
  document.getElementById('statHigh').textContent  = high;
}

function filterTable() {
  currentQuery = document.getElementById('searchInput').value;
  renderTable();
}

function filterDept(btn) {
  currentDept = btn.dataset.dept;
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('tpoBody');
  const filtered = allStudents.filter(s => {
    const deptMatch  = currentDept === 'All' || s.dept === currentDept;
    const nameMatch  = s.name.toLowerCase().includes(currentQuery.toLowerCase());
    return deptMatch && nameMatch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text3);">No students found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, i) => {
    const pct     = s.placementChance;
    const color   = pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171';
    const badge   = pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-amber' : 'badge-red';
    const label   = pct >= 70 ? 'High' : pct >= 40 ? 'Moderate' : 'At Risk';
    const placed  = s.placed || (pct >= 60 ? 'Placed' : 'Not Placed');
    const isPlaced = placed === 'Placed';
    return `<tr>
      <td>${i+1}</td>
      <td style="font-weight:600;">${s.name}</td>
      <td><span class="stat-badge badge-purple">${s.dept}</span></td>
      <td>${s.cgpa}</td>
      <td>${s.attendance}%</td>
      <td>${s.resumeScore}/100</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
          </div>
          <span style="font-size:12px;font-weight:600;color:${color};min-width:36px;">${pct}%</span>
        </div>
      </td>
      <td style="font-weight:700;color:${isPlaced?'#34d399':'#f87171'};">${isPlaced?'✓ Placed':'✗ Not Placed'}</td>
      <td><span class="stat-badge ${badge}">${label}</span></td>
    </tr>`;
  }).join('');
}

function renderForecast() {
  const depts  = ['CSE','ECE','ME','CE'];
  const colors = ['#6366f1','#34d399','#fbbf24','#f87171'];
  const stats  = depts.map(dept => {
    const g   = allStudents.filter(s => s.dept === dept);
    const avg = g.length ? Math.round(g.reduce((a, s) => a + s.placementChance, 0) / g.length) : 0;
    return { dept, avg, count: g.length };
  });

  // Forecast cards
  document.getElementById('forecastGrid').innerHTML = stats.map((s, i) => `
    <div class="fc-card">
      <div class="fc-dept">${s.dept}</div>
      <div class="fc-val" style="color:${colors[i]};">${s.avg}%</div>
      <div class="fc-bar"><div class="fc-fill" style="width:${s.avg}%;background:${colors[i]};"></div></div>
      <div class="fc-lbl">${s.count} student${s.count !== 1 ? 's' : ''}</div>
    </div>
  `).join('');

  // Bar chart
  if (forecastChart) forecastChart.destroy();
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.color       = '#94a3b8';
  Chart.defaults.animation   = { duration: 2000, easing: 'easeOutQuart' };
  
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  const forecastCtx = document.getElementById('forecastChart').getContext('2d');
  const gradientColors = colors.map(c => {
    const grad = forecastCtx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, c);
    grad.addColorStop(1, c + '80'); // add transparency for the bottom
    return grad;
  });

  forecastChart = new Chart(forecastCtx, {
    type: 'bar',
    data: {
      labels: depts,
      datasets: [{
        label: 'Avg Placement %',
        data:  stats.map(s => s.avg),
        backgroundColor: gradientColors,
        borderRadius: 8, borderSkipped: false, barThickness: 32
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { padding: 12, cornerRadius: 8 } },
      scales: {
        y: { min: 0, max: 100, grid: { color: gridColor, borderDash: [5, 5], drawBorder: false }, ticks: { callback: v => v + '%', font: { size: 11 }, padding: 10 } },
        x: { grid: { display: false, drawBorder: false }, ticks: { font: { size: 12, weight: '600' }, padding: 10 } }
      }
    }
  });
}

function exportCSV() {
  const headers = ['Name','Dept','CGPA','Attendance','Resume Score','Placement Chance','AI Prediction'];
  const rows = allStudents.map(s => [
    s.name, s.dept, s.cgpa, s.attendance, s.resumeScore,
    s.placementChance + '%',
    s.placed || (s.placementChance >= 60 ? 'Placed' : 'Not Placed')
  ]);
  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'placeiq_tpo_report.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('✓ Report exported!');
}

init();