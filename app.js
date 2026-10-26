/* ========================================
   ExamFlow — Main Application Logic
   ======================================== */

// ── Default Starter Questions ─────────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  {
    question: '1 + 1 มีค่าเท่ากับเท่าไร?',
    choices: ['1', '2', '3', '4'],
    answer: 1, // 0-based: choice 2
  },
  {
    question: 'เมืองหลวงของประเทศไทยคือเมืองใด?',
    choices: ['กรุงเทพมหานคร', 'เชียงใหม่', 'ขอนแก่น', 'ภูเก็ต'],
    answer: 0,
  },
  {
    question: 'โลกมีดวงจันทร์เป็นบริวารตามธรรมชาติกี่ดวง?',
    choices: ['0 ดวง', '1 ดวง', '2 ดวง', '3 ดวง'],
    answer: 1,
  },
  {
    question: 'H2O เป็นสูตรทางเคมีของสารใดต่อไปนี้?',
    choices: ['เกลือแกง', 'น้ำบริสุทธิ์', 'น้ำตาลทราย', 'เอทานอล'],
    answer: 1,
  },
  {
    question: 'หน่วยความจำหลักของคอมพิวเตอร์คืออะไร?',
    choices: ['RAM', 'Hard Disk', 'Flash Drive', 'CD-ROM'],
    answer: 0,
  },
];

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  questions: [],          // [{ question, choices: [], answer: 0 }]
  examConfig: {
    title: 'ข้อสอบวัดความรู้ทั่วไป',
    timeLimitMinutes: null,
    passingPercent: 60,
    shuffle: false,
  },
  exam: {
    displayQuestions: [],
    answers: {},          // { qIndex: choiceIndex }
    currentIndex: 0,
    student: { id: '', name: '' },
    startTime: null,
    timerInterval: null,
    secondsLeft: null,
  },
  results: [],            // Array of past test results
  isTeacher: false,
};

// ── DOM Helpers ────────────────────────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(msg, type = 'info', duration = 3000) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, duration);
}

// ── LocalStorage Management ────────────────────────────────────────────────
const STORAGE_KEY_QS     = 'examFlow_questions_v2';
const STORAGE_KEY_CONFIG = 'examFlow_config_v2';
const STORAGE_KEY_RES    = 'examFlow_results_v2';
const STORAGE_KEY_THEME  = 'examFlow_theme_v2';

function loadStoredState() {
  try {
    const savedQs = localStorage.getItem(STORAGE_KEY_QS);
    if (savedQs) {
      state.questions = JSON.parse(savedQs);
    } else {
      state.questions = [...DEFAULT_QUESTIONS];
      localStorage.setItem(STORAGE_KEY_QS, JSON.stringify(state.questions));
    }

    const savedCfg = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (savedCfg) {
      state.examConfig = Object.assign(state.examConfig, JSON.parse(savedCfg));
    }

    const savedRes = localStorage.getItem(STORAGE_KEY_RES);
    if (savedRes) {
      state.results = JSON.parse(savedRes);
    }
  } catch (err) {
    console.warn('LocalStorage error:', err);
    state.questions = [...DEFAULT_QUESTIONS];
  }
}

function saveStoredState() {
  try {
    localStorage.setItem(STORAGE_KEY_QS, JSON.stringify(state.questions));
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(state.examConfig));
    localStorage.setItem(STORAGE_KEY_RES, JSON.stringify(state.results));
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }
  updateHomeSummary();
}

// ── Theme Support ─────────────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME);
  if (saved === 'dark') {
    document.body.classList.add('dark-theme');
    const btn = $('#themeToggleBtn');
    if (btn) btn.textContent = '🌙';
  } else {
    document.body.classList.remove('dark-theme');
    const btn = $('#themeToggleBtn');
    if (btn) btn.textContent = '☀️';
  }
})();

$('#themeToggleBtn').addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-theme');
  $('#themeToggleBtn').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem(STORAGE_KEY_THEME, isDark ? 'dark' : 'light');
});

