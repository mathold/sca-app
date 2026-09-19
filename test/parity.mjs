// เทียบผลลัพธ์ JavaScript กับ Python ทีละค่า — ต่างแม้ค่าเดียวถือว่าไม่ผ่าน
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeCase } from '../src/ortho_calc.js';
import { analyzeCase } from '../src/analyze.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..');
const pyOut = JSON.parse(fs.readFileSync(path.join(here, 'py_out.json'), 'utf8'));

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
    a.forEach((v, i) => walk(v, b[i], `${p}[${i}]`));
    return;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) walk(a[k], b[k], p ? `${p}.${k}` : k);
    return;
  }
  if (a !== b) diffs.push([p, a, b]);
}

let n = 0, bad = 0;
const perCase = [];
for (const [name, expected] of Object.entries(pyOut)) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'cases', name), 'utf8'));
  delete raw.diagnosis; delete raw.input_flag;
  const got = analyzeCase(makeCase(raw));
  const before = diffs.length;
  walk(expected, got, '');
  const added = diffs.length - before;
  n++;
  if (added) { bad++; perCase.push([name, added]); }
}

console.log(`เทียบ ${n} เคส · ตรงกันหมด ${n - bad} เคส · ต่าง ${bad} เคส · จุดที่ต่าง ${diffs.length} จุด`);
if (diffs.length) {
  console.log('\nตัวอย่างจุดที่ต่าง (สูงสุด 25):');
  const seen = new Map();
  for (const [p, a, b] of diffs) {
    const key = p.replace(/\[\d+\]/g, '[]');
    if (!seen.has(key)) seen.set(key, [a, b, 0]);
    seen.get(key)[2]++;
  }
  [...seen.entries()].sort((x, y) => y[1][2] - x[1][2]).slice(0, 25)
    .forEach(([k, [a, b, c]]) => console.log(`  ${String(c).padStart(4)}x  ${k}\n        py=${JSON.stringify(a)}\n        js=${JSON.stringify(b)}`));
}
process.exit(diffs.length ? 1 : 0);
