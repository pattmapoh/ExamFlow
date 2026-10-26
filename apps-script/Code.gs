// ============================================================
//  ExamFlow — Google Apps Script (Code.gs)
//  ตรวจสอบให้แน่ใจว่า Spreadsheet มีแท็บชื่อ "ข้อสอบ"
//  รูปแบบ: | คำถาม | ตัวเลือก1 | ตัวเลือก2 | ตัวเลือก3 | ตัวเลือก4 | เฉลย(1-4) |
// ============================================================

const SHEET_QUESTIONS = 'ข้อสอบ';
const SHEET_RESULTS   = 'ผลสอบ';
const ALLOW_RETAKE    = false;   // false = ไม่ให้รหัสเดิมสอบซ้ำ
const LETTERS         = ['ก', 'ข', 'ค', 'ง'];

// ── Entry point ──────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ExamFlow — ระบบข้อสอบออนไลน์')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── อ่านข้อสอบจาก Sheet ─────────────────────────────────────
function readExam_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_QUESTIONS);
  if (!sh) throw new Error('ไม่พบแท็บชื่อ "' + SHEET_QUESTIONS + '"');
  return sh.getDataRange().getValues().slice(1)
    .filter(r => r[0] !== '' && r[1] !== '')
    .map(r => ({
      question: String(r[0]).trim(),
      choices:  [r[1], r[2], r[3], r[4]].map(c => String(c).trim()).filter(Boolean),
      answer:   parseInt(r[5]) - 1   // 1-based → 0-based
    }));
}

// ── API: โหลดข้อสอบ (เรียกจาก client) ──────────────────────
function getExamData() {
  try {
    const questions = readExam_();
    if (questions.length === 0) throw new Error('ไม่พบข้อสอบในแท็บ "' + SHEET_QUESTIONS + '"');
    return {
      ok: true,
      title: SpreadsheetApp.getActive().getName(),
      questions: questions.map(q => ({
        question: q.question,
        choices:  q.choices
      }))
    };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ── API: ส่งคำตอบ → ตรวจ → บันทึก ─────────────────────────
function submitExam(payload) {
  try {
    const { name, studentId, className, answers, elapsedSec } = payload;
    if (!name) return { ok: false, error: 'กรุณากรอกชื่อ' };

    const questions = readExam_();

    // ตรวจสอบซ้ำ
    if (!ALLOW_RETAKE && studentId) {
      const sh = getOrCreateResultSheet_();
      const ids = sh.getDataRange().getValues().slice(1).map(r => String(r[2]).trim());
      if (ids.includes(String(studentId).trim())) {
        return { ok: false, error: 'รหัสนักศึกษานี้ส่งข้อสอบไปแล้ว' };
      }
    }

    // ตรวจคำตอบ
    let correct = 0;
    const detail = questions.map((q, i) => {
      const userAns = answers[i];
      const isCorrect = userAns === q.answer;
      if (isCorrect) correct++;
      return {
        question:    q.question,
        choices:     q.choices,
        correctAns:  q.answer,
        userAns:     userAns,
        isCorrect:   isCorrect
      };
    });

    const total  = questions.length;
    const pct    = Math.round((correct / total) * 100);
    const passed = pct >= 60;
    const elapsed = formatTime_(elapsedSec || 0);

    // บันทึกผล
    saveResult_({ name, studentId, className, correct, total, pct, passed, elapsed });

    return { ok: true, correct, wrong: total - correct, total, pct, passed, detail };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ── บันทึกผลลงชีต ────────────────────────────────────────────
function saveResult_(r) {
  const sh  = getOrCreateResultSheet_();
  const row = sh.getLastRow() + 1;
  const now = new Date();
  sh.getRange(row, 1, 1, 9).setValues([[
    row - 1,
    r.name,
    r.studentId || '',
    r.className || '',
    r.correct + '/' + r.total,
    r.pct + '%',
    r.passed ? 'ผ่าน' : 'ไม่ผ่าน',
    r.elapsed,
    Utilities.formatDate(now, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
  ]]);

  // สีแถว
  sh.getRange(row, 1, 1, 9).setBackground(r.passed ? '#d4edda' : '#f8d7da');
}

// ── สร้าง/ดึง Sheet ผลสอบ ─────────────────────────────────────
function getOrCreateResultSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh   = ss.getSheetByName(SHEET_RESULTS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_RESULTS);
    const headers = ['#', 'ชื่อ-นามสกุล', 'รหัสนักศึกษา', 'ห้อง/กลุ่ม',
                     'คะแนน', 'คะแนน(%)', 'ผล', 'เวลาที่ใช้', 'วันที่-เวลา'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#6366f1').setFontColor('white').setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, headers.length, 130);
  }
  return sh;
}

// ── Helper ────────────────────────────────────────────────────
function formatTime_(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
