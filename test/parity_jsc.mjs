/* parity_jsc.mjs — ตัวรันทดสอบสำหรับเครื่องที่ไม่มี node (ใช้ jsc ที่มากับ macOS)
 *
 *   python3 test/dump_py.py                 # สร้าง py_out.json จาก ortho_calc.py
 *   SCA_ROOT=/path/to/LOGO python3 test/dump_py.py    # ชี้ไป worktree อื่นก็ได้
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
 *       -m test/parity_jsc.mjs
 *
 * ตรวจ 2 อย่าง
 *   1) parity  — ผลลัพธ์ analyzeCase ของ JS ต้องตรงกับ Python ทุกค่า (รวมข้อความ diagnosis)
 *   2) balance — ตารางดุลพื้นที่: ฝั่ง + ต้องเท่าฝั่ง − ทุกควอดรันต์ ทุกแผน ทุกเคส
 *                (กติกาคุณหมอ 22 ก.ย. 2569)
 *
 * ถ้า cases/ อยู่ที่ checkout อื่น ให้ใส่ path ลง test/cases_root.txt (บรรทัดเดียว)
 */
import { makeCase } from '../src/ortho_calc.js';
import { analyzeCase } from '../src/analyze.js';
import { buildPlanSheets } from '../src/plan_sheets.js';

const HERE = '/Users/mathold/Desktop/Code/LOGO/sca-app';
// ปกติ cases/ อยู่ที่โฟลเดอร์แม่ · ถ้าจะเทียบกับ checkout อื่น (เช่น git worktree)
// ให้เขียน path ของ checkout นั้นลงไฟล์ test/cases_root.txt บรรทัดเดียว
let CASES_ROOT = HERE + '/..';
try { const t = readFile(HERE + '/test/cases_root.txt').trim(); if (t) CASES_ROOT = t; } catch (e) {}

const pyOut = JSON.parse(readFile(HERE + '/test/py_out.json'));
const diffs = [];
function walk(a, b, p) {
  if (a === null || a === undefined || b === null || b === undefined) {
    if ((a ?? null) !== (b ?? null)) diffs.push([p, a, b]);
    return;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 1e-9) diffs.push([p, a, b]);
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) { diffs.push([p, a, b]); return; }
    a.forEach((v, i) => walk(v, b[i], p + '[' + i + ']'));
    return;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) walk(a[k], b[k], p ? p + '.' + k : k);
    return;
  }
  if (a !== b) diffs.push([p, a, b]);
}

let n = 0, badCase = 0, quadN = 0, quadBad = 0;
const unbalanced = [];
for (const name of Object.keys(pyOut)) {
  const raw = JSON.parse(readFile(CASES_ROOT + '/cases/' + name));
  delete raw.diagnosis; delete raw.input_flag; delete raw._comment;
  let res;
  try { res = analyzeCase(makeCase(raw)); }
  catch (e) { print('ERROR ' + name + ': ' + e); badCase++; n++; continue; }
  const before = diffs.length;
  walk(pyOut[name], res, '');
  n++;
  if (diffs.length > before) badCase++;

  for (const plan of buildPlanSheets(res)) {
    for (const q of plan.quads) {
      quadN++;
      const d = Math.round((q.totalPlus - q.totalMinus) * 100) / 100;
      if (Math.abs(d) > 0.02) { quadBad++; unbalanced.push(name + ' · ' + plan.title + ' · ' + q.quad + ' (' + d + ')'); }
    }
  }
}

print('1) parity  : ' + n + ' เคส · ไม่ตรง ' + badCase + ' เคส · ต่าง ' + diffs.length + ' ค่า');
for (const d of diffs.slice(0, 15)) print('     ' + d[0] + ' : ' + JSON.stringify(d[1]) + ' -> ' + JSON.stringify(d[2]));
if (diffs.length > 15) print('     … อีก ' + (diffs.length - 15) + ' ค่า');
print('2) balance : ' + quadN + ' ควอดรันต์ · ไม่ดุล ' + quadBad);
for (const u of unbalanced.slice(0, 15)) print('     ' + u);
print('');
print((diffs.length === 0 && quadBad === 0) ? 'ผ่านทั้งหมด' : 'ไม่ผ่าน');
