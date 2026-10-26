/* ========================================
   ExamFlow — Main Application Logic
   ======================================== */

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  questions: [],          // { question, choices: [], answer: number (0-based) }
  examConfig: {
    title: 'ข้อสอบออนไลน์',
    timeLimitMinutes: null,
    passingPercent: 60,
    shuffle: false,
  },
  exam: {
    displayQuestions: [], // Possibly shuffled copy
    answers: {},          // { qIndex: choiceIndex }
    currentIndex: 0,
    student: { name: '', id: '', class: '' },
    startTime: null,
    timerInterval: null,
    secondsLeft: null,
  },
  results: [],            // Array of past results
};

// ── DOM Helpers ────────────────────────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(msg, type = 'info', duration = 3000) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, duration);
}

function showPage(n) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $(`#page${n}`).classList.add('active');
  $$('.step-item').forEach(s => {
    const sn = +s.dataset.step;
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
  });
}

// ── Particles ──────────────────────────────────────────────────────────────
(function initParticles() {
  const container = $('#particles');
  const colors = ['#7c3aed', '#2563eb', '#059669', '#a78bfa', '#60a5fa'];
  for (let i = 0; i < 25; i++) {
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

// ── SVG gradient defs (for ring) ──────────────────────────────────────────
(function injectDefs() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = `
    <defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#7c3aed"/>
        <stop offset="100%" stop-color="#2563eb"/>
      </linearGradient>
    </defs>
  `;
  svg.className = 'hidden';
  svg.style.display = 'none';
  document.body.prepend(svg);
})();

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 1 — IMPORT
// ══════════════════════════════════════════════════════════════════════════

// ── Sample CSV ─────────────────────────────────────────────────────────────
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
  showToast('ดาวน์โหลดตัวอย่างสำเร็จ', 'success');
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

// คำที่บ่งบอกว่าแถวนี้คือ Header
const HEADER_KEYWORDS = ['ข้อ','คำถาม','question','ตัวเลือก','choice','เฉลย','answer','โจทย์','no.','#'];

function isHeaderRow(cells) {
  return cells.some(c => HEADER_KEYWORDS.some(k => c.trim().toLowerCase().includes(k.toLowerCase())));
}

function parseCsv(text) {
  // รองรับทั้ง \r\n และ \n
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const questions = [];

  // ข้ามแถว header อัตโนมัติ
  let startIdx = 0;
  if (isHeaderRow(splitCsvLine(lines[0]))) startIdx = 1;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) continue;

    // ตรวจว่าคอลัมน์แรกเป็น "เลขข้อ" (ตัวเลข) หรือไม่
    // ถ้าใช่ → เลื่อน index เพื่อข้ามคอลัมน์นั้น
    let dataStart = 0;
    const firstCell = cols[0].trim();
    if (/^\d+$/.test(firstCell)) {
      // รูปแบบ: ข้อ | คำถาม | ตัวเลือก... | เฉลย
      dataStart = 1;
    }

    const remaining = cols.slice(dataStart);
    if (remaining.length < 3) continue;

    const question  = remaining[0].trim();
    if (!question) continue;

    const answerRaw = remaining[remaining.length - 1].trim();
    const choices   = remaining.slice(1, remaining.length - 1)
                              .map(c => c.trim())
                              .filter(Boolean);
    if (choices.length < 2) continue;

    // แปลงเฉลย: ตัวเลข 1-based หรือตัวอักษร A-D / ก-ง
    let answerIdx = 0;
    if (/^\d+$/.test(answerRaw)) {
      answerIdx = parseInt(answerRaw) - 1;
    } else if (/^[a-dA-D]$/.test(answerRaw)) {
      answerIdx = answerRaw.toLowerCase().charCodeAt(0) - 97;
    } else if (/^[ก-ง]$/.test(answerRaw)) {
      answerIdx = 'กขคง'.indexOf(answerRaw);
    }
    answerIdx = Math.max(0, Math.min(answerIdx, choices.length - 1));
    questions.push({ question, choices, answer: answerIdx });
  }

  if (questions.length === 0) throw new Error('ไม่พบคำถามในไฟล์ — ตรวจสอบรูปแบบ CSV');
  setQuestions(questions);
  showToast(`นำเข้าสำเร็จ ${questions.length} ข้อ`, 'success');
}

