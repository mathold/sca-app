import fs from 'fs'; import path from 'path';
import { execFileSync } from 'child_process';
import { readScaWorkbook } from '../src/sca_xlsx.js';
import { makeCase } from '../src/ortho_calc.js';
import { analyzeCase } from '../src/analyze.js';

const DOCS = process.argv[2];
const CASES = '../cases';
const jsons = fs.readdirSync(CASES).filter(f => f.endsWith('.json'));
const byDn = new Map();
for (const j of jsons) {
  const d = JSON.parse(fs.readFileSync(path.join(CASES, j), 'utf8'));
  if (d.dn) byDn.set(String(d.dn), { file: j, data: d });
}
const fields = ['sna','snb','anb','sn_gogn','fma','wits','facc_to_fh','l1_to_mpl_box',
  'interincisal_current','l1_apog_current','co_a','co_gn','overjet_current','overbite_current',
  'tooth_size_discrepancy_upper','tooth_size_discrepancy_lower','cos_q3','cos_q4'];
const near = (a,b) => (a==null&&b==null) ? true : (typeof a==='number'&&typeof b==='number') ? Math.abs(a-b)<=0.06 : a===b;

let files = 0, matched = 0, totalOk = 0, totalCmp = 0;
const problems = [];
for (const f of fs.readdirSync(DOCS)) {
  if (!f.endsWith('.xlsx') || !f.includes('SCA_Table')) continue;
  files++;
  let wb;
  try { wb = JSON.parse(execFileSync('python3', ['test/xlsx_to_sheetjs.py', path.join(DOCS, f)], {maxBuffer: 1<<26, stdio: ["ignore","pipe","ignore"]}).toString()); }
  catch { continue; }                 // ไฟล์ที่ยังไม่ sync ลงเครื่อง
  const { input } = readScaWorkbook(wb);
  const ref = byDn.get(String(input.dn));
  if (!ref) continue;
  matched++;
  let ok = 0; const bad = [];
  for (const k of fields) { totalCmp++; if (near(input[k], ref.data[k])) { ok++; totalOk++; } else bad.push(`${k}: json=${ref.data[k]} xlsx=${input[k]}`); }
  if (bad.length) problems.push([f.slice(0,34), ref.file.slice(0,34), bad]);
}
console.log(`ไฟล์ xlsx ที่เปิดได้และจับคู่กับเคสได้ ${matched} เคส (จากทั้งหมด ${files} ไฟล์)`);
console.log(`ค่าที่ตรงกัน ${totalOk}/${totalCmp}`);
if (problems.length) { console.log('\nเคสที่มีค่าไม่ตรง:'); problems.forEach(([x,j,b]) => { console.log(`  ${x}`); b.forEach(s => console.log('     ' + s)); }); }