// ── Navigation ────────────────────────────────────────────────────────────
function showPage(n) {
  $$('.page').forEach(p => p.classList.remove('active'));
  const target = $(`#page${n}`);
  if (target) target.classList.add('active');

  // Update step navigation if in teacher mode
  $$('.step-item').forEach(s => {
    const sn = +s.dataset.step;
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (n === 0) updateHomeSummary();
  if (n === 4) updateReport();
}

function setTeacherMode(enabled) {
  state.isTeacher = !!enabled;
  const badge = $('#roleBadge');
  const loginBtn = $('#teacherLoginBtn');
  const controlGroup = $('#teacherControlGroup');
  const stepNav = $('#stepNav');
  const goToReportBtn = $('#goToReportBtn');

  if (state.isTeacher) {
    badge.textContent = '👨‍🏫 โหมดอาจารย์';
    badge.className = 'role-badge teacher';
    loginBtn.style.display = 'none';
    controlGroup.style.display = 'inline-flex';
    stepNav.style.display = 'flex';
    if (goToReportBtn) goToReportBtn.style.display = 'inline-flex';
  } else {
    badge.textContent = '🎓 โหมดนักศึกษา';
    badge.className = 'role-badge';
    loginBtn.style.display = 'inline-flex';
    controlGroup.style.display = 'none';
    stepNav.style.display = 'none';
    if (goToReportBtn) goToReportBtn.style.display = 'none';
  }
}

// ── Update Home Summary ───────────────────────────────────────────────────
function updateHomeSummary() {
  const title = state.examConfig.title || 'ข้อสอบออนไลน์';
  const qCount = state.questions.length;
  const time = state.examConfig.timeLimitMinutes;

  $('#homeExamTitle').textContent = title;
  $('#homeQCount').textContent = `${qCount} ข้อ`;
  $('#homeTimeLimit').textContent = time ? `${time} นาที` : 'ไม่จำกัดเวลา';
  $('#homePassing').textContent = `${state.examConfig.passingPercent}%`;

  // Sync inputs on Teacher page
  if ($('#examTitle')) $('#examTitle').value = title;
  if ($('#examTime')) $('#examTime').value = time || '';
  if ($('#passingScore')) $('#passingScore').value = state.examConfig.passingPercent;
  if ($('#shuffleQuestions')) $('#shuffleQuestions').checked = !!state.examConfig.shuffle;
}

// ── Particle Background ───────────────────────────────────────────────────
(function initParticles() {
  const container = $('#particles');
  if (!container) return;
  const colors = ['#6366f1', '#2563eb', '#10b981', '#818cf8', '#60a5fa'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 6 + 2;
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 20 + 15}s;
      animation-delay: ${Math.random() * -20}s;
    `;
    container.appendChild(p);
  }
})();

// ── SVG Gradient for Ring ─────────────────────────────────────────────────
(function injectDefs() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = `
    <defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#4f46e5"/>
      </linearGradient>
    </defs>
  `;
  svg.className = 'hidden';
  svg.style.display = 'none';
  document.body.prepend(svg);
})();

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 0 — PORTAL & STUDENT DIRECT ENTRANCE
// ══════════════════════════════════════════════════════════════════════════

// Student starts exam with Student ID
$('#quickStartExamBtn').addEventListener('click', enterExamAsStudent);
$('#quickStudentId').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') enterExamAsStudent();
});

function enterExamAsStudent() {
  const studentId = $('#quickStudentId').value.trim();
  if (!studentId) {
    showToast('กรุณากรอกรหัสนักศึกษาก่อนเริ่มทำข้อสอบ', 'error');
    $('#quickStudentId').focus();
    return;
  }

  if (state.questions.length === 0) {
    showToast('ยังไม่มีข้อสอบในระบบ กรุณารออาจารย์นำเข้าข้อสอบ', 'error');
    return;
  }

  // Set student info
  state.exam.student = {
    id: studentId,
    name: studentId,
  };

  // Directly start the exam!
  startExam();
}

// Home button
$('#navHomeBtn').addEventListener('click', () => showPage(0));
$('#headerLogo').addEventListener('click', () => showPage(0));
$('#returnHomeBtn').addEventListener('click', () => {
  $('#quickStudentId').value = '';
  showPage(0);
});

// ══════════════════════════════════════════════════════════════════════════
//  TEACHER AUTHENTICATION (LOGIN / LOGOUT)
// ══════════════════════════════════════════════════════════════════════════
const teacherModal = $('#teacherLoginModal');
const teacherPassInput = $('#teacherPasswordInput');

function openTeacherLoginModal() {
  teacherModal.style.display = 'flex';
  teacherPassInput.value = '';
  teacherPassInput.focus();
}

function closeTeacherLoginModal() {
  teacherModal.style.display = 'none';
}

$('#teacherLoginBtn').addEventListener('click', openTeacherLoginModal);
$('#enterTeacherBtn').addEventListener('click', openTeacherLoginModal);
$('#closeTeacherModalBtn').addEventListener('click', closeTeacherLoginModal);

$('#submitTeacherLoginBtn').addEventListener('click', handleTeacherLogin);
teacherPassInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleTeacherLogin();
});

function handleTeacherLogin() {
  const pwd = teacherPassInput.value.trim();
  // Default password: admin (or 1234)
  if (pwd === 'admin' || pwd === '1234' || pwd === '') {
    setTeacherMode(true);
    closeTeacherLoginModal();
    showToast('เข้าสู่ระบบอาจารย์สำเร็จ ยินดีต้อนรับครับ', 'success');
    renderPreview();
    showPage(1); // Go to teacher exam management
  } else {
    showToast('รหัสผ่านไม่ถูกต้อง (รหัสเริ่มต้น: admin)', 'error');
    teacherPassInput.select();
  }
}

// Teacher Logout
$('#teacherLogoutBtn').addEventListener('click', () => {
  setTeacherMode(false);
  showToast('ออกจากระบบอาจารย์เรียบร้อยแล้ว', 'info');
  showPage(0);
});

// Teacher views Student Portal
$('#viewStudentBtn').addEventListener('click', () => showPage(0));
$('#viewStudentViewBtn').addEventListener('click', () => showPage(0));

// Step Navigation clicks for teacher
$$('.step-item').forEach(item => {
  item.addEventListener('click', () => {
    if (!state.isTeacher) return;
    const step = +item.dataset.step;
    showPage(step);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 1 — IMPORT & QUESTION BUILDER (TEACHER)
// ══════════════════════════════════════════════════════════════════════════

// ── Sample CSV Download ──────────────────────────────────────────────────
$('#downloadSampleBtn').addEventListener('click', () => {
  const csv = [
    'ข้อ,คำถาม,ตัวเลือก1,ตัวเลือก2,ตัวเลือก3,ตัวเลือก4,เฉลย',
    '1,1+1 เท่ากับเท่าไร,1,2,3,4,2',
    '2,เมืองหลวงของประเทศไทยคืออะไร,กรุงเทพมหานคร,เชียงใหม่,ขอนแก่น,ภูเก็ต,1',
    '3,โลกมีดาวเทียมธรรมชาติกี่ดวง,0,1,2,3,2',
    '4,H2O คือสูตรเคมีของอะไร,เกลือ,น้ำ,น้ำตาล,แอลกอฮอล์,2',
    '5,ปีที่มีวันน้อยที่สุดในสัปดาห์คือวันอะไร,วันจันทร์,วันอาทิตย์,วันเสาร์,วันศุกร์,1',
  ].join('\n');
  download('sample_exam.csv', csv, 'text/csv;charset=utf-8;');
  showToast('ดาวน์โหลดตัวอย่างไฟล์ CSV สำเร็จ', 'success');
});

function download(filename, content, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── File Upload ────────────────────────────────────────────────────────────
const uploadZone = $('#uploadZone');
const fileInput  = $('#fileInput');

uploadZone.addEventListener('click', (e) => {
  if (!e.target.closest('label')) fileInput.click();
});
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    try {
      if (ext === 'json') parseJSON(content);
      else parseCsv(content);
    } catch (err) {
      showToast('ไม่สามารถอ่านไฟล์ได้: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

const HEADER_KEYWORDS = ['ข้อ','คำถาม','question','ตัวเลือก','choice','เฉลย','answer','โจทย์','no.','#'];

function isHeaderRow(cells) {
  return cells.some(c => HEADER_KEYWORDS.some(k => c.trim().toLowerCase().includes(k.toLowerCase())));
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) { showToast('ไฟล์ว่างเปล่า', 'error'); return; }

  const parsed = lines.map(line => {
    const result = [];
    let inQuotes = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  });

  const startIndex = isHeaderRow(parsed[0]) ? 1 : 0;
  const questions = [];

  for (let r = startIndex; r < parsed.length; r++) {
    const row = parsed[r];
    if (row.length < 3) continue;

    let qText, choices, ansKey;

    const firstColIsNumber = /^\d+$/.test(row[0].trim());
    const isSevenColFormat = row.length >= 7 && (firstColIsNumber || row.length > 6);

    if (isSevenColFormat && firstColIsNumber) {
      qText = row[1];
      choices = row.slice(2, row.length - 1).filter(Boolean);
      ansKey = row[row.length - 1];
    } else {
      qText = row[0];
      choices = row.slice(1, row.length - 1).filter(Boolean);
      ansKey = row[row.length - 1];
    }

    if (!qText || choices.length < 2) continue;

    const answer = parseAnswerKey(ansKey, choices);
    questions.push({ question: qText, choices, answer });
  }

  if (questions.length === 0) {
    showToast('ไม่พบข้อสอบในไฟล์ กรุณาตรวจสอบรูปแบบ', 'error');
    return;
  }

  state.questions = questions;
  saveStoredState();
  renderPreview();
  showToast(`นำเข้าสำเร็จ ${questions.length} ข้อ`, 'success');
}

function parseAnswerKey(key, choices) {
  if (!key) return 0;
  key = key.trim().toLowerCase();

  const num = parseInt(key);
  if (!isNaN(num) && num >= 1 && num <= choices.length) return num - 1;

  const thaiKeys = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  const ti = thaiKeys.indexOf(key);
  if (ti !== -1 && ti < choices.length) return ti;

  const engKeys = ['a', 'b', 'c', 'd', 'e', 'f'];
  const ei = engKeys.indexOf(key);
  if (ei !== -1 && ei < choices.length) return ei;

  const ci = choices.findIndex(c => c.toLowerCase() === key);
  if (ci !== -1) return ci;

  return 0;
}

function parseJSON(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : (data.questions || []);
  if (!arr.length) { showToast('ไม่พบข้อสอบใน JSON', 'error'); return; }

  state.questions = arr.map((item, i) => ({
    question: item.question || item.q || `ข้อที่ ${i + 1}`,
    choices: item.choices || item.options || [],
    answer: typeof item.answer === 'number' ? item.answer : 0,
  }));

  saveStoredState();
  renderPreview();
  showToast(`นำเข้าสำเร็จ ${state.questions.length} ข้อ`, 'success');
}

// ── Manual Question Builder ────────────────────────────────────────────────
let manualCount = 0;

function addManualQuestion(data = null) {
  manualCount++;
  const id = manualCount;
  const builder = $('#questionBuilder');
  const div = document.createElement('div');
  div.className = 'question-item';
  div.id = `qItem_${id}`;

  const thaiKeys = ['ก', 'ข', 'ค', 'ง'];
  const choicesHtml = thaiKeys.map((k, i) => `
    <div class="choice-row">
      <span class="choice-label">${k}.</span>
      <input type="text" class="choice-input" data-choice="${i}"
        placeholder="ตัวเลือก ${k}" value="${data?.choices?.[i] || ''}" />
    </div>
  `).join('');

  const answerOptions = thaiKeys.map((k, i) => `
    <option value="${i}" ${data?.answer === i ? 'selected' : ''}>ข้อ ${k}</option>
  `).join('');

  div.innerHTML = `
    <div class="question-item-header">
      <span class="q-num">คำถามที่ ${id}</span>
      <button class="q-remove" data-id="${id}" title="ลบข้อนี้">✕ ลบ</button>
    </div>
    <input type="text" class="q-input" placeholder="พิมพ์โจทย์คำถาม..."
      value="${data?.question || ''}" />
    <div class="choices-grid">${choicesHtml}</div>
    <div class="answer-row">
      <span class="answer-label">เฉลยที่ถูกต้อง:</span>
      <select class="answer-select">${answerOptions}</select>
    </div>
  `;

  div.querySelector('.q-remove').addEventListener('click', () => {
    div.remove();
    updateManualState();
  });

  builder.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('#addQuestionBtn').addEventListener('click', () => {
  addManualQuestion();
  updateManualState();
});

function readManualQuestions() {
  const items = $$('.question-item');
  const questions = [];
  items.forEach(item => {
    const q = item.querySelector('.q-input').value.trim();
    const choices = [...item.querySelectorAll('.choice-input')].map(c => c.value.trim());
    const answer = parseInt(item.querySelector('.answer-select').value) || 0;
    if (q && choices.filter(Boolean).length >= 2) {
      questions.push({ question: q, choices, answer });
    }
  });
  return questions;
}

function updateManualState() {
  const manual = readManualQuestions();
  if (manual.length > 0) {
    state.questions = manual;
    saveStoredState();
    renderPreview();
  }
}

$('#questionBuilder').addEventListener('change', updateManualState);
$('#questionBuilder').addEventListener('input', updateManualState);

// ── Preview & Settings ─────────────────────────────────────────────────────
function renderPreview() {
  const card = $('#previewCard');
  const list = $('#previewList');
  const count = $('#questionCount');

  if (state.questions.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  count.textContent = `${state.questions.length} ข้อ`;
  list.innerHTML = '';

  const thaiKeys = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  state.questions.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'preview-item';
    const choicesHtml = q.choices.map((c, ci) => `
      <span class="preview-choice ${ci === q.answer ? 'correct' : ''}">
        ${thaiKeys[ci] || ci + 1}. ${c}
      </span>
    `).join('');

    div.innerHTML = `
      <div class="preview-q">${i + 1}. ${q.question}</div>
      <div class="preview-choices">${choicesHtml}</div>
    `;
    list.appendChild(div);
  });
}

$('#clearAllBtn').addEventListener('click', () => {
  if (!confirm('ต้องการล้างข้อสอบทั้งหมดในระบบหรือไม่?')) return;
  state.questions = [];
  $('#questionBuilder').innerHTML = '';
  saveStoredState();
  renderPreview();
  showToast('ล้างข้อสอบทั้งหมดแล้ว', 'info');
});

// Teacher saves setup
$('#startExamSetupBtn').addEventListener('click', () => {
  const manual = readManualQuestions();
  if (manual.length > 0 && state.questions.length === 0) {
    state.questions = manual;
  }

  if (state.questions.length === 0) {
    showToast('กรุณาเพิ่มข้อสอบอย่างน้อย 1 ข้อ', 'error');
    return;
  }

  // Save settings
  state.examConfig.title = $('#examTitle').value.trim() || 'ข้อสอบออนไลน์';
  state.examConfig.timeLimitMinutes = parseInt($('#examTime').value) || null;
  state.examConfig.passingPercent = parseInt($('#passingScore').value) || 60;
  state.examConfig.shuffle = $('#shuffleQuestions').checked;

  saveStoredState();
  showToast('บันทึกการตั้งค่าข้อสอบสำเร็จ! นักศึกษาสามารถเข้าทำข้อสอบได้ทันที', 'success');
  showPage(0); // Return to home/portal
});

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 2 — EXAM SCREEN (STUDENT TEST TAKING)
// ══════════════════════════════════════════════════════════════════════════

function startExam() {
  let qs = [...state.questions];
  if (state.examConfig.shuffle) qs = shuffleArray(qs);

  state.exam.displayQuestions = qs;
  state.exam.answers = {};
  state.exam.currentIndex = 0;
  state.exam.startTime = Date.now();

  // Student badge
  $('#examStudentIdBadge').textContent = `รหัสนักศึกษา: ${state.exam.student.id}`;
  $('#totalQ').textContent = qs.length;

  // Setup Timer
  if (state.examConfig.timeLimitMinutes) {
    state.exam.secondsLeft = state.examConfig.timeLimitMinutes * 60;
    startTimer();
    $('#examTimer').style.display = 'flex';
  } else {
    $('#examTimer').style.display = 'none';
  }

  renderQuestion();
  renderDots();
  showPage(2);
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Timer ───────────────────────────────────────────────────────────────────
function startTimer() {
  if (state.exam.timerInterval) clearInterval(state.exam.timerInterval);
  state.exam.timerInterval = setInterval(() => {
    state.exam.secondsLeft--;
    updateTimerDisplay();
    if (state.exam.secondsLeft <= 0) {
      clearInterval(state.exam.timerInterval);
      showToast('หมดเวลาสอบ! ส่งข้อสอบอัตโนมัติ', 'error', 5000);
      doSubmit();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const s = state.exam.secondsLeft;
  const m = Math.floor(Math.abs(s) / 60).toString().padStart(2, '0');
  const sec = (Math.abs(s) % 60).toString().padStart(2, '0');
  $('#timerDisplay').textContent = `${m}:${sec}`;
  const timerEl = $('#examTimer');
  const total = (state.examConfig.timeLimitMinutes || 1) * 60;
  if (s <= 60) timerEl.className = 'exam-timer danger';
  else if (s <= total * 0.25) timerEl.className = 'exam-timer warning';
  else timerEl.className = 'exam-timer';
}

// ── Render Question ─────────────────────────────────────────────────────────
function renderQuestion() {
  const idx = state.exam.currentIndex;
  const qs  = state.exam.displayQuestions;
  const q   = qs[idx];

  // Progress
  const pct = ((idx + 1) / qs.length) * 100;
  $('#progressFill').style.width = pct + '%';
  $('#currentQ').textContent = idx + 1;
  $('#questionBadge').textContent = `ข้อที่ ${idx + 1}`;
  $('#questionText').textContent = q.question;

  const choiceList = $('#choicesList');
  choiceList.innerHTML = '';
  const keys = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];

  q.choices.forEach((c, ci) => {
    const btn = document.createElement('button');
    btn.className = `choice-btn${state.exam.answers[idx] === ci ? ' selected' : ''}`;
    btn.innerHTML = `<span class="choice-key">${keys[ci] || ci + 1}</span><span>${c}</span>`;
    btn.addEventListener('click', () => selectAnswer(ci));
    choiceList.appendChild(btn);
  });

  // Re-trigger card animation
  const card = $('#questionCard');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = '';

  // Nav buttons
  $('#prevBtn').disabled = (idx === 0);
  const isLast = (idx === qs.length - 1);
  $('#nextBtn').style.display   = isLast ? 'none' : 'inline-flex';
  $('#submitBtn').style.display = isLast ? 'inline-flex' : 'none';

  updateDots();
}

function selectAnswer(choiceIdx) {
  state.exam.answers[state.exam.currentIndex] = choiceIdx;
  $$('.choice-btn').forEach((btn, ci) => {
    btn.classList.toggle('selected', ci === choiceIdx);
  });
  updateDots();
}

// ── Exam Navigation ────────────────────────────────────────────────────────
$('#prevBtn').addEventListener('click', () => {
  if (state.exam.currentIndex > 0) {
    state.exam.currentIndex--;
    renderQuestion();
  }
});

$('#nextBtn').addEventListener('click', () => {
  const qs = state.exam.displayQuestions;
  if (state.exam.currentIndex < qs.length - 1) {
    state.exam.currentIndex++;
    renderQuestion();
  }
});

// ── Question Dots ──────────────────────────────────────────────────────────
function renderDots() {
  const container = $('#questionDots');
  container.innerHTML = '';
  state.exam.displayQuestions.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'q-dot';
    dot.textContent = i + 1;
    dot.addEventListener('click', () => {
      state.exam.currentIndex = i;
      renderQuestion();
    });
    container.appendChild(dot);
  });
  updateDots();
}

function updateDots() {
  const dots = $$('.q-dot');
  const curr = state.exam.currentIndex;
  dots.forEach((d, i) => {
    d.classList.toggle('current', i === curr);
    d.classList.toggle('answered', i !== curr && state.exam.answers[i] !== undefined);
  });
}

// ── Exam Submit ────────────────────────────────────────────────────────────
$('#submitBtn').addEventListener('click', () => {
  const total = state.exam.displayQuestions.length;
  const answered = Object.keys(state.exam.answers).length;
  const unanswered = total - answered;

  const modal = $('#submitModal');
  const body  = $('#submitModalBody');
  body.textContent = unanswered > 0
    ? `คุณยังไม่ตอบ ${unanswered} ข้อ ต้องการส่งข้อสอบหรือไม่?`
    : 'คุณตอบครบทุกข้อแล้ว ต้องการส่งข้อสอบหรือไม่?';
  modal.style.display = 'flex';
});

$('#cancelSubmitBtn').addEventListener('click', () => {
  $('#submitModal').style.display = 'none';
});

$('#confirmSubmitBtn').addEventListener('click', () => {
  $('#submitModal').style.display = 'none';
  doSubmit();
});

function doSubmit() {
  if (state.exam.timerInterval) clearInterval(state.exam.timerInterval);
  const elapsed = Math.round((Date.now() - state.exam.startTime) / 1000);
  const qs = state.exam.displayQuestions;
  let correct = 0;

  const detail = qs.map((q, i) => {
    const userAns = state.exam.answers[i];
    const isCorrect = (userAns === q.answer);
    if (isCorrect) correct++;
    return {
      question: q.question,
      choices: q.choices,
      correctAns: q.answer,
      userAns,
      isCorrect,
    };
  });

  const total = qs.length;
  const pct = Math.round((correct / total) * 100);
  const passed = (pct >= state.examConfig.passingPercent);

  const resultObj = {
    id: state.exam.student.id,
    name: state.exam.student.name,
    correct,
    wrong: total - correct,
    total,
    pct,
    passed,
    elapsed,
    detail,
    date: new Date().toLocaleDateString('th-TH'),
    time: formatSeconds(elapsed),
  };

  state.results.push(resultObj);
  saveStoredState();

  showResult(resultObj);
  showPage(3);
}

function formatSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 3 — RESULT
// ══════════════════════════════════════════════════════════════════════════

function showResult(r) {
  $('#scorePct').textContent = `${r.pct}%`;
  $('#correctCount').textContent = r.correct;
  $('#wrongCount').textContent   = r.wrong;
  $('#totalCount').textContent   = r.total;
  $('#resultStudentName').textContent = `รหัสนักศึกษา: ${r.id}`;

  const statusEl = $('#resultStatus');
  statusEl.className = `result-status ${r.passed ? 'pass' : 'fail'}`;
  statusEl.textContent = r.passed ? '🎉 สอบผ่านเกณฑ์' : '❌ ไม่ผ่านเกณฑ์';

  // Ring Animation
  const circumference = 326.7;
  const offset = circumference - (r.pct / 100) * circumference;
  setTimeout(() => {
    $('#ringFill').style.strokeDashoffset = offset;
  }, 100);

  // Score color
  const pctEl = $('#scorePct');
  if (r.pct >= 80)      pctEl.style.color = 'var(--green)';
  else if (r.pct >= 60) pctEl.style.color = 'var(--purple-dark)';
  else                  pctEl.style.color = 'var(--red)';

  buildReview(r.detail);
}

function buildReview(detail) {
  const list = $('#reviewList');
  list.innerHTML = '';
  const keys = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];

  detail.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = `review-item ${item.isCorrect ? 'correct' : 'wrong'}`;
    const choicesHtml = item.choices.map((c, ci) => {
      let cls = 'review-choice';
      if (ci === item.correctAns) cls += ' correct-answer';
      else if (ci === item.userAns && !item.isCorrect) cls += ' wrong-answer';
      if (ci === item.userAns) cls += ' user-answer';
      const prefix = (ci === item.correctAns) ? '✓ ' : (ci === item.userAns && !item.isCorrect) ? '✗ ' : '   ';
      return `<div class="${cls}">${prefix}${keys[ci] || ci + 1}. ${c}</div>`;
    }).join('');

    div.innerHTML = `
      <div class="review-q">${i + 1}. ${item.question}</div>
      <div class="review-choices">${choicesHtml}</div>
      <div class="review-result" style="color: ${item.isCorrect ? 'var(--green)' : 'var(--red)'}">
        ${item.isCorrect ? '✓ ถูกต้อง' : `✗ ตอบผิด — เฉลย: ${keys[item.correctAns] || item.correctAns + 1}. ${item.choices[item.correctAns]}`}
      </div>
    `;
    list.appendChild(div);
  });
}

$('#viewReviewBtn').addEventListener('click', () => {
  const sec = $('#reviewSection');
  const isHidden = (sec.style.display === 'none' || sec.style.display === '');
  sec.style.display = isHidden ? 'block' : 'none';
  $('#viewReviewBtn').textContent = isHidden ? 'ซ่อนเฉลย' : '📖 ดูเฉลยข้อสอบ';
  if (isHidden) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#takeAnotherBtn').addEventListener('click', () => {
  state.exam.answers = {};
  state.exam.currentIndex = 0;
  if (state.exam.timerInterval) clearInterval(state.exam.timerInterval);
  $('#reviewSection').style.display = 'none';
  $('#ringFill').style.strokeDashoffset = '326.7';
  startExam();
});

$('#goToReportBtn').addEventListener('click', () => showPage(4));

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 4 — REPORT (TEACHER)
// ══════════════════════════════════════════════════════════════════════════

function updateReport() {
  const rs = state.results;
  $('#totalExaminees').textContent = rs.length;

  if (rs.length === 0) {
    $('#avgScore').textContent = '0%';
    $('#passRate').textContent = '0%';
    $('#highScore').textContent = '0%';
    renderReportTable();
    return;
  }

  const avg  = Math.round(rs.reduce((s, r) => s + r.pct, 0) / rs.length);
  const pass = Math.round((rs.filter(r => r.passed).length / rs.length) * 100);
  const high = Math.max(...rs.map(r => r.pct));

  $('#avgScore').textContent  = `${avg}%`;
  $('#passRate').textContent  = `${pass}%`;
  $('#highScore').textContent = `${high}%`;

  renderReportTable();
}

function renderReportTable() {
  const tbody = $('#reportBody');
  tbody.innerHTML = '';
  if (state.results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">ยังไม่มีผลการสอบของนักศึกษา</td></tr>';
    return;
  }

  state.results.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong style="color:var(--text-primary)">${r.id || r.name}</strong></td>
      <td>${r.correct}/${r.total}</td>
      <td><strong style="color:${r.pct >= 80 ? 'var(--green)' : r.pct >= 60 ? 'var(--purple-dark)' : 'var(--red)'}">${r.pct}%</strong></td>
      <td><span class="${r.passed ? 'badge-pass' : 'badge-fail'}">${r.passed ? 'ผ่าน' : 'ไม่ผ่าน'}</span></td>
      <td>${r.time} นาที</td>
      <td>${r.date}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Export Excel ───────────────────────────────────────────────────────────
$('#exportExcelBtn').addEventListener('click', exportExcel);

function exportExcel() {
  if (state.results.length === 0) {
    showToast('ไม่มีข้อมูลผลสอบที่จะส่งออก', 'error');
    return;
  }

  const ws_data = [
    ['#', 'รหัสนักศึกษา', 'คะแนนที่ได้', 'คะแนนเต็ม', 'คะแนน (%)', 'ผลการสอบ', 'เวลาที่ใช้', 'วันที่สอบ'],
  ];

  state.results.forEach((r, i) => {
    ws_data.push([
      i + 1,
      r.id || r.name,
      r.correct,
      r.total,
      `${r.pct}%`,
      r.passed ? 'ผ่าน' : 'ไม่ผ่าน',
      r.time,
      r.date,
    ]);
  });

  ws_data.push([]);
  const avg = Math.round(state.results.reduce((s, r) => s + r.pct, 0) / state.results.length);
  const passCount = state.results.filter(r => r.passed).length;
  ws_data.push(['สรุป', `ผู้เข้าสอบ: ${state.results.length} คน`, `ผ่าน: ${passCount} คน`, `ไม่ผ่าน: ${state.results.length - passCount} คน`, `เฉลี่ย: ${avg}%`]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [
    { wch: 6 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'ผลการสอบ');

  XLSX.writeFile(wb, `ExamFlow_${state.examConfig.title}_${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.xlsx`);
  showToast('ส่งออก Excel สำเร็จ! ✅', 'success');
}

// ── Export CSV ──────────────────────────────────────────────────────────────
$('#exportCsvBtn').addEventListener('click', () => {
  if (state.results.length === 0) {
    showToast('ไม่มีข้อมูลผลสอบที่จะส่งออก', 'error');
    return;
  }
  const rows = [
    ['#', 'รหัสนักศึกษา', 'คะแนนที่ได้', 'คะแนนเต็ม', 'คะแนน (%)', 'ผลการสอบ', 'เวลาที่ใช้', 'วันที่สอบ'],
    ...state.results.map((r, i) => [
      i + 1,
      `"${r.id || r.name}"`,
      r.correct,
      r.total,
      `"${r.pct}%"`,
      `"${r.passed ? 'ผ่าน' : 'ไม่ผ่าน'}"`,
      `"${r.time}"`,
      `"${r.date}"`,
    ]),
  ].map(row => row.join(',')).join('\n');

  download('ExamFlow_ผลสอบ.csv', rows, 'text/csv;charset=utf-8;');
  showToast('ส่งออก CSV สำเร็จ!', 'success');
});

// ── Clear Results ──────────────────────────────────────────────────────────
$('#clearResultsBtn').addEventListener('click', () => {
  if (!confirm('ต้องการล้างข้อมูลผลการสอบของนักศึกษาทั้งหมดหรือไม่?')) return;
  state.results = [];
  saveStoredState();
  updateReport();
  showToast('ล้างข้อมูลผลสอบทั้งหมดแล้ว', 'info');
});

// ── New Exam Button (Teacher) ──────────────────────────────────────────────
$('#newExamBtn').addEventListener('click', () => {
  showPage(1);
});

// ══════════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════
(function init() {
  loadStoredState();
  updateHomeSummary();
  renderPreview();
  setTeacherMode(false);
  showPage(0); // Start on Home/Portal for student entry
})();