function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function parseJSON(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.questions || [];
  const questions = arr.map(q => ({
    question: q.question || q.q || '',
    choices:  q.choices || q.options || [],
    answer:   typeof q.answer === 'number' ? q.answer : (parseInt(q.answer) - 1 || 0),
  })).filter(q => q.question && q.choices.length >= 2);
  if (questions.length === 0) throw new Error('ไม่พบคำถามในไฟล์ JSON');
  setQuestions(questions);
  showToast(`นำเข้า JSON สำเร็จ ${questions.length} ข้อ`, 'success');
}

// ── Manual Question Builder ────────────────────────────────────────────────
$('#addQuestionBtn').addEventListener('click', addManualQuestion);

function addManualQuestion(prefill = null) {
  const idx = $('#questionBuilder').children.length;
  const div = document.createElement('div');
  div.className = 'question-item';
  div.innerHTML = `
    <div class="question-item-header">
      <span class="q-num">ข้อที่ ${idx + 1}</span>
      <button class="q-remove" title="ลบข้อนี้">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <textarea class="q-input" rows="2" placeholder="พิมพ์คำถาม...">${prefill ? prefill.question : ''}</textarea>
    <div class="choices-grid">
      ${['ก','ข','ค','ง'].map((k, i) => `
        <div class="choice-row">
          <span class="choice-label">${k}.</span>
          <input class="choice-input" placeholder="ตัวเลือก ${k}" value="${prefill ? (prefill.choices[i] || '') : ''}" />
        </div>
      `).join('')}
    </div>
    <div class="answer-row">
      <span class="answer-label">เฉลย:</span>
      <select class="answer-select">
        ${['ก','ข','ค','ง'].map((k, i) => `<option value="${i}" ${prefill && prefill.answer === i ? 'selected' : ''}>${k}</option>`).join('')}
      </select>
    </div>
  `;
  div.querySelector('.q-remove').addEventListener('click', () => {
    div.style.animation = 'none';
    div.style.opacity = '0';
    div.style.transform = 'translateX(10px)';
    div.style.transition = '0.25s ease';
    setTimeout(() => { div.remove(); rebuildManualQuestions(); }, 250);
  });
  $('#questionBuilder').appendChild(div);
}

function readManualQuestions() {
  const items = $$('.question-item');
  const questions = [];
  items.forEach(item => {
    const q = item.querySelector('.q-input').value.trim();
    const inputs = [...item.querySelectorAll('.choice-input')].map(i => i.value.trim());
    const choices = inputs.filter(Boolean);
    const answerIdx = parseInt(item.querySelector('.answer-select').value);
    if (q && choices.length >= 2) {
      questions.push({ question: q, choices, answer: answerIdx });
    }
  });
  return questions;
}

function rebuildManualQuestions() {
  $$('.q-num').forEach((el, i) => { el.textContent = `ข้อที่ ${i + 1}`; });
}

// Sync manual questions to state
function syncManualToState() {
  const manual = readManualQuestions();
  if (manual.length > 0) setQuestions(manual);
}

// ── Set Questions ──────────────────────────────────────────────────────────
function setQuestions(questions) {
  state.questions = questions;
  renderPreview();
}

function renderPreview() {
  const qs = state.questions;
  if (qs.length === 0) {
    $('#previewCard').style.display = 'none';
    return;
  }
  $('#previewCard').style.display = 'block';
  $('#questionCount').textContent = `${qs.length} ข้อ`;

  const list = $('#previewList');
  list.innerHTML = '';
  qs.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.innerHTML = `
      <div class="preview-q">${i + 1}. ${q.question}</div>
      <div class="preview-choices">
        ${q.choices.map((c, ci) => `<span class="preview-choice ${ci === q.answer ? 'correct' : ''}">${['ก','ข','ค','ง'][ci] || ci+1}. ${c}</span>`).join('')}
      </div>
      <div class="preview-answer">✓ เฉลย: ${['ก','ข','ค','ง'][q.answer] || q.answer + 1}. ${q.choices[q.answer] || ''}</div>
    `;
    list.appendChild(div);
  });
}

