/* =============================================================
   HealthSync AI - Application Logic
   Features: Auth, Report Analyzer, Disease Detection, Anime.js
============================================================= */

// ---- Global State ----
const state = {
  currentUser: null,
  currentPage: 'dashboard',
  reports: [],
  alerts: [],
  theme: 'dark'
};

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setTopbarDate();
  checkAutoLogin();
  runAuthAnimations();
});

// ---- Theme ----
function initTheme() {
  const saved = localStorage.getItem('mediscan-theme') || 'dark';
  state.theme = saved;
  document.documentElement.setAttribute('data-theme', saved);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.checked = (saved === 'light');
}
function toggleTheme(checkbox) {
  const theme = checkbox.checked ? 'light' : 'dark';
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mediscan-theme', theme);
}

// ---- Date ----
function setTopbarDate() {
  const el = document.getElementById('topbar-date-val');
  if (el) el.textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}

// ---- Auth Animations (Anime.js) ----
function runAuthAnimations() {
  // Animate particles
  anime({
    targets: '.particle',
    translateY: [0, -30, 0],
    opacity: [0.2, 0.5, 0.2],
    duration: (el, i) => 5000 + i * 1000,
    delay: (el, i) => i * 500,
    loop: true,
    easing: 'easeInOutSine',
    direction: 'alternate'
  });
  // Stagger auth card elements
  anime({
    targets: '#auth-card .auth-logo, #auth-card .auth-tabs, #auth-card .auth-form, #auth-card .auth-disclaimer',
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(80, {start: 400}),
    easing: 'easeOutExpo',
    duration: 600
  });
}

// ---- Auth Tab Switch ----
window.switchAuthTab = function(tab) {
  const signin = document.getElementById('signin-form');
  const signup = document.getElementById('signup-form');
  const signinBtn = document.getElementById('signin-tab-btn');
  const signupBtn = document.getElementById('signup-tab-btn');
  if (tab === 'signin') {
    signin.style.display = 'flex';
    signup.style.display = 'none';
    signinBtn.classList.add('active');
    signupBtn.classList.remove('active');
  } else {
    signup.style.display = 'flex';
    signin.style.display = 'none';
    signupBtn.classList.add('active');
    signinBtn.classList.remove('active');
  }
  anime({ targets: tab === 'signin' ? signin : signup, opacity: [0,1], translateY: [10,0], duration: 300, easing: 'easeOutExpo' });
};

// ---- Password toggle ----
window.togglePass = function(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
};

// ---- Backend API helper (talks to the Node + MongoDB server) ----
const TOKEN_KEY = 'healthsync-token';

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}
    ),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Real server messages have a status; no status = server unreachable
function errMsg(err) {
  return err.status ? err.message : 'Cannot reach the server. Make sure it is running.';
}

// ---- Sign In ----
window.handleSignIn = async function(e) {
  e.preventDefault();
  const email = document.getElementById('signin-email').value.trim();
  const pass = document.getElementById('signin-pass').value;
  const btn = document.getElementById('signin-btn');
  btn.disabled = true;
  try {
    const data = await api('/auth/signin', { method: 'POST', body: { email, password: pass } });
    localStorage.setItem(TOKEN_KEY, data.token);
    await loginUser(data.user);
  } catch (err) {
    showToast(errMsg(err), 'error');
    anime({ targets: '#signin-form', translateX: [-8,8,-6,6,-4,4,0], duration: 400, easing: 'linear' });
  } finally {
    btn.disabled = false;
  }
};

// ---- Sign Up ----
window.handleSignUp = async function(e) {
  e.preventDefault();
  const fname = document.getElementById('signup-fname').value.trim();
  const lname = document.getElementById('signup-lname').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const age = document.getElementById('signup-age').value;
  const pass = document.getElementById('signup-pass').value;
  const btn = document.getElementById('signup-btn');
  btn.disabled = true;
  try {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: { name: `${fname} ${lname}`, email, age, password: pass }
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    showToast('Account created! Welcome to HealthSync AI.', 'success');
    await loginUser(data.user);
  } catch (err) {
    showToast(errMsg(err), err.status === 409 ? 'warning' : 'error');
  } finally {
    btn.disabled = false;
  }
};

// ---- Demo Login ----
window.handleDemoLogin = async function() {
  try {
    const data = await api('/auth/demo', { method: 'POST' });
    localStorage.setItem(TOKEN_KEY, data.token);
    await loginUser(data.user);
  } catch (err) {
    showToast(errMsg(err), 'error');
  }
};

// ---- Auto Login Check (keeps you signed in after refresh) ----
async function checkAutoLogin() {
  if (!localStorage.getItem(TOKEN_KEY)) return;
  try {
    const data = await api('/auth/me');
    await loginUser(data.user, true);
  } catch (err) {
    if (err.status === 401) localStorage.removeItem(TOKEN_KEY);
  }
}

// ---- Login User ----
async function loginUser(user, silent = false) {
  state.currentUser = user;
  // Load this user's reports from MongoDB
  try {
    const data = await api('/reports');
    state.reports = data.reports;
  } catch (err) {
    state.reports = [];
    showToast('Could not load your reports: ' + errMsg(err), 'error');
  }
  updateStats();
  updateAlerts();
  if (!silent) {
    // Animate auth screen out
    anime({
      targets: '#auth-card',
      opacity: [1, 0],
      scale: [1, 0.95],
      duration: 400,
      easing: 'easeInExpo',
      complete: () => {
        document.getElementById('auth-screen').style.display = 'none';
        showMainApp(user);
      }
    });
  } else {
    document.getElementById('auth-screen').style.display = 'none';
    showMainApp(user, true);
  }
}

function showMainApp(user, instant = false) {
  const app = document.getElementById('main-app');
  app.style.display = 'flex';
  // Populate user info
  const initials = user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('profile-avatar-big').textContent = initials;
  document.getElementById('profile-full-name').textContent = user.name;
  document.getElementById('profile-email-display').textContent = user.email;
  document.getElementById('pf-name').textContent = user.name;
  document.getElementById('pf-email').textContent = user.email;
  document.getElementById('pf-age').textContent = user.age ? `${user.age} years old` : 'Not specified';
  document.getElementById('pf-joined').textContent = user.joined || 'Today';
  document.getElementById('pf-reports').textContent = state.reports.length;
  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning,' : hour < 17 ? 'Good Afternoon,' : 'Good Evening,';
  document.getElementById('hero-greeting').textContent = greet;
  document.getElementById('hero-name').textContent = user.name;
  // Animate in
  if (!instant) {
    anime({ targets: '#main-app', opacity: [0, 1], duration: 500, easing: 'easeOutExpo' });
  }
  navigateTo('dashboard');
  runDashboardAnimations();
  renderRecentReports();
}

// ---- Sign Out ----
window.handleSignOut = function() {
  localStorage.removeItem(TOKEN_KEY);
  state.currentUser = null;
  state.lastParsed = null;
  state.reports = [];
  state.alerts = [];
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  // Reset forms
  document.getElementById('signin-email').value = '';
  document.getElementById('signin-pass').value = '';
  runAuthAnimations();
  switchAuthTab('signin');
};

// ---- Navigation ----
window.navigateTo = function(page) {
  state.currentPage = page;
  const pages = ['dashboard','analyzer','bodymodel','insights','history','profile'];
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.style.display = (p === page) ? 'flex' : 'none';
    const nav = document.getElementById(`nav-${p}`);
    if (nav) nav.classList.toggle('active', p === page);
  });
  const titles = {
    dashboard: ['Dashboard', 'Welcome back to your health portal'],
    analyzer: ['Report Analyzer', 'Paste your lab report for AI-powered interpretation'],
    bodymodel: ['3D Body Model', 'Rotate the body and tap an organ to see your findings'],
    insights: ['Organ Insights', 'What each organ does and what your report says about it'],
    history: ['Report History', 'All your analyzed medical reports'],
    profile: ['My Profile', 'Your personal health account']
  };
  document.getElementById('page-title').textContent = titles[page][0];
  document.getElementById('page-subtitle').textContent = titles[page][1];
  if (page === 'history') renderHistoryPage();
  if (page === 'dashboard') renderRecentReports();
  if (page === 'bodymodel') initBody3D();
  if (page === 'insights') renderInsights();
};

// ---- Dashboard Animations ----
function runDashboardAnimations() {
  anime({
    targets: '.stat-card',
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(80, {start: 200}),
    duration: 500,
    easing: 'easeOutExpo'
  });
  anime({
    targets: '.how-step',
    opacity: [0, 1],
    translateY: [30, 0],
    delay: anime.stagger(100, {start: 400}),
    duration: 500,
    easing: 'easeOutExpo'
  });
  anime({
    targets: '.welcome-hero',
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 600,
    easing: 'easeOutExpo'
  });
  // Animate rings
  anime({
    targets: '.ring1',
    rotate: 360,
    duration: 8000,
    loop: true,
    easing: 'linear'
  });
  anime({
    targets: '.ring2',
    rotate: -360,
    duration: 5000,
    loop: true,
    easing: 'linear'
  });
  anime({
    targets: '.ring3',
    rotate: 360,
    duration: 3000,
    loop: true,
    easing: 'linear'
  });
}

// ---- Stats ----
function updateStats() {
  const reports = state.reports;
  const alertCount = state.alerts.length;
  const conditions = state.alerts.filter(a => a.type === 'critical').length;
  const lastScore = reports.length > 0 ? reports[reports.length - 1].healthScore : '--';

  animateCountUp('stat-reports-val', reports.length);
  animateCountUp('stat-alerts-val', alertCount);
  animateCountUp('stat-conditions-val', conditions);

  const scoreEl = document.getElementById('stat-score-val');
  if (scoreEl) scoreEl.textContent = lastScore;
  document.getElementById('pf-reports').textContent = reports.length;
}

function animateCountUp(id, target) {
  const el = document.getElementById(id);
  if (!el || target === '--') return;
  anime({
    targets: { val: 0 },
    val: target,
    duration: 800,
    easing: 'easeOutExpo',
    update: function(anim) {
      el.textContent = Math.round(anim.animations[0].currentValue);
    }
  });
}

function updateAlerts() {
  const dot = document.getElementById('bell-dot');
  const body = document.getElementById('alert-panel-body');
  if (state.alerts.length === 0) {
    if (dot) dot.style.display = 'none';
    if (body) body.innerHTML = '<p class="no-alerts">No alerts yet. Analyze a report to detect issues.</p>';
    return;
  }
  if (dot) dot.style.display = 'block';
  if (body) {
    body.innerHTML = '';
    state.alerts.forEach(alert => {
      const div = document.createElement('div');
      div.className = `alert-item ${alert.type}`;
      const icon = alert.type === 'critical' ? 'fa-circle-xmark' : alert.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';
      div.innerHTML = `<i class="fa-solid ${icon}"></i><div><strong>${alert.title}</strong><br>${alert.desc}</div>`;
      body.appendChild(div);
    });
  }
}

