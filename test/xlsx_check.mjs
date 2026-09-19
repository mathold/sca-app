// อ่านค่าจาก xlsx จริง -> คำนวณ -> เทียบกับไฟล์ JSON ที่ใช้งานอยู่
import fs from 'fs';
import { execFileSync } from 'child_process';
import { readScaWorkbook } from '../src/sca_xlsx.js';
import { makeCase } from '../src/ortho_calc.js';
import { analyzeCase } from '../src/analyze.js';

const [xlsxPath, jsonPath] = process.argv.slice(2);
const wb = JSON.parse(execFileSync('python3', ['test/xlsx_to_sheetjs.py', xlsxPath], { maxBuffer: 1 << 26 }).toString());
const { input, warnings } = readScaWorkbook(wb);

const ref = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const fields = ['patient_name','dn','sna','snb','anb','sn_gogn','fma','wits','facc_to_fh',
  'l1_to_mpl_box','interincisal_current','l1_apog_current','co_a','co_gn','ans_me','a_to_n','pg_to_n',
  'overjet_current','overbite_current','tooth_size_discrepancy_upper','tooth_size_discrepancy_lower',
  'cos_q3','cos_q4','eline_upper_lip','eline_lower_lip','u1_sn','u1_pp','fh_to_fop','y_axis','u1_to_na','sn_to_ppl'];

const near = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) <= 0.06 : a === b;
let ok = 0; const bad = [];
for (const f of fields) {
  if (near(input[f], ref[f])) ok++; else bad.push([f, ref[f], input[f]]);
}
for (const q of ['q1','q2','q3','q4']) {
  const a = (ref.space_discrepancy||{})[q] ?? null, b = input.space_discrepancy[q];
  if (near(a, b)) ok++; else bad.push([`space_discrepancy.${q}`, a, b]);
}
console.log(`ค่าที่ตรงกัน ${ok}/${fields.length + 4}`);
if (bad.length) { console.log('ไม่ตรง:'); bad.forEach(([f,a,b]) => console.log(`   ${f.padEnd(32)} json=${JSON.stringify(a)}  xlsx=${JSON.stringify(b)}`)); }
if (warnings.length) { console.log('\nคำเตือนจากตัวอ่าน:'); warnings.forEach(w => console.log('   - ' + w)); }

const r = analyzeCase(makeCase(input));
console.log(`\nแผนที่ได้จากไฟล์ xlsx โดยตรง: บน ${r.treatment_plan.upper.decision} · ล่าง ${r.treatment_plan.lower.decision}`);
console.log(`ยังขาด: บน ${r.space_budget.upper.remaining} mm · ล่าง ${r.space_budget.lower.remaining} mm`);