$('#clearAllBtn').addEventListener('click', () => {
  state.questions = [];
  $('#questionBuilder').innerHTML = '';
  renderPreview();
  showToast('ล้างข้อสอบทั้งหมดแล้ว', 'info');
});

// ── Start Exam Setup ────────────────────────────────────────────────────────
$('#startExamSetupBtn').addEventListener('click', () => {
  // Merge manual questions if any
  const manual = readManualQuestions();
  if (manual.length > 0 && state.questions.length === 0) {
    state.questions = manual;
  } else if (manual.length > 0 && state.questions.length > 0) {
    // Manual builder was used along with file – use file questions
  }

  if (state.questions.length === 0) {
    showToast('กรุณาเพิ่มข้อสอบก่อน', 'error');
    return;
  }

  // Read settings
  state.examConfig.title = $('#examTitle').value.trim() || 'ข้อสอบออนไลน์';
  state.examConfig.timeLimitMinutes = parseInt($('#examTime').value) || null;
  state.examConfig.passingPercent = parseInt($('#passingScore').value) || 60;
  state.examConfig.shuffle = $('#shuffleQuestions').checked;

  // Go to exam page
  $('#examTitleDisplay').textContent = state.examConfig.title;
  const tl = state.examConfig.timeLimitMinutes;
  $('#infoTime').textContent = tl ? `${tl} นาที` : 'ไม่จำกัดเวลา';
  $('#infoPassScore').textContent = `ผ่านที่ ${state.examConfig.passingPercent}%`;
  $('#infoQuestionCount').textContent = `${state.questions.length} ข้อ`;
  showPage(2);
});

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 2 — EXAM
// ══════════════════════════════════════════════════════════════════════════

// ── Register ────────────────────────────────────────────────────────────────
$('#startExamBtn').addEventListener('click', () => {
  const name = $('#studentName').value.trim();
  if (!name) { showToast('กรุณากรอกชื่อก่อนเริ่มสอบ', 'error'); $('#studentName').focus(); return; }
  state.exam.student = {
    name,
    id:    $('#studentId').value.trim(),
    class: $('#studentClass').value.trim(),
  };
  startExam();
});

function startExam() {
  // Prepare questions (shuffle if needed)
  let qs = [...state.questions];
  if (state.examConfig.shuffle) qs = shuffleArray(qs);
  state.exam.displayQuestions = qs;
  state.exam.answers = {};
  state.exam.currentIndex = 0;
  state.exam.startTime = Date.now();

  // Setup timer
  if (state.examConfig.timeLimitMinutes) {
    state.exam.secondsLeft = state.examConfig.timeLimitMinutes * 60;
    startTimer();
    $('#examTimer').style.display = 'flex';
  } else {
    $('#examTimer').style.display = 'none';
  }

  $('#registerScreen').style.display = 'none';
  $('#examScreen').style.display   = 'block';
  $('#examStudentName').textContent = state.exam.student.name;
  $('#totalQ').textContent = qs.length;

  renderQuestion();
  renderDots();
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
      showToast('หมดเวลา! ส่งข้อสอบอัตโนมัติ', 'error', 5000);
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
  const total = state.examConfig.timeLimitMinutes * 60;
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

  // Trigger animation
  const card = $('#questionCard');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = '';

  // Nav buttons
  $('#prevBtn').disabled = (idx === 0);
  const isLast = idx === qs.length - 1;
  $('#nextBtn').style.display  = isLast ? 'none' : 'inline-flex';
  $('#submitBtn').style.display = isLast ? 'inline-flex' : 'none';

  updateDots();
}