window.toggleAlertPanel = function() {
  const panel = document.getElementById('alert-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

// ---- Render Recent Reports ----
function renderRecentReports() {
  const container = document.getElementById('recent-reports-list');
  if (!container) return;
  if (state.reports.length === 0) {
    container.innerHTML = `<div class="empty-placeholder"><i class="fa-solid fa-file-circle-plus"></i><p>No reports yet. Start by analyzing your first medical report.</p><button class="btn-start" onclick="navigateTo('analyzer')">Get Started</button></div>`;
    return;
  }
  container.innerHTML = '';
  const recent = [...state.reports].reverse().slice(0, 5);
  recent.forEach(r => {
    const item = createReportListItem(r);
    container.appendChild(item);
  });
  anime({ targets: '.report-history-item', opacity: [0,1], translateX: [-20,0], delay: anime.stagger(60), duration: 400, easing: 'easeOutExpo' });
}

function createReportListItem(r) {
  const div = document.createElement('div');
  div.className = 'report-history-item';
  const scoreColor = r.healthScore >= 70 ? 'var(--success)' : r.healthScore >= 50 ? 'var(--warning)' : 'var(--danger)';
  const alertClass = r.alertLevel === 'critical' ? 'rhi-badge' : r.alertLevel === 'warning' ? 'rhi-badge' : 'rhi-badge';
  const alertColor = r.alertLevel === 'critical' ? 'background:var(--danger-bg);color:var(--danger)' : r.alertLevel === 'warning' ? 'background:var(--warning-bg);color:var(--warning)' : 'background:var(--success-bg);color:var(--success)';
  div.innerHTML = `
    <div class="rhi-icon" style="background:var(--primary-glow);color:var(--primary)"><i class="fa-solid fa-file-waveform"></i></div>
    <div class="rhi-info">
      <div class="rhi-title">${r.reportType || 'Medical Report'}</div>
      <div class="rhi-meta">${r.patientName || 'Patient'} &bull; ${r.date}</div>
    </div>
    <div class="rhi-score">
      <div class="rhi-score-val" style="color:${scoreColor}">${r.healthScore}</div>
      <div class="rhi-score-label">Health Score</div>
      <span class="rhi-badge" style="${alertColor}">${r.alertLevel || 'Normal'}</span>
    </div>`;
  div.onclick = () => viewReport(r);
  return div;
}

// ---- History Page ----
function renderHistoryPage() {
  const container = document.getElementById('history-list');
  if (!container) return;
  if (state.reports.length === 0) {
    container.innerHTML = `<div class="empty-placeholder"><i class="fa-solid fa-folder-open"></i><p>No report history yet. Analyze a report to build your health timeline.</p></div>`;
    return;
  }
  container.innerHTML = '';
  [...state.reports].reverse().forEach(r => {
    container.appendChild(createReportListItem(r));
  });
  anime({ targets: '.report-history-item', opacity: [0,1], translateX: [-20,0], delay: anime.stagger(60), duration: 400, easing: 'easeOutExpo' });
}

window.clearHistory = async function() {
  if (!confirm('Delete all report history? This cannot be undone.')) return;
  try { await api('/reports', { method: 'DELETE' }); } catch (err) { showToast(errMsg(err), 'error'); return; }
  state.reports = [];
  state.alerts = [];
  updateStats();
  updateAlerts();
  renderHistoryPage();
  renderRecentReports();
  showToast('History cleared.', 'warning');
};

// ============================================================
//  MEDICAL REPORT ANALYZER ENGINE
// ============================================================

// Known biomarker database with normal ranges + explanations
const BIOMARKER_DB = {
  // CBC
  'haemoglobin': { name:'Haemoglobin', unit:'g/dL', low:{M:13,F:12}, high:{M:17,F:16}, explain:'Haemoglobin carries oxygen in your blood. Low levels cause anaemia (tiredness, weakness). High levels can thicken blood.' },
  'hemoglobin':  { name:'Haemoglobin', unit:'g/dL', low:{M:13,F:12}, high:{M:17,F:16}, explain:'Haemoglobin carries oxygen in your blood. Low levels cause anaemia (tiredness, weakness). High levels can thicken blood.' },
  'hb':          { name:'Haemoglobin', unit:'g/dL', low:{M:13,F:12}, high:{M:17,F:16}, explain:'Haemoglobin carries oxygen in your blood. Low levels cause anaemia (tiredness, weakness).' },
  'wbc':         { name:'WBC (White Blood Cells)', unit:'/μL', low:4000, high:11000, explain:'WBCs fight infection. High WBC often means infection or inflammation. Very low WBC weakens immunity.' },
  'wbc count':   { name:'WBC Count', unit:'/μL', low:4000, high:11000, explain:'WBCs fight infection. High WBC often means infection or inflammation. Very low WBC weakens immunity.' },
  'rbc':         { name:'RBC (Red Blood Cells)', unit:'million/μL', low:{M:4.5,F:4.0}, high:{M:5.5,F:5.0}, explain:'RBCs carry oxygen throughout the body. Low RBC is linked to anaemia or blood loss.' },
  'platelet':    { name:'Platelet Count', unit:'/μL', low:150000, high:400000, explain:'Platelets help your blood clot. Low platelets risk bleeding; high platelets risk clots.' },
  'platelets':   { name:'Platelet Count', unit:'/μL', low:150000, high:400000, explain:'Platelets help your blood clot. Low platelets risk bleeding; high platelets risk clots.' },
  'mcv':         { name:'MCV', unit:'fL', low:80, high:100, explain:'MCV measures the size of your red blood cells. Low = iron deficiency. High = B12/folate deficiency.' },
  'mch':         { name:'MCH', unit:'pg', low:27, high:33, explain:'MCH is the average amount of haemoglobin per red blood cell.' },
  'mchc':        { name:'MCHC', unit:'g/dL', low:32, high:36, explain:'MCHC measures concentration of haemoglobin in red blood cells.' },
  'hematocrit':  { name:'Hematocrit (PCV)', unit:'%', low:{M:41,F:36}, high:{M:53,F:46}, explain:'Hematocrit is the percentage of blood made up of red blood cells.' },
  'pcv':         { name:'PCV (Packed Cell Volume)', unit:'%', low:{M:41,F:36}, high:{M:53,F:46}, explain:'PCV (same as hematocrit) shows the proportion of red blood cells in your blood.' },
  'neutrophils': { name:'Neutrophils', unit:'%', low:40, high:75, explain:'Neutrophils are WBCs that fight bacterial infections. High levels suggest active infection.' },
  'lymphocytes': { name:'Lymphocytes', unit:'%', low:20, high:40, explain:'Lymphocytes fight viral infections and cancer. Low levels can mean immune suppression.' },
  'eosinophils': { name:'Eosinophils', unit:'%', low:1, high:6, explain:'Eosinophils fight parasites and cause allergic reactions. High levels suggest allergy or parasitic infection.' },
  'monocytes':   { name:'Monocytes', unit:'%', low:2, high:10, explain:'Monocytes help fight infection and clean up dead cells.' },
  'basophils':   { name:'Basophils', unit:'%', low:0, high:1, explain:'Basophils are involved in allergic reactions. Very rarely elevated.' },
  // LFT
  'sgpt':        { name:'SGPT/ALT (Liver Enzyme)', unit:'U/L', low:7, high:56, explain:'SGPT (ALT) is a liver enzyme. High levels indicate liver damage, hepatitis, or fatty liver.' },
  'alt':         { name:'ALT (Liver Enzyme)', unit:'U/L', low:7, high:56, explain:'ALT is a key liver enzyme. High ALT means liver cells are damaged or inflamed.' },
  'sgot':        { name:'SGOT/AST', unit:'U/L', low:10, high:40, explain:'AST is found in liver and heart. High levels can mean liver disease or heart attack.' },
  'ast':         { name:'AST', unit:'U/L', low:10, high:40, explain:'AST is found in liver and heart. High levels can indicate liver disease or heart muscle damage.' },
  'bilirubin':   { name:'Total Bilirubin', unit:'mg/dL', low:0.2, high:1.2, explain:'Bilirubin is a waste product from red blood cells. High levels cause jaundice (yellow skin/eyes).' },
  'total bilirubin': { name:'Total Bilirubin', unit:'mg/dL', low:0.2, high:1.2, explain:'Bilirubin is a waste product from red blood cells. High levels cause jaundice (yellow skin/eyes).' },
  'direct bilirubin': { name:'Direct Bilirubin', unit:'mg/dL', low:0, high:0.3, explain:'Direct bilirubin is processed bilirubin. High levels indicate bile duct obstruction.' },
  'indirect bilirubin': { name:'Indirect Bilirubin', unit:'mg/dL', low:0.1, high:1.0, explain:'High indirect bilirubin can indicate haemolytic anaemia or liver disease.' },
  'alkaline phosphatase': { name:'Alkaline Phosphatase (ALP)', unit:'U/L', low:44, high:147, explain:'ALP is found in liver and bone. High ALP can signal bile duct blockage or bone disorders.' },
  'alp':         { name:'Alkaline Phosphatase (ALP)', unit:'U/L', low:44, high:147, explain:'ALP is found in liver and bone. High ALP can signal bile duct blockage or bone disorders.' },
  'ggt':         { name:'GGT (Gamma-GT)', unit:'U/L', low:9, high:48, explain:'GGT is a liver enzyme. Elevated GGT is associated with alcohol consumption, liver disease, or bile duct issues.' },
  'total protein': { name:'Total Protein', unit:'g/dL', low:6.3, high:8.2, explain:'Total protein reflects liver function and nutrition. Low levels indicate malnutrition or liver failure.' },
  'albumin':     { name:'Albumin', unit:'g/dL', low:3.5, high:5.0, explain:'Albumin is made by the liver. Low albumin indicates poor nutrition, liver disease, or kidney loss.' },
  'globulin':    { name:'Globulin', unit:'g/dL', low:2.0, high:3.5, explain:'Globulins include immune proteins. High levels can mean inflammation or immune disorders.' },
  // KFT
  'creatinine':  { name:'Creatinine', unit:'mg/dL', low:{M:0.7,F:0.5}, high:{M:1.2,F:1.1}, explain:'Creatinine is a waste product filtered by kidneys. High levels indicate kidney dysfunction.' },
  'urea':        { name:'Blood Urea', unit:'mg/dL', low:7, high:20, explain:'Urea is a waste product. High levels (uremia) indicate kidney failure or dehydration.' },
  'bun':         { name:'BUN (Blood Urea Nitrogen)', unit:'mg/dL', low:7, high:20, explain:'BUN measures kidney function and hydration. High BUN indicates kidney problems or dehydration.' },
  'uric acid':   { name:'Uric Acid', unit:'mg/dL', low:{M:3.5,F:2.6}, high:{M:7.2,F:6.0}, explain:'High uric acid causes gout (painful joint crystals) and kidney stones.' },
  'egfr':        { name:'eGFR (Kidney Filter Rate)', unit:'mL/min', low:60, high:120, explain:'eGFR measures how well your kidneys filter blood. Below 60 suggests chronic kidney disease.' },
  'sodium':      { name:'Sodium (Na+)', unit:'mEq/L', low:136, high:145, explain:'Sodium controls fluid balance. Low sodium causes dizziness/confusion. High sodium causes dehydration.' },
  'potassium':   { name:'Potassium (K+)', unit:'mEq/L', low:3.5, high:5.1, explain:'Potassium is critical for heart rhythm and muscle function. Abnormal levels can be life-threatening.' },
  'chloride':    { name:'Chloride (Cl-)', unit:'mEq/L', low:98, high:106, explain:'Chloride maintains fluid and acid-base balance.' },
  'calcium':     { name:'Calcium (Ca)', unit:'mg/dL', low:8.5, high:10.2, explain:'Calcium is vital for bones, muscles, and nerve function. Abnormal levels affect heart and muscles.' },
  // LIPID PROFILE
  'total cholesterol': { name:'Total Cholesterol', unit:'mg/dL', low:0, high:200, explain:'High total cholesterol increases heart disease and stroke risk. Diet and exercise can lower it.' },
  'cholesterol': { name:'Total Cholesterol', unit:'mg/dL', low:0, high:200, explain:'High total cholesterol increases heart disease and stroke risk.' },
  'hdl':         { name:'HDL Cholesterol (Good)', unit:'mg/dL', low:40, high:999, explain:'HDL is "good" cholesterol that removes bad cholesterol. Higher HDL = better heart health.' },
  'ldl':         { name:'LDL Cholesterol (Bad)', unit:'mg/dL', low:0, high:130, explain:'LDL is "bad" cholesterol that clogs arteries. High LDL increases heart attack and stroke risk.' },
  'triglycerides': { name:'Triglycerides', unit:'mg/dL', low:0, high:150, explain:'High triglycerides from excess sugar/fat can cause pancreatitis and heart disease.' },
  'vldl':        { name:'VLDL Cholesterol', unit:'mg/dL', low:0, high:30, explain:'VLDL carries triglycerides. High VLDL contributes to artery plaque buildup.' },
  // THYROID
  'tsh':         { name:'TSH (Thyroid Stimulating Hormone)', unit:'mIU/L', low:0.4, high:4.0, explain:'TSH controls thyroid. High TSH means underactive thyroid (fatigue, weight gain). Low TSH means overactive thyroid (anxiety, weight loss).' },
  't3':          { name:'T3 (Triiodothyronine)', unit:'ng/dL', low:80, high:200, explain:'T3 is the active thyroid hormone. Low T3 causes hypothyroid symptoms. High T3 causes hyperthyroid symptoms.' },
  't4':          { name:'T4 (Thyroxine)', unit:'μg/dL', low:5.1, high:14.1, explain:'T4 is the main thyroid hormone. Abnormal levels indicate thyroid dysfunction.' },
  'free t3':     { name:'Free T3', unit:'pg/mL', low:2.3, high:4.2, explain:'Free T3 is the active form available to cells. Low levels cause fatigue and cold intolerance.' },
  'free t4':     { name:'Free T4', unit:'ng/dL', low:0.8, high:1.8, explain:'Free T4 is unbound thyroxine. Low levels indicate underactive thyroid (hypothyroidism).' },
  // DIABETES / BLOOD SUGAR
  'fasting glucose': { name:'Fasting Blood Glucose', unit:'mg/dL', low:70, high:100, explain:'Fasting glucose >126 mg/dL indicates diabetes. 100-125 is pre-diabetes. Normal is under 100.' },
  'fasting blood sugar': { name:'Fasting Blood Sugar (FBS)', unit:'mg/dL', low:70, high:100, explain:'FBS >126 mg/dL indicates diabetes. 100-125 is pre-diabetes.' },
  'fbs':         { name:'Fasting Blood Sugar (FBS)', unit:'mg/dL', low:70, high:100, explain:'FBS >126 mg/dL indicates diabetes. 100-125 is pre-diabetes.' },
  'hba1c':       { name:'HbA1c (3-Month Sugar Average)', unit:'%', low:0, high:5.7, explain:'HbA1c shows your average blood sugar over 3 months. 5.7-6.4% = pre-diabetes. 6.5%+ = diabetes.' },
  'pp glucose':  { name:'Post-Prandial Glucose (PP)', unit:'mg/dL', low:0, high:140, explain:'PP glucose is tested 2 hours after eating. >200 mg/dL strongly suggests diabetes.' },
  'glucose':     { name:'Blood Glucose', unit:'mg/dL', low:70, high:110, explain:'Blood glucose measures blood sugar. High levels over time damage kidneys, eyes, and nerves.' },
  // CARDIAC MARKERS
  'troponin':    { name:'Troponin', unit:'ng/mL', low:0, high:0.04, explain:'CRITICAL: Troponin is released when heart muscle is damaged. High levels indicate a heart attack.' },
  'ck-mb':       { name:'CK-MB (Cardiac Enzyme)', unit:'ng/mL', low:0, high:5, explain:'CK-MB is a cardiac enzyme. Elevated levels indicate heart muscle damage (heart attack).' },
  'creatine kinase': { name:'Creatine Kinase (CK)', unit:'U/L', low:30, high:200, explain:'CK is found in muscle and heart. High CK indicates muscle damage or heart attack.' },
  'ldh':         { name:'LDH (Lactate Dehydrogenase)', unit:'U/L', low:120, high:246, explain:'LDH is released when tissue is damaged. High LDH can indicate heart attack, liver disease, or anaemia.' },
  // VITAMINS & MINERALS
  'vitamin d':   { name:'Vitamin D (25-OH)', unit:'ng/mL', low:30, high:100, explain:'Vitamin D is essential for bones and immunity. Deficiency causes weak bones, fatigue, and depression.' },
  'vitamin d3':  { name:'Vitamin D3', unit:'ng/mL', low:30, high:100, explain:'Vitamin D3 supports calcium absorption. Deficiency is very common and causes bone pain, fatigue.' },
  'vitamin b12': { name:'Vitamin B12', unit:'pg/mL', low:200, high:900, explain:'B12 is vital for nerves and red blood cells. Deficiency causes numbness, weakness, and megaloblastic anaemia.' },
  'b12':         { name:'Vitamin B12', unit:'pg/mL', low:200, high:900, explain:'B12 is vital for nerves and red blood cells. Deficiency causes numbness, weakness, and anaemia.' },
  'folate':      { name:'Folate (Folic Acid)', unit:'ng/mL', low:4, high:20, explain:'Folate is essential for DNA and red blood cells. Deficiency causes anaemia and neural tube defects in pregnancy.' },
  'ferritin':    { name:'Ferritin (Iron Store)', unit:'ng/mL', low:{M:24,F:11}, high:{M:336,F:307}, explain:'Ferritin stores iron. Low ferritin = iron deficiency anaemia. High ferritin = inflammation or iron overload.' },
  'iron':        { name:'Serum Iron', unit:'μg/dL', low:{M:65,F:50}, high:{M:175,F:170}, explain:'Serum iron measures iron in the blood. Low iron leads to anaemia. High iron causes organ damage.' },
  'tibc':        { name:'TIBC (Iron Binding Capacity)', unit:'μg/dL', low:240, high:450, explain:'TIBC measures how much iron your blood can carry. High TIBC = iron deficiency. Low = iron overload.' },
  'transferrin': { name:'Transferrin Saturation', unit:'%', low:20, high:50, explain:'Transferrin carries iron in the blood. Low saturation = anaemia. High = iron overload (haemochromatosis).' },
  'magnesium':   { name:'Magnesium (Mg)', unit:'mg/dL', low:1.7, high:2.2, explain:'Magnesium regulates muscle and nerve function, blood sugar, and blood pressure.' },
  'phosphorus':  { name:'Phosphorus (P)', unit:'mg/dL', low:2.5, high:4.5, explain:'Phosphorus works with calcium for bone health and energy production.' },
  'zinc':        { name:'Zinc', unit:'μg/dL', low:70, high:120, explain:'Zinc supports immunity and wound healing. Deficiency causes hair loss, poor wound healing, loss of taste.' },
  // CRP / INFLAMMATION
  'crp':         { name:'C-Reactive Protein (CRP)', unit:'mg/L', low:0, high:10, explain:'CRP is an inflammation marker. High CRP indicates active infection, inflammation, or autoimmune disease.' },
  'esr':         { name:'ESR (Sedimentation Rate)', unit:'mm/hr', low:0, high:{M:20,F:30}, explain:'ESR indicates inflammation. High ESR suggests infection, autoimmune disease, or cancer.' },
  // URINE
  'protein urine': { name:'Urine Protein', unit:'mg/dL', low:0, high:14, explain:'Protein in urine (proteinuria) indicates kidney damage when persistently elevated.' },
  'glucose urine': { name:'Urine Glucose', unit:'mg/dL', low:0, high:15, explain:'Glucose in urine often indicates uncontrolled diabetes.' },
  'ketones':     { name:'Urine Ketones', unit:'mg/dL', low:0, high:5, explain:'Ketones in urine can indicate diabetic ketoacidosis or starvation.' },
  'ph urine':    { name:'Urine pH', unit:'', low:4.5, high:8.0, explain:'Urine pH indicates acid-base balance. Very acidic or alkaline urine can suggest kidney or metabolic issues.' },
  // HORMONE
  'testosterone': { name:'Testosterone', unit:'ng/dL', low:{M:300,F:15}, high:{M:1000,F:70}, explain:'Testosterone regulates sex drive, muscle mass, and bone density. Abnormal levels affect energy and mood.' },
  'estrogen':    { name:'Estrogen (Estradiol)', unit:'pg/mL', low:{F:15,M:10}, high:{F:350,M:40}, explain:'Estrogen is the primary female sex hormone. Imbalance causes menstrual issues, mood changes, or bone loss.' },
  'prolactin':   { name:'Prolactin', unit:'ng/mL', low:0, high:{M:15,F:20}, explain:'High prolactin (hyperprolactinaemia) causes milk production in non-pregnant women, sexual dysfunction in men.' },
  'cortisol':    { name:'Cortisol (Stress Hormone)', unit:'μg/dL', low:6, high:23, explain:'Cortisol is the stress hormone. Chronically high cortisol = Cushing syndrome. Low cortisol = Addison disease.' },
  'insulin':     { name:'Fasting Insulin', unit:'μU/mL', low:2, high:25, explain:'High fasting insulin indicates insulin resistance, a precursor to type 2 diabetes.' }
};

// Disease pattern detector
const DISEASE_PATTERNS = [
  {
    name:'Anaemia',
    icon:'fa-droplet',
    check: (vals) => findLow(vals, ['haemoglobin','hemoglobin','hb','rbc']) || findLow(vals, ['mcv']) || findLow(vals, ['ferritin']),
    desc:'Your haemoglobin, RBC count, or iron stores are below normal. This indicates anaemia — your blood is not carrying enough oxygen. Common symptoms: fatigue, shortness of breath, pale skin, dizziness. Please consult a doctor to find the cause (iron deficiency, B12 deficiency, or chronic disease).',
    risk: 'high'
  },
  {
    name:'Iron Deficiency',
    icon:'fa-wheat-awn',
    check: (vals) => findLow(vals, ['ferritin','iron','serum iron']) || (findLow(vals, ['mcv']) && findHigh(vals, ['tibc'])),
    desc:'Low iron stores detected. Your body does not have enough iron to make healthy red blood cells. Common symptoms: extreme fatigue, brittle nails, hair loss, cold hands/feet. Iron-rich foods (spinach, red meat, lentils) and iron supplements can help.',
    risk: 'moderate'
  },
  {
    name:'Vitamin B12 Deficiency',
    icon:'fa-capsules',
    check: (vals) => findLow(vals, ['vitamin b12','b12']) || (findHigh(vals, ['mcv']) && findLow(vals, ['haemoglobin','hemoglobin','hb'])),
    desc:'Vitamin B12 is low or a pattern consistent with B12 deficiency is detected. B12 is essential for nerve function and red blood cell production. Deficiency causes numbness/tingling, memory problems, fatigue, and megaloblastic anaemia. B12 injections or supplements are the treatment.',
    risk: 'moderate'
  },
  {
    name:'Vitamin D Deficiency',
    icon:'fa-sun',
    check: (vals) => findLow(vals, ['vitamin d','vitamin d3']),
    desc:'Vitamin D levels are below normal. Vitamin D is crucial for bone strength, immune function, and mood regulation. Deficiency causes bone pain, muscle weakness, fatigue, and increased risk of infections. Sun exposure and Vitamin D3 supplements are effective treatments.',
    risk: 'moderate'
  },
  {
    name:'Diabetes / Pre-Diabetes',
    icon:'fa-syringe',
    check: (vals) => findHigh(vals, ['hba1c','fbs','fasting glucose','fasting blood sugar','pp glucose','glucose']),
    desc:'Blood sugar markers are elevated. HbA1c above 5.7% suggests pre-diabetes; above 6.5% confirms diabetes. Uncontrolled blood sugar damages kidneys, eyes, nerves, and blood vessels over time. Lifestyle changes (diet, exercise) and medication can control diabetes effectively.',
    risk: 'high'
  },
  {
    name:'Liver Disease / Hepatitis',
    icon:'fa-shield-virus',
    check: (vals) => findHigh(vals, ['sgpt','alt','sgot','ast','bilirubin','total bilirubin','alp','ggt']),
    desc:'Elevated liver enzymes (ALT, AST) or bilirubin suggest liver stress or damage. This can indicate hepatitis, fatty liver disease, alcohol-related liver damage, or bile duct obstruction. Jaundice (yellow eyes/skin) is a key symptom. Further investigation with ultrasound and hepatitis tests is recommended.',
    risk: 'high'
  },
  {
    name:'Kidney Dysfunction (CKD Risk)',
    icon:'fa-kidney',
    check: (vals) => findHigh(vals, ['creatinine','urea','bun']) || findLow(vals, ['egfr']),
    desc:'Elevated creatinine or urea levels, or reduced eGFR, indicate the kidneys are not filtering waste efficiently. This may suggest chronic kidney disease (CKD), dehydration, or acute kidney injury. Immediate medical evaluation is needed. Avoid NSAIDs and stay well hydrated.',
    risk: 'high'
  },
  {
    name:'Hyperthyroidism (Overactive Thyroid)',
    icon:'fa-bolt',
    check: (vals) => findLow(vals, ['tsh']) && (findHigh(vals, ['t3','free t3']) || findHigh(vals, ['t4','free t4'])),
    desc:'Low TSH with high T3/T4 indicates an overactive thyroid (hyperthyroidism). Symptoms include unexplained weight loss, rapid heartbeat, anxiety, sweating, and heat intolerance. Graves disease is the most common cause. Treatment includes medication, radioactive iodine, or surgery.',
    risk: 'high'
  },
  {
    name:'Hypothyroidism (Underactive Thyroid)',
    icon:'fa-person-walking-arrow-right',
    check: (vals) => findHigh(vals, ['tsh']) && (findLow(vals, ['t3','free t3','t4','free t4'])),
    desc:'High TSH with low T3/T4 indicates an underactive thyroid (hypothyroidism). Symptoms include fatigue, unexplained weight gain, constipation, dry skin, depression, and cold intolerance. Levothyroxine (thyroid hormone replacement) is the standard treatment.',
    risk: 'high'
  },
  {
    name:'High Cholesterol (Dyslipidaemia)',
    icon:'fa-heart-crack',
    check: (vals) => findHigh(vals, ['total cholesterol','cholesterol','ldl','triglycerides','vldl']) || findLow(vals, ['hdl']),
    desc:'Abnormal cholesterol levels detected. High LDL or low HDL significantly increases the risk of heart attack and stroke by building up plaques in arteries. A heart-healthy diet (low in saturated fats), regular exercise, and possibly statin medication are recommended.',
    risk: 'high'
  },
  {
    name:'Cardiovascular Risk (Heart Attack Markers)',
    icon:'fa-heart-pulse',
    check: (vals) => findHigh(vals, ['troponin','ck-mb','creatine kinase','ldh']),
    desc:'CRITICAL: Elevated cardiac enzymes (troponin or CK-MB) are emergency signs of heart muscle damage. This pattern is consistent with a heart attack (myocardial infarction) or severe heart muscle injury. If you have not already, seek emergency medical care immediately.',
    risk: 'high'
  },
  {
    name:'Gout (High Uric Acid)',
    icon:'fa-joint',
    check: (vals) => findHigh(vals, ['uric acid']),
    desc:'High uric acid (hyperuricaemia) can cause gout — a painful condition where uric acid crystals form in joints (especially the big toe). It also increases the risk of kidney stones. Avoid alcohol, red meat, organ meats, shellfish, and high-fructose drinks. Allopurinol medication can help.',
    risk: 'moderate'
  },
  {
    name:'Infection or Inflammation',
    icon:'fa-bacterium',
    check: (vals) => findHigh(vals, ['wbc','wbc count','neutrophils','crp','esr']),
    desc:'Elevated white blood cells (WBC), neutrophils, CRP, or ESR indicate an active infection or inflammation. This can be caused by bacterial or viral infections, autoimmune conditions, or tissue injury. The specific cause needs to be identified by your doctor.',
    risk: 'moderate'
  },
  {
    name:'Low Platelets (Thrombocytopaenia)',
    icon:'fa-droplet-slash',
    check: (vals) => findLow(vals, ['platelet','platelets']),
    desc:'Low platelet count means your blood may not clot properly, increasing the risk of unusual bleeding, bruising, or longer bleeding from wounds. Causes include dengue fever, bone marrow disorders, medications, or autoimmune conditions. Seek prompt medical evaluation.',
    risk: 'high'
  },
  {
    name:'Electrolyte Imbalance',
    icon:'fa-bolt-lightning',
    check: (vals) => findAbnormal(vals, ['sodium','potassium','chloride','calcium','magnesium']),
    desc:'One or more electrolyte levels are abnormal. Electrolytes (sodium, potassium, calcium) are critical for heart rhythm, muscle function, and fluid balance. Abnormal electrolytes can cause muscle cramps, weakness, irregular heartbeat, or seizures. Immediate medical attention may be required for severe imbalances.',
    risk: 'moderate'
  }
];

function findLow(vals, keys) {
  return keys.some(k => vals[k] && vals[k].status === 'low');
}
function findHigh(vals, keys) {
  return keys.some(k => vals[k] && vals[k].status === 'high');
}
function findAbnormal(vals, keys) {
  return keys.some(k => vals[k] && (vals[k].status === 'low' || vals[k].status === 'high'));
}

// ---- Report Text Parser ----
function parseReportText(text) {
  const found = {};
  const lines = text.split('\n');
  
  lines.forEach(line => {
    const lower = line.toLowerCase();
    // Try to find a value pattern like "Key: Value" or "Key Value (ref range)"
    const match = line.match(/^(.+?)[\s:]+([0-9,\.]+)\s*([a-zA-Z\/μ%°]+)?/);
    if (!match) return;
    
    const rawKey = match[1].trim().toLowerCase().replace(/[^a-z0-9\s\/\-]/g, '').trim();
    const rawVal = parseFloat(match[2].replace(',', ''));
    if (isNaN(rawVal)) return;
    
    // Try to find range in line: (Normal: X-Y) or (Ref: X-Y) or similar
    const rangeMatch = line.match(/[\(\[]\s*(?:normal|ref|reference|range)?\s*:?\s*([0-9,\.]+)\s*[-–]\s*([0-9,\.]+)/i);
    let refLow = null, refHigh = null;
    if (rangeMatch) {
      refLow = parseFloat(rangeMatch[1].replace(',', ''));
      refHigh = parseFloat(rangeMatch[2].replace(',', ''));
    }
    
    // Match to known biomarkers
    // Whole-word match; the key that appears first in the label wins (ties: longest key).
    // Stops "fasting" matching "ast", "HbA1c" matching "hb", "LDL Cholesterol" matching "cholesterol".
    const cand = Object.entries(BIOMARKER_DB).map(([key, db]) => {
      const m = new RegExp('(^|[^a-z0-9])' + key.replace(/[-\/]/g, '\\$&') + '(?![a-z0-9])').exec(rawKey);
      return m ? { key, db, pos: m.index + m[1].length } : null;
    }).filter(Boolean).sort((x, y) => x.pos - y.pos || y.key.length - x.key.length);
    if (!cand.length) Object.keys(BIOMARKER_DB).forEach(k => { if (k.length >= 5 && levenshtein(rawKey, k) <= 2) cand.push({ key: k, db: BIOMARKER_DB[k] }); });
    for (const { key, db } of cand.slice(0, 1)) {
      if (key) {
        if (!found[key]) {
          // Determine status
          let status = 'normal';
          const lo = typeof db.low === 'object' ? (db.low.M || db.low.F) : db.low;
          const hi = typeof db.high === 'object' ? (db.high.M || db.high.F) : db.high;
          const effectiveLow = refLow !== null ? refLow : lo;
          const effectiveHigh = refHigh !== null ? refHigh : hi;
          
          if (rawVal < effectiveLow * 0.8) status = 'low';
          else if (rawVal < effectiveLow) status = 'border-low';
          else if (rawVal > effectiveHigh * 1.2) status = 'high';
          else if (rawVal > effectiveHigh) status = 'border-high';
          
          found[key] = { value: rawVal, status, db, refLow: effectiveLow, refHigh: effectiveHigh };
        }
        break;
      }
    }
  });
  return found;
}

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 4) return 99;
  const dp = Array.from({length: m+1}, (_, i) => Array.from({length: n+1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ---- Health Score Calculation ----
function calculateHealthScore(parsedVals) {
  let score = 100;
  let issues = 0;
  Object.values(parsedVals).forEach(v => {
    if (v.status === 'high' || v.status === 'low') { score -= 8; issues++; }
    else if (v.status === 'border-high' || v.status === 'border-low') { score -= 3; }
  });
  return Math.max(10, Math.min(100, Math.round(score)));
}

// ---- Detect Diseases ----
function detectDiseases(parsedVals) {
  return DISEASE_PATTERNS
    .filter(d => d.check(parsedVals))
    .sort((a,b) => a.risk === 'high' ? -1 : 1);
}

// ---- Build Recommendations ----
function buildRecommendations(parsedVals, diseases) {
  const recs = [];
  if (diseases.find(d => d.name === 'Anaemia') || diseases.find(d => d.name === 'Iron Deficiency')) {
    recs.push('Eat iron-rich foods: spinach, lentils, red meat, beans, and fortified cereals. Take iron supplements as prescribed.');
    recs.push('Combine iron-rich foods with Vitamin C (lemon juice, oranges) to boost absorption. Avoid tea/coffee with meals.');
  }
  if (diseases.find(d => d.name === 'Diabetes / Pre-Diabetes')) {
    recs.push('Reduce refined carbohydrates (white rice, bread, sugar). Choose whole grains, vegetables, and lean protein.');
    recs.push('Exercise at least 30 minutes daily (brisk walking). Consistent physical activity significantly reduces blood sugar.');
    recs.push('Monitor blood sugar at home regularly. Maintain a food diary to track what spikes your glucose levels.');
  }
  if (diseases.find(d => d.name === 'Liver Disease / Hepatitis')) {
    recs.push('Avoid alcohol completely. Even small amounts can worsen liver inflammation and damage.');
    recs.push('Avoid over-the-counter painkillers like paracetamol/acetaminophen without medical guidance — they stress the liver.');
  }
  if (diseases.find(d => d.name === 'Kidney Dysfunction (CKD Risk)')) {
    recs.push('Stay well hydrated (2–3 litres of water daily) unless your doctor has restricted fluid intake.');
    recs.push('Reduce salt and protein intake as directed. Avoid NSAIDs (ibuprofen, aspirin) as they reduce kidney blood flow.');
  }
  if (diseases.find(d => d.name === 'High Cholesterol (Dyslipidaemia)')) {
    recs.push('Follow a heart-healthy diet: increase fibre (oats, vegetables), reduce saturated fats (red meat, butter, fried foods).');
    recs.push('Exercise 150 minutes/week. Physical activity raises HDL (good cholesterol) and lowers LDL and triglycerides.');
  }
  if (diseases.find(d => d.name === 'Hypothyroidism (Underactive Thyroid)') || diseases.find(d => d.name === 'Hyperthyroidism (Overactive Thyroid)')) {
    recs.push('Thyroid conditions require medication. Do not self-medicate. Your doctor will prescribe the right dose.');
    recs.push('Take thyroid medication on an empty stomach, at the same time daily, and avoid calcium/iron supplements within 4 hours.');
  }
  if (diseases.find(d => d.name === 'Vitamin D Deficiency')) {
    recs.push('Get 15–30 minutes of morning sunlight exposure daily. Take Vitamin D3 supplements as advised by your doctor.');
  }
  if (diseases.find(d => d.name === 'Vitamin B12 Deficiency')) {
    recs.push('Take Vitamin B12 supplements or injections as prescribed. Vegetarians/vegans are at higher risk and should supplement regularly.');
  }
  if (diseases.find(d => d.name === 'Gout (High Uric Acid)')) {
    recs.push('Avoid alcohol (especially beer), organ meats (liver, kidney), shellfish, and high-fructose corn syrup.');
    recs.push('Drink at least 3 litres of water daily to flush uric acid through the kidneys and reduce crystal formation.');
  }
  if (diseases.find(d => d.name === 'Infection or Inflammation')) {
    recs.push('If you have fever, severe pain, or feel very unwell, seek urgent medical care. Infections may need antibiotics.');
    recs.push('Rest, stay hydrated, and complete any antibiotic course fully to prevent resistance.');
  }
  if (recs.length === 0) {
    recs.push('Maintain a balanced diet rich in vegetables, fruits, whole grains, lean proteins, and healthy fats.');
    recs.push('Exercise at least 30 minutes a day, 5 days a week. Physical activity is the single best preventive medicine.');
    recs.push('Schedule a repeat blood test in 6–12 months to track your health trends over time.');
    recs.push('Stay well hydrated, limit processed foods, manage stress, and get 7–9 hours of quality sleep nightly.');
  }
  recs.push('Share this AI-generated summary with your doctor. It does not replace a clinical diagnosis but provides an excellent starting point for discussion.');
  return recs;
}

// ---- Sample Report ----
window.loadSampleReport = function() {
  document.getElementById('report-text-input').value = `COMPLETE BLOOD COUNT (CBC)
Haemoglobin: 9.2 g/dL          (Normal: 13.0 - 17.0)
WBC Count: 12,500 /μL           (Normal: 4000 - 11000)
Platelet Count: 140,000 /μL     (Normal: 150,000 - 400,000)
RBC Count: 3.8 million/μL       (Normal: 4.5 - 5.5)
MCV: 68 fL                      (Normal: 80 - 100)
MCH: 24 pg                      (Normal: 27 - 33)
Neutrophils: 80%                 (Normal: 40 - 75)
Lymphocytes: 14%                 (Normal: 20 - 40)

LIVER FUNCTION TEST (LFT)
SGPT/ALT: 95 U/L                (Normal: 7 - 56)
SGOT/AST: 68 U/L                (Normal: 10 - 40)
Total Bilirubin: 2.4 mg/dL      (Normal: 0.2 - 1.2)
Albumin: 3.2 g/dL               (Normal: 3.5 - 5.0)
Alkaline Phosphatase: 185 U/L   (Normal: 44 - 147)

LIPID PROFILE
Total Cholesterol: 245 mg/dL    (Normal: < 200)
LDL Cholesterol: 168 mg/dL      (Normal: < 130)
HDL Cholesterol: 32 mg/dL       (Normal: > 40)
Triglycerides: 215 mg/dL        (Normal: < 150)

DIABETES PANEL
Fasting Blood Sugar (FBS): 128 mg/dL  (Normal: 70 - 100)
HbA1c: 7.2%                          (Normal: < 5.7)

KIDNEY FUNCTION TEST
Creatinine: 1.4 mg/dL          (Normal: 0.7 - 1.2)
Blood Urea Nitrogen (BUN): 24 mg/dL  (Normal: 7 - 20)
Uric Acid: 8.1 mg/dL           (Normal: 3.5 - 7.2)

VITAMINS
Vitamin B12: 145 pg/mL         (Normal: 200 - 900)
Vitamin D: 14 ng/mL            (Normal: 30 - 100)
Ferritin: 6 ng/mL              (Normal: 24 - 336)`;
  showToast('Sample report loaded! Click Analyze.', 'success');
};

window.clearReportText = function() {
  document.getElementById('report-text-input').value = '';
  document.getElementById('report-name').value = '';
};

// ---- Main Analyze Function ----
window.analyzeReport = function() {
  const text = document.getElementById('report-text-input').value.trim();
  if (!text || text.length < 20) {
    showToast('Please paste your medical report text first.', 'error');
    anime({ targets: '#btn-analyze', translateX: [-6,6,-4,4,0], duration: 300, easing: 'linear' });
    return;
  }
  
  const btn = document.getElementById('btn-analyze');
  btn.disabled = true;
  
  // Show progress
  const progress = document.getElementById('analyze-progress');
  const progressFill = document.getElementById('progress-fill');
  progress.style.display = 'flex';
  document.getElementById('results-empty').style.display = 'none';
  document.getElementById('results-content').style.display = 'none';
  
  const steps = [
    { id:'pstep-1', label:'Reading your report...', width:'25%' },
    { id:'pstep-2', label:'Identifying medical values...', width:'50%' },
    { id:'pstep-3', label:'Analyzing biomarkers & detecting diseases...', width:'75%' },
    { id:'pstep-4', label:'Generating your health summary...', width:'100%' }
  ];
  
  let stepIdx = 0;
  const runStep = () => {
    if (stepIdx >= steps.length) {
      // Done - render results
      setTimeout(() => {
        progress.style.display = 'none';
        btn.disabled = false;
        finishAnalysis(text);
      }, 400);
      return;
    }
    const s = steps[stepIdx];
    document.getElementById('progress-label').textContent = s.label;
    progressFill.style.width = s.width;
    // Mark steps active/done
    for (let i = 0; i < steps.length; i++) {
      const el = document.getElementById(steps[i].id);
      if (i < stepIdx) { el.className = 'pstep done'; el.innerHTML = '<i class="fa-solid fa-check"></i> ' + el.textContent.replace(/✓ /,''); }
      else if (i === stepIdx) el.className = 'pstep active';
      else el.className = 'pstep';
    }
    stepIdx++;
    setTimeout(runStep, 700);
  };
  runStep();
};

function finishAnalysis(text) {
  const parsedVals = parseReportText(normalizeReportText(text));
  state.lastParsed = parsedVals;
  const diseases = detectDiseases(parsedVals);
  const healthScore = calculateHealthScore(parsedVals);
  const recs = buildRecommendations(parsedVals, diseases);
  const patientName = document.getElementById('report-name').value.trim() || (state.currentUser ? state.currentUser.name : 'Patient');
  const reportType = document.getElementById('report-type').value;
  const reportTypeName = document.getElementById('report-type').options[document.getElementById('report-type').selectedIndex].text;
  
  // Determine alert level
  const criticalDiseases = diseases.filter(d => d.risk === 'high');
  const warnDiseases = diseases.filter(d => d.risk === 'moderate');
  let alertLevel = 'Normal';
  let alertClass = 'ok';
  let alertIcon = 'fa-circle-check';
  let alertTitle = 'All Values in Healthy Range';
  let alertDesc = 'Your key biomarkers are within normal limits. Great job maintaining your health! Continue with routine checkups.';
  
  if (criticalDiseases.length > 0) {
    alertLevel = 'Critical';
    alertClass = 'critical';
    alertIcon = 'fa-circle-exclamation';
    alertTitle = `${criticalDiseases.length} Critical Finding${criticalDiseases.length > 1 ? 's' : ''} Detected`;
    alertDesc = `Your report shows ${criticalDiseases.map(d=>d.name).join(', ')}. Please consult a doctor promptly. This AI summary should be shared with your physician for clinical evaluation.`;
  } else if (warnDiseases.length > 0 || Object.values(parsedVals).some(v => v.status === 'high' || v.status === 'low')) {
    alertLevel = 'Attention';
    alertClass = 'warning';
    alertIcon = 'fa-triangle-exclamation';
    alertTitle = `${Object.values(parsedVals).filter(v=>v.status==='high'||v.status==='low').length} Values Need Attention`;
    alertDesc = `Some biomarkers are outside the normal range. Lifestyle changes and a doctor consultation are recommended to prevent progression.`;
  }
  
  // Save to alerts
  if (alertClass !== 'ok') {
    state.alerts = diseases.filter(d => d.risk === 'high').map(d => ({
      type: d.risk === 'high' ? 'critical' : 'warning',
      title: d.name,
      desc: d.desc.split('.')[0] + '.'
    }));
    updateAlerts();
  }
  
  // Save report
  const reportRecord = {
    id: Date.now().toString(),
    date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    patientName,
    reportType: reportTypeName,
    healthScore,
    alertLevel,
    parsedCount: Object.keys(parsedVals).length,
    diseaseCount: diseases.length,
    rawText: text
  };
  state.reports.push(reportRecord);
  persistReport(reportRecord);
  updateStats();
  renderRecentReports();
  
  // Render HTML
  renderResults(parsedVals, diseases, healthScore, recs, patientName, reportTypeName, alertLevel, alertClass, alertIcon, alertTitle, alertDesc);
}

function renderResults(parsedVals, diseases, healthScore, recs, patientName, reportType, alertLevel, alertClass, alertIcon, alertTitle, alertDesc) {
  const container = document.getElementById('results-content');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '16px';
  
  const scoreClass = healthScore >= 70 ? 'score-good' : healthScore >= 50 ? 'score-moderate' : 'score-poor';
  
  // Build biomarker cards HTML
  const biomarkerCards = Object.entries(parsedVals).map(([key, v]) => {
    const statusClass = v.status === 'normal' ? 'bc-normal' : v.status === 'high' ? 'bc-high' : v.status === 'low' ? 'bc-low' : 'bc-border-' + v.status.split('-')[1];
    const badge = v.status === 'normal' ? 'Normal' : v.status === 'high' ? 'HIGH' : v.status === 'low' ? 'LOW' : v.status === 'border-high' ? 'Borderline' : 'Borderline';
    return `<div class="biomarker-card ${statusClass}">
      <div class="bc-header"><span class="bc-name">${v.db.name}</span><span class="bc-status-badge">${badge}</span></div>
      <div><span class="bc-value">${v.value.toLocaleString()}</span><span class="bc-unit">${v.db.unit}</span></div>
      <div class="bc-range">Normal: ${v.refLow} – ${v.refHigh} ${v.db.unit}</div>
      <div class="bc-explanation">${v.db.explain}</div>
    </div>`;
  }).join('');
  
  const noBiomarkers = Object.keys(parsedVals).length === 0 ? `<p style="color:var(--text-muted);font-size:13px;">No standard biomarker values could be automatically parsed. Try using the sample report format or ensure your report includes value and unit information.</p>` : '';
  
  // Build disease cards HTML
  const diseaseCards = diseases.length > 0 ? diseases.map(d => `
    <div class="disease-card risk-${d.risk}">
      <div class="disease-icon"><i class="fa-solid ${d.icon}"></i></div>
      <div class="disease-info">
        <div class="disease-name">${d.name}</div>
        <div class="disease-desc">${d.desc}</div>
      </div>
      <span class="disease-risk-badge">${d.risk === 'high' ? 'High Risk' : d.risk === 'moderate' ? 'Moderate' : 'Low'}</span>
    </div>`).join('') : `<div class="alert-summary-box ok"><i class="fa-solid fa-circle-check"></i><div><h4>No disease patterns detected</h4><p>Based on the values found in your report, no specific disease patterns were flagged. Continue routine health monitoring.</p></div></div>`;
  
  // Build recommendations HTML
  const recItems = recs.map(r => `<div class="rec-item"><i class="fa-solid fa-arrow-right-to-bracket"></i><p>${r}</p></div>`).join('');
  
  container.innerHTML = `
    <div class="result-header-bar">
      <div class="result-header-left">
        <h3>Analysis Complete</h3>
        <p>${patientName} &bull; ${reportType} &bull; ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
      </div>
      <div class="health-score-badge ${scoreClass}">
        <span class="hs-val">${healthScore}</span>
        <span class="hs-lbl">Health Score</span>
      </div>
    </div>
    
    <div class="alert-summary-box ${alertClass}">
      <i class="fa-solid ${alertIcon}"></i>
      <div><h4>${alertTitle}</h4><p>${alertDesc}</p></div>
    </div>
    
    ${Object.keys(parsedVals).length > 0 ? `
    <div class="result-section">
      <div class="result-section-title"><i class="fa-solid fa-chart-bar"></i> Biomarker Analysis (${Object.keys(parsedVals).length} values read)</div>
      <div class="biomarker-grid">${biomarkerCards}</div>
    </div>` : `<div class="result-section"><div class="result-section-title"><i class="fa-solid fa-chart-bar"></i> Biomarker Analysis</div>${noBiomarkers}</div>`}
    
    <div class="result-section">
      <div class="result-section-title"><i class="fa-solid fa-virus-covid"></i> Possible Conditions Detected (${diseases.length})</div>
      <div class="disease-grid">${diseaseCards}</div>
    </div>
    
    <div class="result-section">
      <div class="result-section-title"><i class="fa-solid fa-lightbulb"></i> Recommendations for You</div>
      <div class="recommendations-list">${recItems}</div>
    </div>
    
    <div class="report-action-bar">
      <button class="btn-action btn-action-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> Print Report</button>
      <button class="btn-action btn-action-secondary" onclick="copyReportSummary()"><i class="fa-solid fa-copy"></i> Copy Summary</button>
      <button class="btn-action btn-action-secondary" onclick="navigateTo('bodymodel')"><i class="fa-solid fa-person"></i> 3D Body Model</button>
      <button class="btn-action btn-action-secondary" onclick="navigateTo('history')"><i class="fa-solid fa-clock-rotate-left"></i> View History</button>
    </div>
    <p style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--warning)"></i>
      This AI analysis is for informational purposes only and does not constitute medical advice. Always consult a qualified physician for diagnosis and treatment.
    </p>`;
  
  polishResults();
  // Animate results in
  anime({
    targets: '#results-content > *',
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(80),
    duration: 500,
    easing: 'easeOutExpo'
  });
  
  anime({
    targets: '.biomarker-card',
    opacity: [0, 1],
    scale: [0.9, 1],
    delay: anime.stagger(40, {start: 400}),
    duration: 400,
    easing: 'easeOutBack'
  });
  
  showToast('Analysis complete! Scroll to view your results.', 'success');
}

window.copyReportSummary = function() {
  const lastReport = state.reports[state.reports.length - 1];
  if (!lastReport) return;
  const text = `HealthSync AI Report Summary\nPatient: ${lastReport.patientName}\nDate: ${lastReport.date}\nReport: ${lastReport.reportType}\nHealth Score: ${lastReport.healthScore}/100\nStatus: ${lastReport.alertLevel}\n\nGenerated by HealthSync AI - Share this with your doctor.`;
  navigator.clipboard.writeText(text).then(() => showToast('Summary copied to clipboard!', 'success')).catch(() => showToast('Copy failed. Please try again.', 'error'));
};

function viewReport(r) {
  navigateTo('analyzer');
  if (r.rawText) {
    document.getElementById('report-text-input').value = r.rawText;
    showToast('Report loaded. Click Analyze to re-run.', 'info');
  }
}

// Saves one new report to MongoDB (called right after an analysis finishes)
async function persistReport(record) {
  if (!state.currentUser) return;
  try {
    const { id, ...body } = record;
    const data = await api('/reports', { method: 'POST', body });
    record.id = data.report.id; // use the real MongoDB id
  } catch (err) {
    showToast('Report not saved: ' + errMsg(err), 'error');
  }
}

// ---- Toast ----
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const icon = toast.querySelector('.toast-icon');
  msgEl.textContent = msg;
  toast.className = 'toast';
  if (type === 'error') { toast.classList.add('toast-error'); icon.className = 'toast-icon fa-solid fa-circle-xmark'; }
  else if (type === 'warning') { toast.classList.add('toast-warning'); icon.className = 'toast-icon fa-solid fa-triangle-exclamation'; }
  else if (type === 'info') { icon.className = 'toast-icon fa-solid fa-circle-info'; }
  else { icon.className = 'toast-icon fa-solid fa-circle-check'; }
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3500);
}


/* =============================================================
   NEW: FILE UPLOAD (image / PDF / DOCX / TXT) - all read in-browser
============================================================= */
window.setInputMode = function(m) {
  const f = m === 'file';
  document.getElementById('dropzone').style.display = f ? 'flex' : 'none';
  document.getElementById('text-container').style.display = f ? 'none' : 'block';
  document.getElementById('itab-file').classList.toggle('active', f);
  document.getElementById('itab-text').classList.toggle('active', !f);
};

async function ocrImage(src, setMsg) {
  const r = await Tesseract.recognize(src, 'eng', { logger: m => {
    if (m.status === 'recognizing text') setMsg(`Reading image... ${Math.round(m.progress * 100)}%`);
  }});
  return r.data.text;
}

async function extractPdf(file, setMsg) {
  const w = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([`importScripts("${w}");`], { type: 'text/javascript' }));
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 10); p++) {
    setMsg(`Reading page ${p} of ${pdf.numPages}...`);
    const page = await pdf.getPage(p);
    const rows = {};
    (await page.getTextContent()).items.forEach(i => { const y = Math.round(i.transform[5] / 3); (rows[y] = rows[y] || []).push(i); });
    let t = Object.keys(rows).sort((a, b) => b - a)
      .map(y => rows[y].sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(' ')).join('\n');
    if (t.replace(/\s/g, '').length < 40) {            // scanned page -> OCR it
      const vp = page.getViewport({ scale: 2 }), c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      t = await ocrImage(c, setMsg);
    }
    out += t + '\n';
  }
  return out;
}

window.handleFileSelect = async function(file) {
  if (!file) return;
  const st = document.getElementById('file-status');
  const setMsg = m => { st.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> '; st.append(m); };
  try {
    const n = file.name.toLowerCase();
    let text = '';
    setMsg(`Loading ${file.name}...`);
    if (file.type.startsWith('image/')) text = await ocrImage(file, setMsg);
    else if (n.endsWith('.pdf')) text = await extractPdf(file, setMsg);
    else if (n.endsWith('.docx')) text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    else text = await file.text();
    if (text.trim().length < 20) throw new Error('No readable text found. Try a clearer photo or paste the text.');
    document.getElementById('report-text-input').value = text.trim();
    st.textContent = '';
    setInputMode('text');
    showToast('Report read! Check the text, then click Analyze.', 'success');
    if (!RM) anime({ targets: '#btn-analyze', scale: [1, 1.04, 1], duration: 900, loop: 3, easing: 'easeInOutSine' });
  } catch (e) {
    st.textContent = e.message || 'Could not read that file.';
    st.classList.add('fs-err');
    showToast('Could not read that file.', 'error');
  }
  document.getElementById('file-input').value = '';
};

// OCR / PDF text often has the reference range without brackets: wrap it so the parser sees it
function normalizeReportText(t) {
  return t.split('\n').map(l => /[\(\[]/.test(l) ? l :
    l.replace(/\s([0-9][0-9,\.]*\s*[-–]\s*[0-9][0-9,\.]*)\s*$/, ' ($1)')).join('\n');
}

/* =============================================================
   NEW: BODY MAP - organs light up from the report findings
============================================================= */
const ORGANS = {
  blood:    { n:'Blood & Immunity', k:['haemoglobin','hemoglobin','hb','wbc','wbc count','rbc','platelet','platelets','mcv','mch','mchc','hematocrit','pcv','neutrophils','lymphocytes','eosinophils','monocytes','basophils','ferritin','iron','tibc','transferrin','crp','esr','zinc'] },
  bones:    { n:'Bones', k:['vitamin d','vitamin d3','calcium','phosphorus','alkaline phosphatase','alp'] },
  brain:    { n:'Brain & Nerves', k:['vitamin b12','b12','folate'] },
  thyroid:  { n:'Thyroid', k:['tsh','t3','t4','free t3','free t4'] },
  heart:    { n:'Heart & Vessels', k:['troponin','ck-mb','creatine kinase','ldh','total cholesterol','cholesterol','ldl','hdl','triglycerides','vldl','potassium'] },
  liver:    { n:'Liver', k:['sgpt','alt','sgot','ast','bilirubin','total bilirubin','direct bilirubin','indirect bilirubin','alkaline phosphatase','alp','ggt','albumin','total protein','globulin'] },
  pancreas: { n:'Pancreas (Blood Sugar)', k:['hba1c','fbs','fasting glucose','fasting blood sugar','pp glucose','glucose','insulin'] },
  kidneys:  { n:'Kidneys', k:['creatinine','urea','bun','egfr','uric acid','sodium','potassium','chloride','calcium','magnesium','phosphorus','protein urine','glucose urine','ketones','ph urine'] },
  hormones: { n:'Hormones (Adrenal & Reproductive)', k:['cortisol','testosterone','estrogen','prolactin'] }
};
const STATE_TXT = { none:'No markers in this report', ok:'Healthy', watch:'Borderline', alert:'Needs attention' };

function organStates(parsed) {
  const sev = m => (m.status === 'high' || m.status === 'low') ? 2 : m.status === 'normal' ? 0 : 1;
  const out = {};
  for (const [id, o] of Object.entries(ORGANS)) {
    const markers = o.k.filter(k => parsed[k]).map(k => ({ key: k, ...parsed[k] }));
    const worst = markers.reduce((a, m) => Math.max(a, sev(m)), -1);
    out[id] = { markers, state: worst < 0 ? 'none' : ['ok', 'watch', 'alert'][worst] };
  }
  return out;
}

function gaugePos(m) {
  let lo = m.refLow, hi = m.refHigh;
  if (hi >= 999) hi = lo * 2 || 1;
  return Math.max(3, Math.min(97, 20 + (m.value - lo) / ((hi - lo) || 1) * 60));
}

/* =============================================================
   NEW: UI POLISH (anime.js) - orbs, ECG line, ripples, page transitions
============================================================= */
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

function polishResults() {
  const hv = document.querySelector('#results-content .hs-val');
  if (!hv) return;
  const t = +hv.textContent;
  anime({ targets: { v: 0 }, v: t, duration: 1400, easing: 'easeOutExpo', update: a => { hv.textContent = Math.round(a.animations[0].currentValue); } });
}

const _navigateTo = window.navigateTo;
window.navigateTo = function(p) {
  _navigateTo(p);
  anime({ targets: '#page-' + p, opacity: [0, 1], translateY: [14, 0], duration: 450, easing: 'easeOutCubic' });
};

function initUIPolish() {
  ['#6366f1', '#06b6d4', '#a855f7'].forEach((c, i) => {
    const o = document.createElement('div');
    o.className = 'orb';
    o.style.cssText = `background:${c};left:${[5, 70, 40][i]}%;top:${[10, 55, 80][i]}%`;
    document.body.appendChild(o);
    if (!RM) anime({ targets: o, translateX: () => anime.random(-120, 120), translateY: () => anime.random(-100, 100), duration: () => anime.random(7000, 11000), direction: 'alternate', loop: true, easing: 'easeInOutSine' });
  });
  anime({ targets: '.nav-item', opacity: [0, 1], translateX: [-18, 0], delay: anime.stagger(70, { start: 300 }), duration: 600, easing: 'easeOutExpo' });

  const hero = document.querySelector('.welcome-hero');
  if (hero && !RM) {
    hero.insertAdjacentHTML('beforeend', '<svg class="ecg" viewBox="0 0 600 60" preserveAspectRatio="none"><path d="M0 30H120l10-6 8 6h30l8-26 12 52 10-34 8 8h70l10-6 8 6h40l8-26 12 52 10-34 8 8H600"/></svg>');
    anime({ targets: '.ecg path', strokeDashoffset: [anime.setDashoffset, 0], duration: 2600, loop: true, easing: 'easeInOutSine' });
  }
  document.addEventListener('mousemove', e => {
    const c = e.target.closest && e.target.closest('.stat-card,.section-card,.disease-card,.biomarker-card,.how-step');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', e.clientX - r.left + 'px');
    c.style.setProperty('--my', e.clientY - r.top + 'px');
  });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.btn-analyze,.btn-hero,.btn-action,.btn-auth,.btn-demo,.btn-sm');
    if (!b || RM) return;
    const r = b.getBoundingClientRect(), s = document.createElement('span');
    s.className = 'ripple';
    s.style.left = e.clientX - r.left + 'px';
    s.style.top = e.clientY - r.top + 'px';
    b.appendChild(s);
    anime({ targets: s, scale: [0, 18], opacity: [0.45, 0], duration: 650, easing: 'easeOutQuad', complete: () => s.remove() });
  });
  const dz = document.getElementById('dropzone');
  if (dz) {
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => handleFileSelect(e.dataTransfer.files[0]));
  }
}
document.addEventListener('DOMContentLoaded', initUIPolish);

/* =============================================================
   3D BODY MODEL (three.js) + ORGAN INSIGHTS PAGE
============================================================= */
const ORGAN_INFO = {
  blood:   { icon:'fa-droplet', cond:/anaemia|iron|infection|platelet|b12/i, desc:'Blood carries oxygen, nutrients and immune cells around the body. Red cells, white cells, platelets and iron stores show how well you carry oxygen, fight infection and clot.' },
  bones:   { icon:'fa-bone', cond:/vitamin d/i, desc:'Bones give structure and store calcium and phosphorus. Vitamin D, calcium and ALP help show bone strength and mineral balance.' },
  brain:   { icon:'fa-brain', cond:/b12/i, desc:'The brain and nerves depend on vitamin B12 and folate. Low levels can cause tingling, memory problems and tiredness.' },
  thyroid: { icon:'fa-bolt', cond:/thyroid/i, desc:'The thyroid sets your metabolism, energy and heart rate through T3 and T4, which are controlled by TSH.' },
  heart:   { icon:'fa-heart-pulse', cond:/cholesterol|cardio/i, desc:'The heart pumps blood to every organ. Cholesterol, triglycerides and cardiac enzymes show artery health and heart-attack risk.' },
  liver:   { icon:'fa-shield-virus', cond:/liver/i, desc:'The liver filters toxins, makes proteins and bile, and processes medicines. ALT, AST, ALP and bilirubin rise when liver cells or bile ducts are stressed.' },
  pancreas:{ icon:'fa-syringe', cond:/diabetes/i, desc:'The pancreas makes insulin, which controls blood sugar. Fasting glucose and HbA1c show how well sugar is controlled over time.' },
  kidneys: { icon:'fa-filter', cond:/kidney|gout|electrolyte/i, desc:'The kidneys filter waste, balance fluids and electrolytes, and help control blood pressure. Creatinine, urea and eGFR show how well they filter.' },
  hormones:{ icon:'fa-dna', cond:/(?!)/, desc:'The adrenal glands and reproductive organs release hormones for stress response, growth, mood and fertility. Cortisol, testosterone, estrogen and prolactin track their balance.' }
};
const OMAT = { none:[0x64748b, 0.05], ok:[0x22c55e, 0.35], watch:[0xf59e0b, 0.6], alert:[0xef4444, 1] };
const B3 = { ready:false, sel:null, hover:null, spin:true, drag:false, busy:false, meshes:{}, all:[], pulse:{ v:0 }, st:{} };

function getLatestParsed() {
  if (state.lastParsed) return state.lastParsed;
  const r = state.reports[state.reports.length - 1];
  return r && r.rawText ? parseReportText(normalizeReportText(r.rawText)) : {};
}
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
}
function markersHtml(s, o) {
  return s.markers.length ? s.markers.map(m => `
    <div class="bm-row"><div class="bm-rh"><b>${m.db.name}</b><span class="bm-val ${m.status.replace('border-', 'b-')}">${m.value.toLocaleString()} ${m.db.unit}</span></div>
    <div class="bm-gauge"><i style="left:${gaugePos(m)}%"></i></div>
    <small>Normal: ${m.refLow} – ${m.refHigh} ${m.db.unit}</small><p>${m.db.explain}</p></div>`).join('')
    : `<p class="bm-empty">This report has no markers for this organ. Related tests: ${[...new Set(o.k.map(k => BIOMARKER_DB[k].name))].slice(0, 6).join(', ')}.</p>`;
}