function selectAnswer(choiceIdx) {
  state.exam.answers[state.exam.currentIndex] = choiceIdx;
  // Re-render choices
  const keys = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  $$('.choice-btn').forEach((btn, ci) => {
    btn.classList.toggle('selected', ci === choiceIdx);
    btn.querySelector('.choice-key').style.background = ci === choiceIdx ? 'var(--purple)' : '';
    btn.querySelector('.choice-key').style.color = ci === choiceIdx ? 'white' : '';
    btn.querySelector('.choice-key').style.borderColor = ci === choiceIdx ? 'var(--purple)' : '';
  });
  updateDots();
}

// ── Navigation ──────────────────────────────────────────────────────────────
$('#prevBtn').addEventListener('click', () => {
  if (state.exam.currentIndex > 0) { state.exam.currentIndex--; renderQuestion(); }
});
$('#nextBtn').addEventListener('click', () => {
  const qs = state.exam.displayQuestions;
  if (state.exam.currentIndex < qs.length - 1) { state.exam.currentIndex++; renderQuestion(); }
});

// ── Dots ─────────────────────────────────────────────────────────────────────
function renderDots() {
  const container = $('#questionDots');
  container.innerHTML = '';
  state.exam.displayQuestions.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'q-dot';
    dot.textContent = i + 1;
    dot.addEventListener('click', () => { state.exam.currentIndex = i; renderQuestion(); });
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

// ── Submit ───────────────────────────────────────────────────────────────────
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
    const isCorrect = userAns === q.answer;
    if (isCorrect) correct++;
    return { question: q.question, choices: q.choices, correctAns: q.answer, userAns, isCorrect };
  });

  const total = qs.length;
  const pct   = Math.round((correct / total) * 100);
  const passed = pct >= state.examConfig.passingPercent;

  const resultObj = {
    name:     state.exam.student.name,
    id:       state.exam.student.id,
    class:    state.exam.student.class,
    correct,
    wrong:    total - correct,
    total,
    pct,
    passed,
    elapsed,
    detail,
    date:     new Date().toLocaleDateString('th-TH'),
    time:     formatSeconds(elapsed),
  };

  state.results.push(resultObj);
  showResult(resultObj);
  showPage(3);
}

function formatSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 3 — RESULT
// ══════════════════════════════════════════════════════════════════════════

function showResult(r) {
  $('#scorePct').textContent = r.pct + '%';
  $('#correctCount').textContent = r.correct;
  $('#wrongCount').textContent   = r.wrong;
  $('#totalCount').textContent   = r.total;
  $('#resultStudentName').textContent = `ผู้สอบ: ${r.name}`;

  const statusEl = $('#resultStatus');
  statusEl.className = `result-status ${r.passed ? 'pass' : 'fail'}`;
  statusEl.textContent = r.passed ? '🎉 ผ่าน' : '❌ ไม่ผ่าน';

  // Animate ring
  const circumference = 326.7;
  const offset = circumference - (r.pct / 100) * circumference;
  setTimeout(() => {
    $('#ringFill').style.strokeDashoffset = offset;
  }, 100);

  // Score color
  const pctEl = $('#scorePct');
  if (r.pct >= 80)      pctEl.style.color = '#34d399';
  else if (r.pct >= 60) pctEl.style.color = '#60a5fa';
  else                  pctEl.style.color = '#f87171';

  // Review
  buildReview(r.detail);

  // Report
  updateReport();
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
      const prefix = ci === item.correctAns ? '✓ ' : ci === item.userAns && !item.isCorrect ? '✗ ' : '   ';
      return `<div class="${cls}">${prefix}${keys[ci] || ci+1}. ${c}</div>`;
    }).join('');
    div.innerHTML = `
      <div class="review-q">${i + 1}. ${item.question}</div>
      <div class="review-choices">${choicesHtml}</div>
      <div class="review-result" style="color: ${item.isCorrect ? 'var(--green-light)' : 'var(--red-light)'}">
        ${item.isCorrect ? '✓ ถูกต้อง' : `✗ ผิด — เฉลย: ${keys[item.correctAns] || item.correctAns+1}. ${item.choices[item.correctAns]}`}
      </div>
    `;
    list.appendChild(div);
  });
}