function initBody3D() {
  const host = document.getElementById('body3d');
  if (!host) return;
  const ids = Object.keys(ORGANS);
  B3.st = organStates(getLatestParsed());
  document.getElementById('bm3d-chips').innerHTML = ids.map(id => `<button class="bm-chip ${B3.st[id].state}" onclick="bm3dSelect('${id}')"><i class="dot"></i>${ORGANS[id].n}</button>`).join('');
  const worst = ['alert', 'watch', 'ok'].map(s => ids.find(i => B3.st[i].state === s)).find(Boolean);
  if (B3.ready) { B3.apply(); B3.resize(); const p = B3.pending || B3.sel || worst; B3.pending = null; if (p) B3.select(p); return; }
  if (!window.THREE || !hasWebGL()) { host.innerHTML = '<p class="bm-empty" style="padding:60px;text-align:center">The 3D view needs WebGL and an internet connection (three.js did not load).</p>'; return; }

  const T = THREE, W = () => host.clientWidth || 600, H = () => host.clientHeight || 560;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(40, W() / H(), 0.1, 100);
  const ren = new T.WebGLRenderer({ antialias: true, alpha: true });
  ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); ren.setSize(W(), H());
  host.appendChild(ren.domElement);
  cam.position.set(0, 0.1, 8.2);
  scene.add(new T.AmbientLight(0xffffff, 0.6));
  const dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 5, 6); scene.add(dl);
  const pl = new T.PointLight(0x6366f1, 1.4, 25); pl.position.set(-4, 2, 3); scene.add(pl);
  const rig = new T.Group(); scene.add(rig);

  // glass body shell
  const shellMat = new T.MeshStandardMaterial({ color: 0x818cf8, transparent: true, opacity: 0.13, roughness: 0.3, metalness: 0.2, depthWrite: false });
  const shell = (geo, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) => { const m = new T.Mesh(geo, shellMat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.z = rz; rig.add(m); };
  const S = (r = 1) => new T.SphereGeometry(r, 32, 24);
  shell(S(), 0, 1.95, 0, 0.4, 0.45, 0.4);
  shell(new T.CylinderGeometry(0.13, 0.16, 0.3, 16), 0, 1.5, 0);
  shell(S(), 0, 0.95, 0, 0.72, 0.62, 0.4);
  shell(new T.CylinderGeometry(0.5, 0.45, 0.7, 24), 0, 0.05, 0, 1, 1, 0.6);
  shell(S(), 0, -0.5, 0, 0.52, 0.35, 0.33);
  [-1, 1].forEach(s => {
    shell(new T.CylinderGeometry(0.12, 0.09, 1.7, 14), s * 1.0, 0.45, 0, 1, 1, 1, s * 0.08);
    shell(new T.CylinderGeometry(0.2, 0.14, 2.1, 16), s * 0.28, -1.55, 0);
  });

  // organs
  const mk = (id, geo, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0, decor = false) => {
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1, transparent: true }));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.z = rz; m.renderOrder = 1;
    m.userData.b = [sx, sy, sz];
    if (decor) { m.material.color.setHex(0x94a3b8); m.material.opacity = 0.18; rig.add(m); return m; }
    m.userData.organ = id; (B3.meshes[id] = B3.meshes[id] || []).push(m); B3.all.push(m); rig.add(m); return m;
  };
  const tube = (id, pts, r = 0.03) => mk(id, new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 24, r, 8, false), 0, 0, 0);
  mk('brain', S(), 0, 2.05, 0, 0.3, 0.22, 0.26);
  mk('thyroid', S(), -0.08, 1.43, 0.1, 0.09, 0.07, 0.07); mk('thyroid', S(), 0.08, 1.43, 0.1, 0.09, 0.07, 0.07);
  mk('heart', S(), 0.14, 0.88, 0.12, 0.17, 0.2, 0.15, -0.3);
  mk('liver', S(), -0.28, 0.5, 0.1, 0.3, 0.14, 0.18, 0.15);
  mk('pancreas', new T.CylinderGeometry(0.05, 0.05, 0.38, 12), 0, 0.27, 0.02, 1, 1, 1, Math.PI / 2);
  mk('kidneys', S(), -0.32, 0.22, -0.15, 0.08, 0.14, 0.08); mk('kidneys', S(), 0.32, 0.22, -0.15, 0.08, 0.14, 0.08);
  mk('hormones', S(), -0.32, 0.42, -0.15, 0.05, 0.04, 0.05); mk('hormones', S(), 0.32, 0.42, -0.15, 0.05, 0.04, 0.05); mk('hormones', S(), 0, -0.5, 0.1, 0.09, 0.09, 0.09);
  tube('blood', [[0, 1.4, -0.05], [0, 0.5, -0.05], [0, -0.45, -0.05]]);
  [-1, 1].forEach(s => {
    tube('blood', [[s * 0.2, 1.3, -0.02], [s * 0.7, 1.2, 0], [s * 1.0, 0.4, 0], [s * 1.05, -0.3, 0]]);
    tube('blood', [[s * 0.15, -0.5, 0], [s * 0.25, -1.4, 0], [s * 0.28, -2.4, 0]]);
    mk('bones', new T.CylinderGeometry(0.06, 0.06, 1.1, 10), s * 0.28, -1.1, 0.0);
    mk('bones', new T.CylinderGeometry(0.05, 0.05, 0.9, 10), s * 0.28, -2.1, 0.0);
  });
  mk(null, S(), -0.33, 1.0, 0, 0.28, 0.42, 0.22, 0, true); mk(null, S(), 0.33, 1.0, 0, 0.28, 0.42, 0.22, 0, true);   // lungs
  mk(null, S(), 0.2, 0.45, 0.12, 0.14, 0.12, 0.1, 0, true);                                                     // stomach
  mk(null, new T.TorusGeometry(0.2, 0.07, 10, 24), 0, -0.1, 0.1, 1, 1, 1, 0, true);                              // intestines

  B3.apply = () => ids.forEach(id => (B3.meshes[id] || []).forEach(m => {
    const [c, e] = OMAT[B3.st[id].state];
    m.material.color.setHex(c); m.material.emissive.setHex(c); m.material.emissiveIntensity = e;
    m.material.opacity = B3.st[id].state === 'none' ? 0.55 : 0.95;
  }));
  B3.resize = () => { cam.aspect = W() / H(); cam.updateProjectionMatrix(); ren.setSize(W(), H()); };
  window.addEventListener('resize', () => B3.ready && B3.resize());

  const ray = new T.Raycaster(), v2 = new T.Vector2();
  const pick = e => {
    const r = ren.domElement.getBoundingClientRect();
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, cam);
    const h = ray.intersectObjects(B3.all)[0];
    return h ? h.object.userData.organ : null;
  };
  const cv = ren.domElement; let px = 0, py = 0, moved = 0;
  cv.addEventListener('pointerdown', e => { B3.drag = true; px = e.clientX; py = e.clientY; moved = 0; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (B3.drag) {
      const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      rig.rotation.y += dx * 0.01; rig.rotation.x = Math.max(-0.5, Math.min(0.5, rig.rotation.x + dy * 0.005));
    } else { B3.hover = pick(e); cv.style.cursor = B3.hover ? 'pointer' : 'grab'; }
  });
  cv.addEventListener('pointerup', e => { B3.drag = false; if (moved < 5) { const id = pick(e); if (id) B3.select(id); } });
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.position.z = Math.max(5, Math.min(12, cam.position.z + e.deltaY * 0.004)); }, { passive: false });

  B3.select = id => {
    B3.sel = id;
    const base = Math.round(rig.rotation.y / (2 * Math.PI)) * 2 * Math.PI;
    B3.busy = true;
    anime({ targets: rig.rotation, y: id === 'kidneys' ? base + Math.PI : base, x: 0, duration: 900, easing: 'easeInOutCubic', complete: () => { B3.busy = false; } });
    B3.meshes[id].forEach(m => { const b = m.userData.b; anime({ targets: m.scale, x: [b[0] * 1.35, b[0]], y: [b[1] * 1.35, b[1]], z: [b[2] * 1.35, b[2]], duration: 800, easing: 'easeOutElastic(1,.6)' }); });
    document.querySelectorAll('#bm3d-chips .bm-chip').forEach((c, i) => c.classList.toggle('sel', ids[i] === id));
    const s = B3.st[id], n = s.markers.length, bad = s.markers.filter(m => m.status === 'high' || m.status === 'low').length, el = document.getElementById('bm3d-info');
    el.innerHTML = `<div class="bi-top"><i class="fa-solid ${ORGAN_INFO[id].icon}"></i><b>${ORGANS[id].n}</b><span class="bm-badge ${s.state}">${STATE_TXT[s.state]}</span></div>
      <p>${n ? `${n} marker${n > 1 ? 's' : ''} found${bad ? `, ${bad} out of range` : ', all in range'}.` : 'No markers for this organ in your latest report.'}</p>
      <button class="btn-sm" onclick="openInsight('${id}')">Full details <i class="fa-solid fa-arrow-right"></i></button>`;
    anime({ targets: el, opacity: [0, 1], translateY: [12, 0], duration: 400, easing: 'easeOutCubic' });
  };
  B3.reset = () => { B3.busy = true; anime({ targets: rig.rotation, y: 0, x: 0, duration: 800, easing: 'easeInOutCubic', complete: () => { B3.busy = false; } }); anime({ targets: cam.position, z: 8.2, duration: 800, easing: 'easeInOutCubic' }); };

  anime({ targets: B3.pulse, v: [0, 1], duration: 1100, direction: 'alternate', loop: true, easing: 'easeInOutSine' });
  const loop = () => {
    B3.raf = requestAnimationFrame(loop);
    if (state.currentPage !== 'bodymodel') return;
    if (B3.spin && !B3.drag && !B3.busy) rig.rotation.y += 0.004;
    ids.forEach(id => {
      const s = B3.st[id].state; let e = OMAT[s][1];
      if (s === 'alert') e = 0.45 + B3.pulse.v * 0.9;
      if (id === B3.sel) e += 0.35; if (id === B3.hover) e += 0.25;
      B3.meshes[id].forEach(m => { m.material.emissiveIntensity = e; });
    });
    ren.render(scene, cam);
  };
  B3.ready = true; B3.apply(); loop();
  // entrance
  B3.busy = true;
  anime({ targets: rig.rotation, y: [-2, 0], duration: 1600, easing: 'easeOutExpo', complete: () => { B3.busy = false; } });
  anime({ targets: cam.position, z: [13, 8.2], duration: 1600, easing: 'easeOutExpo' });
  B3.all.forEach((m, i) => { const b = m.userData.b; anime({ targets: m.scale, x: [0, b[0]], y: [0, b[1]], z: [0, b[2]], delay: 500 + i * 40, duration: 700, easing: 'easeOutBack' }); });
  const p = B3.pending || worst; B3.pending = null; if (p) setTimeout(() => B3.select(p), 900);
}
window.bm3dSelect = id => B3.ready && B3.select(id);
window.bm3dToggleSpin = () => { B3.spin = !B3.spin; showToast(B3.spin ? 'Auto-rotate on' : 'Auto-rotate off', 'info'); };
window.bm3dReset = () => B3.ready && B3.reset();
window.show3D = id => { B3.pending = id; navigateTo('bodymodel'); };
window.openInsight = id => { state.selOrgan = id; navigateTo('insights'); };

function renderInsights() {
  const parsed = getLatestParsed(), st = organStates(parsed), ids = Object.keys(ORGANS);
  const list = document.getElementById('insights-list'), det = document.getElementById('insights-detail');
  if (!Object.keys(parsed).length) {
    list.innerHTML = '';
    det.innerHTML = `<div class="results-empty"><div class="results-empty-icon"><i class="fa-solid fa-stethoscope"></i></div><h3>No report analyzed yet</h3><p>Analyze a report to see organ-by-organ descriptions, markers and linked conditions.</p><button class="btn-start" onclick="navigateTo('analyzer')">Analyze a Report</button></div>`;
    return;
  }
  const worst = ['alert', 'watch', 'ok'].map(s => ids.find(i => st[i].state === s)).find(Boolean) || ids[0];
  const sel = state.selOrgan && st[state.selOrgan] ? state.selOrgan : worst;
  const s = st[sel], info = ORGAN_INFO[sel], o = ORGANS[sel];
  list.innerHTML = ids.map(id => `<button class="ins-item ${st[id].state} ${id === sel ? 'active' : ''}" onclick="openInsight('${id}')"><i class="fa-solid ${ORGAN_INFO[id].icon}"></i><span>${ORGANS[id].n}</span><em>${st[id].markers.length || '-'}</em></button>`).join('');
  const dis = detectDiseases(parsed).filter(d => info.cond.test(d.name));
  det.innerHTML = `<div class="ins-head"><div class="ins-ico ${s.state}"><i class="fa-solid ${info.icon}"></i></div><div><h3>${o.n}</h3><span class="bm-badge ${s.state}">${STATE_TXT[s.state]}</span></div><button class="btn-sm" onclick="show3D('${sel}')"><i class="fa-solid fa-cube"></i> View in 3D</button></div>
    <p class="ins-desc">${info.desc}</p>
    <h4 class="ins-sub">What your report shows</h4>${markersHtml(s, o)}
    ${dis.length ? '<h4 class="ins-sub">Possible linked conditions</h4>' + dis.map(d => `<div class="disease-card risk-${d.risk}"><div class="disease-icon"><i class="fa-solid ${d.icon}"></i></div><div class="disease-info"><div class="disease-name">${d.name}</div><div class="disease-desc">${d.desc}</div></div><span class="disease-risk-badge">${d.risk === 'high' ? 'High Risk' : 'Moderate'}</span></div>`).join('') : ''}`;
  anime({ targets: '#insights-detail > *, #insights-detail .bm-row', opacity: [0, 1], translateY: [14, 0], delay: anime.stagger(50), duration: 450, easing: 'easeOutCubic' });
  anime({ targets: '.ins-item', opacity: [0, 1], translateX: [-14, 0], delay: anime.stagger(40), duration: 400, easing: 'easeOutCubic' });
}