$('#viewReviewBtn').addEventListener('click', () => {
  const sec = $('#reviewSection');
  const isHidden = sec.style.display === 'none' || sec.style.display === '';
  sec.style.display = isHidden ? 'block' : 'none';
  $('#viewReviewBtn').textContent = isHidden ? 'ซ่อนเฉลย' : '📖 ดูเฉลย';
  if (isHidden) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#takeAnotherBtn').addEventListener('click', () => {
  // Reset exam state
  state.exam.answers = {};
  state.exam.currentIndex = 0;
  if (state.exam.timerInterval) clearInterval(state.exam.timerInterval);

  // Clear student form
  $('#studentName').value = '';
  $('#studentId').value = '';
  $('#studentClass').value = '';

  // Reset UI
  $('#registerScreen').style.display = 'block';
  $('#examScreen').style.display = 'none';
  $('#reviewSection').style.display = 'none';
  $('#ringFill').style.strokeDashoffset = '326.7';

  showPage(2);
});

$('#goToReportBtn').addEventListener('click', () => showPage(4));

// ══════════════════════════════════════════════════════════════════════════
//  PAGE 4 — REPORT
// ══════════════════════════════════════════════════════════════════════════

function updateReport() {
  const rs = state.results;
  $('#totalExaminees').textContent = rs.length;

  if (rs.length === 0) {
    $('#avgScore').textContent = '0%';
    $('#passRate').textContent = '0%';
    $('#highScore').textContent = '0%';
    return;
  }

  const avg  = Math.round(rs.reduce((s, r) => s + r.pct, 0) / rs.length);
  const pass = Math.round((rs.filter(r => r.passed).length / rs.length) * 100);
  const high = Math.max(...rs.map(r => r.pct));

  $('#avgScore').textContent  = avg  + '%';
  $('#passRate').textContent  = pass + '%';
  $('#highScore').textContent = high + '%';

  renderReportTable();
}