/* =============================================================
   MORE ANIME.JS: letter wave, typewriter, nav indicator, orbits,
   floating dots, magnetic buttons, result burst
============================================================= */
function waveLetters(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  if (!el.querySelector('.ltr')) el.innerHTML = [...el.textContent].map(c => `<span class="ltr">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  anime({ targets: sel + ' .ltr', translateY: [24, 0], opacity: [0, 1], rotateZ: [8, 0], delay: anime.stagger(45), duration: 800, easing: 'easeOutBack' });
}
function typewriter(sel) {
  const el = document.querySelector(sel);
  if (!el || RM) return;
  const txt = el.textContent, o = { n: 0 };
  anime({ targets: o, n: txt.length, duration: txt.length * 22, easing: 'linear', update: () => { el.textContent = txt.slice(0, Math.round(o.n)); } });
}
function moveNavInd() {
  const nav = document.querySelector('.sidebar-nav'), a = nav && nav.querySelector('.nav-item.active');
  if (!a) return;
  let ind = nav.querySelector('.nav-ind');
  if (!ind) { ind = document.createElement('div'); ind.className = 'nav-ind'; nav.prepend(ind); }
  anime({ targets: ind, top: a.offsetTop, height: a.offsetHeight, duration: 450, easing: 'easeOutElastic(1,.7)' });
}
function burst(x, y, color) {
  if (RM) return;
  for (let i = 0; i < 22; i++) {
    const d = document.createElement('span'); d.className = 'burst';
    d.style.cssText = `left:${x}px;top:${y}px;background:${color}`;
    document.body.appendChild(d);
    const a = Math.random() * Math.PI * 2, r = anime.random(50, 130);
    anime({ targets: d, translateX: Math.cos(a) * r, translateY: Math.sin(a) * r, scale: [1, 0], opacity: [1, 0], duration: anime.random(700, 1100), easing: 'easeOutExpo', complete: () => d.remove() });
  }
}

const _rda = runDashboardAnimations;
runDashboardAnimations = function() {
  _rda();
  waveLetters('#hero-name');
  typewriter('#hero-subtitle');
  moveNavInd();
};
const _nav2 = window.navigateTo;
window.navigateTo = function(p) { _nav2(p); moveNavInd(); };
const _pr = polishResults;
polishResults = function() {
  _pr();
  const b = document.querySelector('#results-content .health-score-badge');
  if (b) { const r = b.getBoundingClientRect(); setTimeout(() => burst(r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(b).color), 500); }
};

document.addEventListener('DOMContentLoaded', () => {
  waveLetters('.auth-brand');
  setTimeout(moveNavInd, 600);
  if (RM) return;
  for (let i = 0; i < 26; i++) {                               // floating dots
    const d = document.createElement('i'); d.className = 'fdot';
    d.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${anime.random(3, 7)}px;height:${anime.random(3, 7)}px`;
    document.body.appendChild(d);
    anime({ targets: d, translateY: () => anime.random(-60, 60), translateX: () => anime.random(-30, 30), opacity: [0.1, 0.5], duration: () => anime.random(4000, 8000), direction: 'alternate', loop: true, easing: 'easeInOutSine' });
  }
  const rings = document.getElementById('hero-rings');         // orbiting satellites
  if (rings) [[60, 6000], [90, 9000], [120, 13000]].forEach(([s, t], i) => {
    const o = document.createElement('div'); o.className = 'orbit'; o.innerHTML = '<i class="sat"></i>';
    o.style.cssText = `inset:${-i * 10}px`; rings.appendChild(o);
    anime({ targets: o, rotate: i % 2 ? -360 : 360, duration: t, loop: true, easing: 'linear' });
  });
  document.addEventListener('mousemove', e => {                // magnetic buttons
    const b = e.target.closest && e.target.closest('.btn-hero,.btn-demo');
    if (!b) return;
    const r = b.getBoundingClientRect();
    anime({ targets: b, translateX: (e.clientX - r.left - r.width / 2) * 0.12, translateY: (e.clientY - r.top - r.height / 2) * 0.25, duration: 250, easing: 'easeOutQuad' });
  });
  document.addEventListener('mouseout', e => {
    const b = e.target.closest && e.target.closest('.btn-hero,.btn-demo');
    if (b) anime({ targets: b, translateX: 0, translateY: 0, duration: 600, easing: 'easeOutElastic(1,.5)' });
  });
});