function renderReportTable() {
  const tbody = $('#reportBody');
  tbody.innerHTML = '';
  if (state.results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row">ยังไม่มีผลการสอบ</td></tr>';
    return;
  }
  state.results.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong style="color:var(--text-primary)">${r.name}</strong></td>
      <td>${r.id || '—'}</td>
      <td>${r.class || '—'}</td>
      <td>${r.correct}/${r.total}</td>
      <td><strong style="color:${r.pct >= 80 ? 'var(--green-light)' : r.pct >= 60 ? 'var(--blue-light)' : 'var(--red-light)'}">${r.pct}%</strong></td>
      <td><span class="${r.passed ? 'badge-pass' : 'badge-fail'}">${r.passed ? 'ผ่าน' : 'ไม่ผ่าน'}</span></td>
      <td>${r.time}</td>
      <td>${r.date}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Export Excel ───────────────────────────────────────────────────────────
$('#exportExcelBtn').addEventListener('click', exportExcel);

function exportExcel() {
  if (state.results.length === 0) { showToast('ไม่มีข้อมูลที่จะส่งออก', 'error'); return; }

  const ws_data = [
    ['#', 'ชื่อ-นามสกุล', 'รหัส', 'ห้อง/กลุ่ม', 'คะแนนที่ได้', 'คะแนนทั้งหมด', 'คะแนน (%)', 'ผลการสอบ', 'เวลาที่ใช้', 'วันที่สอบ'],
  ];

  state.results.forEach((r, i) => {
    ws_data.push([
      i + 1,
      r.name,
      r.id || '',
      r.class || '',
      r.correct,
      r.total,
      r.pct + '%',
      r.passed ? 'ผ่าน' : 'ไม่ผ่าน',
      r.time,
      r.date,
    ]);
  });

  // Summary row
  ws_data.push([]);
  const avg = Math.round(state.results.reduce((s, r) => s + r.pct, 0) / state.results.length);
  const passCount = state.results.filter(r => r.passed).length;
  ws_data.push(['สรุป', `ผู้เข้าสอบ: ${state.results.length} คน`, `ผ่าน: ${passCount} คน`, `ไม่ผ่าน: ${state.results.length - passCount} คน`, `คะแนนเฉลี่ย: ${avg}%`]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'ผลการสอบ');

  // Detail sheet per student
  state.results.forEach((r, si) => {
    const dData = [
      [`รายละเอียด: ${r.name}`, `คะแนน: ${r.pct}%`, r.passed ? 'ผ่าน' : 'ไม่ผ่าน'],
      [],
      ['#', 'คำถาม', 'คำตอบของผู้สอบ', 'เฉลยที่ถูกต้อง', 'ผล'],
    ];
    const keys = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
    r.detail.forEach((d, qi) => {
      dData.push([
        qi + 1,
        d.question,
        d.userAns !== undefined ? `${keys[d.userAns] || d.userAns+1}. ${d.choices[d.userAns]}` : 'ไม่ตอบ',
        `${keys[d.correctAns] || d.correctAns+1}. ${d.choices[d.correctAns]}`,
        d.isCorrect ? 'ถูก' : 'ผิด',
      ]);
    });
    const wsDetail = XLSX.utils.aoa_to_sheet(dData);
    wsDetail['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 25 }, { wch: 25 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, `${si+1}.${r.name.substring(0,12)}`);
  });

  XLSX.writeFile(wb, `ExamFlow_${state.examConfig.title}_${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.xlsx`);
  showToast('ส่งออก Excel สำเร็จ! ✅', 'success');
}

// ── Export CSV ──────────────────────────────────────────────────────────────
$('#exportCsvBtn').addEventListener('click', () => {
  if (state.results.length === 0) { showToast('ไม่มีข้อมูลที่จะส่งออก', 'error'); return; }
  const rows = [
    ['#','ชื่อ-นามสกุล','รหัส','ห้อง','คะแนนที่ได้','คะแนนทั้งหมด','คะแนน (%)','ผลการสอบ','เวลาที่ใช้','วันที่สอบ'],
    ...state.results.map((r, i) => [
      i+1, r.name, r.id||'', r.class||'', r.correct, r.total, r.pct+'%',
      r.passed ? 'ผ่าน' : 'ไม่ผ่าน', r.time, r.date,
    ]),
  ].map(row => row.join(',')).join('\n');

  download(`ExamFlow_ผล.csv`, rows, 'text/csv;charset=utf-8;');
  showToast('ส่งออก CSV สำเร็จ!', 'success');
});

// ── Clear Results ────────────────────────────────────────────────────────────
$('#clearResultsBtn').addEventListener('click', () => {
  if (!confirm('ต้องการล้างข้อมูลผลการสอบทั้งหมดหรือไม่?')) return;
  state.results = [];
  updateReport();
  showToast('ล้างข้อมูลทั้งหมดแล้ว', 'info');
});

// ── New Exam ─────────────────────────────────────────────────────────────────
$('#newExamBtn').addEventListener('click', () => {
  if (!confirm('ต้องการสร้างข้อสอบใหม่หรือไม่? ข้อสอบเดิมจะถูกลบ')) return;
  state.questions = [];
  state.exam = {
    displayQuestions: [], answers: {}, currentIndex: 0,
    student: { name: '', id: '', class: '' },
    startTime: null, timerInterval: null, secondsLeft: null,
  };
  $('#questionBuilder').innerHTML = '';
  $('#previewCard').style.display = 'none';
  $('#registerScreen').style.display = 'block';
  $('#examScreen').style.display = 'none';
  $('#reviewSection').style.display = 'none';
  $('#ringFill').style.strokeDashoffset = '326.7';
  showPage(1);
});

// ══════════════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════════════
(function init() {
  // Add one blank question to manual builder
  addManualQuestion();

  // Listen to manual builder changes to update preview on demand
  $('#questionBuilder').addEventListener('change', () => {
    const manual = readManualQuestions();
    if (manual.length > 0) {
      state.questions = manual;
      renderPreview();
    }
  });
  $('#questionBuilder').addEventListener('input', () => {
    const manual = readManualQuestions();
    if (manual.length > 0) {
      state.questions = manual;
      renderPreview();
    }
  });
})();
