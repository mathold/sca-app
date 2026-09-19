/*
 * ortho_calc.js — พอร์ต 1:1 จาก ortho_calc.py
 * ห้ามแก้ตรรกะ: ทุกสูตร/เกณฑ์/ข้อความ ต้องให้ผลตรงกับฝั่ง Python ทุกประการ
 * ตรวจสอบด้วย test/parity.mjs (รันทุกเคสใน cases/ เทียบทีละค่า)
 */

/* ------------------------------------------------------------------ *
 * 1) ตัวช่วยให้ผลตรงกับ Python เป๊ะ
 * ------------------------------------------------------------------ */

// Python round(): ปัดครึ่งไปหาเลขคู่ (banker's rounding) บนค่า double จริง
// JS Math.round() ปัดครึ่งขึ้นเสมอ -> ต่างกันในเคสที่ลงตัวพอดี เช่น round(0.125,2)
//   Python = 0.12   ·   (0.125).toFixed(2) = "0.13"
// คำนวณจากบิตจริงของ double ด้วย BigInt จึงไม่มีความคลาดเคลื่อนสะสม
const _dv = new DataView(new ArrayBuffer(8));
function pyRound(x, nd = 0) {
  if (x === null || x === undefined) return x;
  if (!Number.isFinite(x)) return x;
  if (x === 0) return x;          // คง -0 ไว้ให้เหมือน Python
  const neg = x < 0;
  const ax = Math.abs(x);

  _dv.setFloat64(0, ax);
  const hi = _dv.getUint32(0), lo = _dv.getUint32(4);
  let biasedExp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  if (biasedExp === 0) biasedExp = 1;           // subnormal
  else mant |= (1n << 52n);                      // implicit leading 1
  const e = BigInt(biasedExp - 1075);            // ค่าจริง = mant * 2^e

  // ปัด mant * 2^e * 10^nd ให้เป็นจำนวนเต็ม แบบครึ่งไปหาเลขคู่
  let num = mant * (10n ** BigInt(nd));
  let den = 1n;
  if (e >= 0n) num <<= e; else den <<= -e;

  let q = num / den;
  const r2 = (num % den) * 2n;
  if (r2 > den || (r2 === den && (q % 2n === 1n))) q += 1n;

  const res = Number(q) / Math.pow(10, nd);
  return neg ? -res : res;
}

// normalise -0 ให้เป็น 0 (Python แสดง -0.0 ต่างจาก 0.0 ใน JSON)
function nz(x) { return x === 0 ? 0 : x; }

// "%g" ของ C/Python: ตัดศูนย์ท้าย ใช้ precision 6 หลักนัยสำคัญ
function fmtG(x) {
  if (x === null || x === undefined) return String(x);
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return Object.is(x, -0) ? '-0' : '0';
  const exp = Math.floor(Math.log10(Math.abs(x)));
  let s;
  if (exp < -4 || exp >= 6) {
    s = x.toExponential(5);
    let [m, e] = s.split('e');
    if (m.indexOf('.') >= 0) m = m.replace(/0+$/, '').replace(/\.$/, '');
    const sign = e[0] === '-' ? '-' : '+';
    const digits = e.replace(/^[+-]/, '').padStart(2, '0');
    return `${m}e${sign}${digits}`;
  }
  s = x.toFixed(Math.max(0, 5 - exp));
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

// Python str(float): จำนวนเต็มต้องมี ".0" ต่อท้าย (5.0 ไม่ใช่ 5)
// ใช้กับ f-string แบบ {x} ที่ไม่ได้ระบุรูปแบบ — ต่างจาก "%g" ที่ตัด .0 ทิ้ง
function pyFloatStr(x) {
  if (x === null || x === undefined) return String(x);
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x)) return (Object.is(x, -0) ? '-0' : String(x)) + '.0';
  return String(x);
}

// Python max(): เมื่อค่าเท่ากันคืน "ตัวแรก" -> max(-0.0, 0.0) = -0.0
// JS Math.max(-0, 0) = 0 ซึ่งทำให้ "%g" พิมพ์ต่างกัน (-0 vs 0)
function pyMax(a, b) { return (b > a) ? b : a; }

// f"{x:.2f}" / "%.2f"
function fmtF(x, nd) {
  const r = pyRound(x, nd);
  const neg = (r < 0) || Object.is(r, -0);
  return (neg ? '-' : '') + Math.abs(r).toFixed(nd);
}
// f"{x:+.2f}" — บังคับมีเครื่องหมาย (รวม -0.00)
function fmtFSigned(x, nd) {
  const r = pyRound(x, nd);
  const neg = (r < 0) || Object.is(r, -0);
  return (neg ? '-' : '+') + Math.abs(r).toFixed(nd);
}
// "%+g" — มีเครื่องหมายเสมอ
function fmtGSigned(x) {
  const neg = (x < 0) || Object.is(x, -0);
  return (neg ? '' : '+') + fmtG(x);
}

/* ------------------------------------------------------------------ *
 * 2) ค่าคงที่ (ตรงกับ ASSUMPTIONS ใน ortho_calc.py)
 * ------------------------------------------------------------------ */
const ASSUMPTIONS = {
  avg_premolar_width_mm: 7.0,
  interincisal_target_default: 131.0,
  interincisal_range_low: 125.0,
  interincisal_range_high: 131.0,
  l1_apog_target_mid: 2.0,
  l1_apog_target_high: 3.0,
  l1_apog_target_low: 1.0,
  l1apog_torque_coeff: 0.9,
  expansion_gain_ratio: 0.7,
  ipr_max_per_arch: 6.0,
  distalize_default_mm: 3.0,
  expansion_option_default_mm: 4.0,
  class3_impa_floor: 85.0,
  class3_impa_floor_extended: 80.0,   // หย่อนเฉพาะแผน B เมื่อ 85 ไม่พอปิด OJ
  surgery_reverse_oj_threshold: -1.0,
};

// ตาราง McNamara: (Co-A, Co-Gn_low, Co-Gn_high, ANS-Me_low, ANS-Me_high)
const MCNAMARA_TABLE = [
  [80, 97, 100, 57, 58], [81, 99, 102, 57, 58], [82, 101, 104, 58, 59],
  [83, 103, 106, 58, 59], [84, 104, 107, 59, 60], [85, 105, 108, 60, 62],
  [86, 107, 110, 60, 62], [87, 109, 112, 61, 63], [88, 111, 114, 61, 63],
  [89, 112, 115, 62, 64], [90, 113, 116, 63, 64], [91, 115, 118, 63, 64],
  [92, 117, 120, 64, 65], [93, 119, 122, 65, 66], [94, 121, 124, 66, 67],
  [95, 122, 125, 67, 69], [96, 124, 127, 67, 69], [97, 126, 129, 68, 70],
  [98, 128, 131, 68, 70], [99, 129, 132, 69, 71], [100, 130, 133, 70, 74],
  [101, 132, 135, 71, 75], [102, 134, 137, 72, 76], [103, 136, 139, 73, 77],
  [104, 137, 140, 74, 78], [105, 138, 141, 75, 79],
];
const MCNAMARA_NORMS = {
  co_a: 85.0,
  co_gn: [105.0, 108.0],
  ans_me: [60.0, 62.0],
  a_to_n: 1.0,
  pg_to_n: [-4.0, -2.0],
};

/* ------------------------------------------------------------------ *
 * 3) โครงสร้าง input
 * ------------------------------------------------------------------ */
function quad(o) {
  o = o || {};
  const g = (k) => (o[k] === undefined ? null : o[k]);
  return { q1: g('q1'), q2: g('q2'), q3: g('q3'), q4: g('q4') };
}
function sideRel(o) {
  o = o || {};
  const g = (k) => (o[k] === undefined ? null : o[k]);
  return { rt_class: g('rt_class'), lt_class: g('lt_class'), rt_mm: g('rt_mm'), lt_mm: g('lt_mm') };
}

const CASE_DEFAULTS = {
  patient_name: '', dn: '', age: null, date: '',
  sna: null, snb: null, anb: null, sn_gogn: null, fma: null,
  facc_to_fh: 0.0, l1_to_mpl_box: 0.0,
  interincisal_current: null, l1_apog_current: 0.0, l1_apog_after_torque_est: null,
  eline_upper_lip: null, eline_lower_lip: null,
  cos_mm: 0.0,
  tooth_size_discrepancy_upper: 0.0, tooth_size_discrepancy_lower: 0.0,
  overjet_current: 0.0, overbite_current: 0.0,
  molar_target: 'follow',
  arch_width_data_available: false,
  wits: null, u1_sn: null, u1_pp: null,
  fh_to_fop: null, y_axis: null, u1_to_na: null, sn_to_ppl: null,
  arch_width_intercanine_upper: null, arch_width_intercanine_lower: null,
  arch_width_intermolar_upper: null, arch_width_intermolar_lower: null,
  cos_q3: null, cos_q4: null,
  co_a: null, co_gn: null, ans_me: null, a_to_n: null, pg_to_n: null,
  premolars_extracted_upper: 0, premolars_extracted_lower: 0,
  growth_pattern: 'average',
  treatment_mode: 'auto',
  upper_torque_type: 'crown',
};

function makeCase(raw) {
  raw = raw || {};
  const inp = Object.assign({}, CASE_DEFAULTS);
  for (const k of Object.keys(CASE_DEFAULTS)) {
    if (raw[k] !== undefined && raw[k] !== null) inp[k] = raw[k];
    else if (raw[k] === null && CASE_DEFAULTS[k] === null) inp[k] = null;
  }
  // ฟิลด์ที่ยอมให้เป็น null ได้แม้ default ไม่ใช่ null
  for (const k of ['age', 'interincisal_current', 'l1_apog_after_torque_est']) {
    if (raw[k] === null) inp[k] = null;
  }
  inp.midline = quad(raw.midline);
  inp.arch_expansion = quad(raw.arch_expansion);
  inp.space_discrepancy = quad(raw.space_discrepancy);
  inp.canine_relationship = sideRel(raw.canine_relationship);
  inp.molar_relationship = sideRel(raw.molar_relationship);
  inp.missing_teeth = raw.missing_teeth ? raw.missing_teeth.slice() : [];
  return inp;
}

/* ------------------------------------------------------------------ *
 * 4) ขั้นที่ 1 — ฟันบน (FACC -> 0)
 * ------------------------------------------------------------------ */
function upperTorqueCorrection(faccToFh) {
  const deltaU1 = faccToFh - 0.0;
  const spaceUpper = (deltaU1 / 5.0) * 1.6;
  const deltaOj1 = -(deltaU1 / 5.0) * 1.7;
  return {
    delta_u1: pyRound(deltaU1, 2),
    space_upper_torque_mm: pyRound(spaceUpper, 2),
    delta_overjet_mm: pyRound(deltaOj1, 2),
  };
}

/* ------------------------------------------------------------------ *
 * 5) ขั้นที่ 2 — ฟันล่าง (1/1 -> 131)
 * ------------------------------------------------------------------ */
function estimateInterincisalCurrent(faccToFh, l1ToMplBox) {
  const l1abs = 90.0 + l1ToMplBox;
  return 180.0 - faccToFh - l1abs;
}

function lowerTorqueCorrection(l1ToMplBox, deltaU1, interincisalCurrent, faccToFh,
                               iiTarget = ASSUMPTIONS.interincisal_target_default) {
  const wasEstimated = (interincisalCurrent === null || interincisalCurrent === undefined);
  let ii = wasEstimated ? estimateInterincisalCurrent(faccToFh, l1ToMplBox) : interincisalCurrent;

  const iiInterim = ii + deltaU1;

  // 1/1 ที่อยู่ในช่วงยอมรับ 125-131 แล้ว = ไม่ต้องขยับต่อ (ตัดสินใจคุณหมอ 18 ก.ย. 2569)
  // นอกช่วง -> ขยับไปที่ "ขอบใกล้สุด" ของช่วง ไม่ใช่ดันไป 131 เสมอ
  const iiLo = ASSUMPTIONS.interincisal_range_low;
  const iiHi = ASSUMPTIONS.interincisal_range_high;
  const alreadyInRange = (iiLo <= iiInterim && iiInterim <= iiHi);
  let iiGoal, deltaL1;
  if (alreadyInRange) {
    iiGoal = iiInterim;
    deltaL1 = 0.0;              // เข้าช่วงแล้ว ไม่ขยับ ไม่กินพื้นที่
  } else {
    iiGoal = iiInterim > iiHi ? iiHi : iiLo;
    deltaL1 = iiGoal - iiInterim;   // + = ต้อง upright (retrocline) ต่อ
  }

  const spaceLower = (deltaL1 / 5.0) * 1.2;
  const deltaOj2 = (deltaL1 / 5.0) * 1.3;
  const deltaL1apog = -(deltaL1 / 5.0) * ASSUMPTIONS.l1apog_torque_coeff;

  return {
    interincisal_current: pyRound(ii, 2),
    interincisal_was_estimated: wasEstimated,
    interincisal_interim_after_upper: pyRound(iiInterim, 2),
    interincisal_goal: pyRound(iiGoal, 2),
    interincisal_already_in_range: alreadyInRange,
    delta_l1: pyRound(deltaL1, 2),
    space_lower_torque_mm: pyRound(spaceLower, 2),
    delta_overjet_mm: pyRound(deltaOj2, 2),
    delta_l1apog_mm: pyRound(deltaL1apog, 2),
  };
}

/* ------------------------------------------------------------------ *
 * 6) พื้นที่ต่อ arch
 * ------------------------------------------------------------------ */
function midlineCorrectionSpace(q, arch) {
  const vals = (arch === 'upper' ? [q.q1, q.q2] : [q.q3, q.q4]).filter(v => v !== null && v !== undefined);
  if (!vals.length) return 0.0;
  return pyRound(vals.reduce((a, b) => a + b, 0), 2);
}

function resolveCos(cosMm, cosQ3, cosQ4) {
  if (cosMm) return [cosMm, null];
  const vals = [cosQ3, cosQ4].filter(v => v !== null && v !== undefined);
  if (vals.length) {
    const avg = pyRound(vals.reduce((a, b) => a + b, 0) / vals.length, 2);
    return [avg, { q3: cosQ3, q4: cosQ4, avg: avg }];
  }
  return [cosMm, null];
}

function totalSpaceRequired(tsd, cosComponent, torqueSpace, midlineSpace) {
  return pyRound(-tsd + cosComponent + torqueSpace + midlineSpace, 2);
}

function expansionSpaceGain(q, arch, ratio = ASSUMPTIONS.expansion_gain_ratio) {
  const vals = arch === 'upper' ? { Q1: q.q1, Q2: q.q2 } : { Q3: q.q3, Q4: q.q4 };
  const perQuad = {};
  for (const k of Object.keys(vals)) perQuad[k] = pyRound((vals[k] || 0.0) * ratio, 2);
  const totalExpansion = Object.values(vals).reduce((a, v) => a + (v || 0.0), 0);
  return {
    per_quadrant_gain_mm: perQuad,
    total_expansion_input_mm: totalExpansion,
    total_space_gained_mm: pyRound(totalExpansion * ratio, 2),
  };
}

/* ------------------------------------------------------------------ *
 * 7) เกณฑ์ตัดสินแผน (ชุดที่ 2)
 * ------------------------------------------------------------------ */
// เกณฑ์ตัดสินแผน — ชุดเดียว (ตัดสินใจคุณหมอ 18 ก.ย. 2569)
// ใช้ remainingMm = พื้นที่ที่ยัง "ขาด" หลังหัก supply แล้ว
//   <= 0.5 -> Non-Extraction · 0.5-6 -> IPR · > 6 -> Extraction
// L1-APog ไม่ใช่เกณฑ์ตัดสิน แต่ถูกนำไปกำหนดระยะที่ฟันล่างต้องขยับตั้งแต่ต้นทาง
// ซึ่งรวมอยู่ใน remainingMm แล้ว — เอามาตัดสินซ้ำคือการนับซ้ำ
function spaceManagementDecision(remainingMm, l1ApogFinal, totalSpaceRequiredMm = null) {
  let decision;
  if (remainingMm > 6) decision = 'Extraction';
  else if (remainingMm <= 0.5) decision = 'Non-Extraction';
  else decision = 'IPR';

  let bandTxt;
  if (remainingMm > 6) bandTxt = `พื้นที่ที่ยังขาด ${fmtG(remainingMm)} mm > 6 mm`;
  else if (remainingMm <= 0.5) bandTxt = `พื้นที่ที่ยังขาด ${fmtG(remainingMm)} mm <= 0.5 mm (พอจากช่องว่างเดิม/ขยาย)`;
  else bandTxt = `พื้นที่ที่ยังขาด ${fmtG(remainingMm)} mm อยู่ในช่วง 0.5-6 mm`;

  let reason = `${decision} เนื่องจาก ${bandTxt}`;
  if (totalSpaceRequiredMm !== null && totalSpaceRequiredMm !== undefined) {
    reason += ` (Total Space Required ${fmtG(totalSpaceRequiredMm)} mm ก่อนหักพื้นที่ที่มีอยู่)`;
  }

  let l1Note = null;
  if (l1ApogFinal !== null && l1ApogFinal !== undefined && !(1 <= l1ApogFinal && l1ApogFinal <= 3)) {
    const tgt = l1ApogFinal > 3 ? 3.0 : 1.0;
    l1Note = `L1-APog ${fmtG(l1ApogFinal)} mm อยู่นอกช่วง 1-3 mm -> ฟันล่างต้องขยับ `
      + `${fmtG(pyRound(Math.abs(l1ApogFinal - tgt), 2))} mm เข้าหาขอบช่วงที่ ${fmtG(tgt)} mm `
      + 'ซึ่งนับเป็นพื้นที่ที่ต้องใช้ไปแล้วในตัวเลขข้างต้น';
  }

  return {
    decision,
    remaining: remainingMm,
    total_space_required: (totalSpaceRequiredMm !== null && totalSpaceRequiredMm !== undefined)
      ? totalSpaceRequiredMm : remainingMm,
    l1_apog_final: l1ApogFinal,
    reason,
    note: l1Note,
    cross_check_note: null,
    asymmetric_note: null,
  };
}

function asymmetricAnchorageNote(midline, arch, decision) {
  if (decision !== 'Extraction') return null;
  const parts = [];
  if (arch === 'upper') {
    if (midline.q1) parts.push(`ขวา ${pyFloatStr(midline.q1)}mm (Q1)`);
    if (midline.q2) parts.push(`ซ้าย ${pyFloatStr(midline.q2)}mm (Q2)`);
  } else {
    if (midline.q3) parts.push(`ซ้าย ${pyFloatStr(midline.q3)}mm (Q3)`);
    if (midline.q4) parts.push(`ขวา ${pyFloatStr(midline.q4)}mm (Q4)`);
  }
  if (!parts.length) return null;
  return ('พบ midline shift ' + parts.join(' / ') + ' ร่วมกับแผน Extraction ของ arch นี้ — '
    + 'พิจารณา Asymmetric Extraction หรือ Asymmetric Anchorage (เช่น เสริม TAD เฉพาะข้างที่ต้องการ '
    + 'anchorage มากกว่า)');
}

/* ------------------------------------------------------------------ *
 * 8) McNamara — reference jaw
 * ------------------------------------------------------------------ */
function interp(x, xs, ys) {
  if (x <= xs[0]) {
    const slope = (ys[1] - ys[0]) / (xs[1] - xs[0]);
    return ys[0] + slope * (x - xs[0]);
  }
  if (x >= xs[xs.length - 1]) {
    const n = xs.length;
    const slope = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
    return ys[n - 1] + slope * (x - xs[n - 1]);
  }
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

function distToRange(v, lo, hi) {
  if (v < lo) return lo - v;
  if (v > hi) return v - hi;
  return 0.0;
}

function mcnamaraReferenceAnalysis(inp) {
  const coA = inp.co_a, coGn = inp.co_gn;
  if (coA === null || coA === undefined || coGn === null || coGn === undefined) {
    return { available: false, note: 'ไม่มีค่า McNamara (Co-A / Co-Gn) — ข้ามการหา reference jaw' };
  }

  const xs = MCNAMARA_TABLE.map(r => r[0]);
  const coGnLo = MCNAMARA_TABLE.map(r => r[1]);
  const coGnHi = MCNAMARA_TABLE.map(r => r[2]);
  const coGnMid = MCNAMARA_TABLE.map(r => (r[1] + r[2]) / 2.0);

  const maxDev = Math.abs(coA - MCNAMARA_NORMS.co_a);
  const [gnLo, gnHi] = MCNAMARA_NORMS.co_gn;
  const mandDev = distToRange(coGn, gnLo, gnHi);
  const ref = mandDev < maxDev ? 'mandible' : 'maxilla';

  const tol = 1.5;
  let otherStatus, otherWord, maxillaStatus, mandibleStatus, expectedNote, summaryJaw;

  if (ref === 'maxilla') {
    const expLo = interp(coA, xs, coGnLo);
    const expHi = interp(coA, xs, coGnHi);
    if (coGn > expHi + tol) { otherStatus = 'big'; otherWord = 'ใหญ่กว่า'; }
    else if (coGn < expLo - tol) { otherStatus = 'small'; otherWord = 'เล็กกว่า'; }
    else { otherStatus = 'normal'; otherWord = 'สมส่วน'; }
    maxillaStatus = 'reference';
    mandibleStatus = otherStatus;
    expectedNote = `maxilla เป็น ref (Co-A ${pyFloatStr(coA)}) → mandible ที่สมส่วนควร ~`
      + `${pyFloatStr(pyRound(expLo, 1))}–${pyFloatStr(pyRound(expHi, 1))} mm, วัดได้ ${pyFloatStr(coGn)} → ${otherWord} ref`;
    summaryJaw = `Mandible ${otherWord} Maxilla`;
  } else {
    const expCoA = interp(coGn, coGnMid, xs);
    if (coA > expCoA + tol) { otherStatus = 'big'; otherWord = 'ใหญ่กว่า'; }
    else if (coA < expCoA - tol) { otherStatus = 'small'; otherWord = 'เล็กกว่า'; }
    else { otherStatus = 'normal'; otherWord = 'สมส่วน'; }
    mandibleStatus = 'reference';
    maxillaStatus = otherStatus;
    expectedNote = `mandible เป็น ref (Co-Gn ${pyFloatStr(coGn)}) → maxilla ที่สมส่วนควร ~`
      + `${pyFloatStr(pyRound(expCoA, 1))} mm, วัดได้ ${pyFloatStr(coA)} → ${otherWord} ref`;
    summaryJaw = `Maxilla ${otherWord} Mandible`;
  }

  let pattern;
  if (maxillaStatus === 'small' || mandibleStatus === 'big') {
    pattern = 'แนวโน้ม skeletal Class III (maxillary deficiency / mandibular excess)';
  } else if (maxillaStatus === 'big' || mandibleStatus === 'small') {
    pattern = 'แนวโน้ม skeletal Class II (maxillary excess / mandibular deficiency)';
  } else {
    pattern = 'ขากรรไกรบน-ล่างสมส่วน (skeletal Class I โครงสร้าง)';
  }

  const refWord = ref === 'mandible' ? 'Mandible' : 'Maxilla';
  const note = `Reference jaw = ${refWord} (ใกล้ค่า normal adult มากที่สุด: `
    + `max ต่าง ${pyFloatStr(pyRound(maxDev, 1))} mm vs mand ต่าง ${pyFloatStr(pyRound(mandDev, 1))} mm). `
    + `${expectedNote}. สรุป: ${summaryJaw} → ${pattern}. `
    + '[ยืนยันด้วยทันตแพทย์ — decision support]';

  return {
    available: true,
    ref, ref_label: refWord,
    co_a: coA, co_gn: coGn, ans_me: inp.ans_me,
    a_to_n: inp.a_to_n, pg_to_n: inp.pg_to_n,
    max_dev_from_norm: pyRound(maxDev, 2),
    mand_dev_from_norm: pyRound(mandDev, 2),
    maxilla_status: maxillaStatus,
    mandible_status: mandibleStatus,
    summary: summaryJaw,
    pattern,
    note,
  };
}

/* ------------------------------------------------------------------ *
 * 9) Diagnosis / E-line / Growth
 * ------------------------------------------------------------------ */
function autoDiagnosis(inp) {
  const parts = [];
  if (inp.anb !== null && inp.anb !== undefined) {
    if (inp.anb > 4) parts.push('Skeletal Class II');
    else if (inp.anb < 0) parts.push('Skeletal Class III');
    else parts.push('Skeletal Class I');
  }
  if (inp.growth_pattern === 'high_angle') parts.push('Vertical Growth Pattern (High Angle)');
  else if (inp.growth_pattern === 'low_angle') parts.push('Horizontal Growth Pattern (Low Angle)');

  if ((inp.eline_upper_lip !== null && inp.eline_upper_lip !== undefined && inp.eline_upper_lip > 4)
    && (inp.eline_lower_lip !== null && inp.eline_lower_lip !== undefined && inp.eline_lower_lip > 2)) {
    parts.push('Bimaxillary Protrusion');
  }

  const crowding = [];
  if (inp.tooth_size_discrepancy_upper < 0) {
    const mag = Math.abs(inp.tooth_size_discrepancy_upper);
    crowding.push(`${mag > 5 ? 'Severe' : (mag >= 2 ? 'Moderate' : 'Mild')} Upper Crowding`);
  }
  if (inp.tooth_size_discrepancy_lower < 0) {
    const mag = Math.abs(inp.tooth_size_discrepancy_lower);
    crowding.push(`${mag > 5 ? 'Severe' : (mag >= 2 ? 'Moderate' : 'Mild')} Lower Crowding`);
  }
  parts.push(...crowding);

  if (inp.overjet_current > 4) parts.push(`Increased Overjet (${pyFloatStr(inp.overjet_current)}mm)`);
  if (inp.overbite_current > 4) parts.push('Deep Bite');
  else if (inp.overbite_current < 0) parts.push('Anterior Open Bite');

  if (!parts.length) return 'รอผลวินิจฉัยสรุป (ไม่มีข้อมูลเพียงพอในการประเมินอัตโนมัติ — โปรดระบุ diagnosis)';
  return parts.join(', ') + ' (ประเมินอัตโนมัติจากค่า SCA — โปรดให้ทันตแพทย์ยืนยัน/แก้ไข)';
}

function elineAdvice(upperLip, lowerLip) {
  const u = (upperLip === undefined) ? null : upperLip;
  const l = (lowerLip === undefined) ? null : lowerLip;
  if (u === null && l === null) {
    return 'ไม่มีข้อมูล E-line ในตาราง SCA — แนะนำประเมิน soft tissue profile เพิ่มเติมจากภาพถ่ายด้านข้างใบหน้า';
  }
  const notes = [];
  if (u !== null) {
    if (u > 4) notes.push(`ริมฝีปากบนยื่นเกิน norm (~4mm), วัดได้ ${pyFloatStr(u)}mm — สนับสนุน extraction/retraction มากขึ้น`);
    else if (u < -2) notes.push(`ริมฝีปากบนถอยเกิน norm, วัดได้ ${pyFloatStr(u)}mm — ระวัง over-retraction`);
  }
  if (l !== null) {
    if (l > 2) notes.push(`ริมฝีปากล่างยื่นเกิน norm (~2mm), วัดได้ ${pyFloatStr(l)}mm — สนับสนุน extraction/retraction มากขึ้น`);
    else if (l < -2) notes.push(`ริมฝีปากล่างถอยเกิน norm, วัดได้ ${pyFloatStr(l)}mm — ระวัง over-retraction`);
  }
  return notes.length ? notes.join(' | ') : 'อยู่ในช่วงใกล้เคียง norm';
}

function growthApplianceAdvice(growthPattern) {
  if (growthPattern === 'low_angle') {
    return ['Horizontal Growth (Low Angle): พิจารณา Anterior Bite Plane / Anterior Bite Ramp เพื่อช่วยปลดการสบฟันและเปิดสบฟันหลัง'];
  }
  if (growthPattern === 'high_angle') {
    return ['Vertical Growth (High Angle): พิจารณา Posterior Bite Block / Posterior Intrusion Control เพื่อควบคุมมิติแนวตั้ง'];
  }
  return ['Average Growth: ใกล้เคียง norm ทั้ง FMA และ SN-GoGn แนะนำเพียง mild monitoring ไม่จำเป็นต้องใช้ bite block เต็มรูปแบบ'];
}

/* ------------------------------------------------------------------ *
 * 10) แผนไปถึงเป้า Overjet
 * ------------------------------------------------------------------ */
function overjetTargetPlan(overjetCurrent, deltaUp, deltaLow, overjetFinal,
                           gap, faccToFh, anchorageUpper, anchorageLower) {
  const target = 2.0;
  const steps = [
    `Torque (ขั้น 1–2): Overjet ${pyFloatStr(overjetCurrent)}mm → ${pyFloatStr(overjetFinal)}mm `
    + `(บน ${fmtFSigned(deltaUp, 2)}mm จาก FACC ${pyFloatStr(faccToFh)}°→0°, ล่าง ${fmtFSigned(deltaLow, 2)}mm)`,
  ];
  if (Math.abs(gap) < 0.05) {
    steps.push(`Overjet เข้าเป้า ${fmtG(target)}mm พอดีจาก torque อย่างเดียว — ไม่ต้องเคลื่อนฟัน A-P เพิ่ม`);
    return { steps, warn: null };
  }

  if (gap > 0) {
    steps.push(`ยังต่ำกว่าเป้า +${fmtG(target)}mm อยู่ ${fmtF(gap, 2)}mm — เพิ่ม overjet กลับด้วยการเคลื่อนฟัน A-P `
      + `แบบ en-masse: retract ฟันหน้าล่าง และ/หรือ advance–procline ฟันหน้าบน ให้ขอบฟันบนนำหน้าฟันล่าง ${fmtG(target)}mm`);
  } else {
    const amt = -gap;
    steps.push(`ยังเกินเป้า +${fmtG(target)}mm อยู่ ${fmtF(amt, 2)}mm — retract ฟันหน้าบนเข้าช่องถอนแบบ en-masse `
      + `เพื่อลด overjet ลง ${fmtF(amt, 2)}mm (คุมไม่ให้ฟันกรามเลื่อนมาหน้าเกินตาม anchorage)`);
  }
  steps.push(`คุมด้วย Anchorage (หัวข้อ 7): บน ${anchorageUpper.category}, `
    + `ล่าง ${anchorageLower.category} — เสริม TAD/TPA หากต้องการ anchorage สูง`);
  steps.push('เข้าเป้าพร้อมกัน 3 ค่า: Overjet 2mm + Interincisal 125–131° + L1–APog 1–3mm (ไม่ยึด overjet อย่างเดียว)');

  let warn = null;
  if (Math.abs(gap) > 4) {
    warn = `A-P ที่ต้องแก้สูงถึง ${fmtF(Math.abs(gap), 2)}mm จาก torque target ที่มาก (FACC ${pyFloatStr(faccToFh)}°→0°) — `
      + 'กู้ด้วย retraction ล้วน ๆ เสี่ยง over-retraction: พิจารณาลด torque target ฟันหน้าบน หรือกระจายการแก้ '
      + 'ด้วย skeletal correction (orthognathic/growth modification) ร่วม แล้วให้ทันตแพทย์ยืนยันแผน';
  }
  return { steps, warn };
}

/* ------------------------------------------------------------------ *
 * 11) Canine / Molar
 * ------------------------------------------------------------------ */
function relSigned(clsCode, mm) {
  if (clsCode === null || clsCode === undefined) return null;
  const c = parseInt(clsCode, 10);
  if (Number.isNaN(c)) return null;
  if (c === 1) return 0.0;
  if (mm === null || mm === undefined) return null;
  return pyRound(Number(mm) * (c === 2 ? 1.0 : -1.0), 2);
}

function molarShort(clsCode, mm) {
  if (clsCode === null || clsCode === undefined) return '-';
  const c = parseInt(clsCode, 10);
  if (Number.isNaN(c)) return '-';
  if (c === 1) return 'I';
  const roman = c === 2 ? 'II' : 'III';
  return (mm !== null && mm !== undefined) ? `${roman} ${fmtG(mm)}` : `${roman} (?)`;
}

function molarLabel(v) {
  if (v === null || v === undefined) return 'ไม่มีข้อมูล';
  const a = Math.abs(v);
  if (a <= 1.0) return 'Class I';
  const kind = v > 0 ? 'Class II' : 'Class III';
  const unit = a >= 3.0 ? 'full unit' : (a >= 1.5 ? 'half unit' : 'เกือบ Class I');
  return `${kind} (${unit}, ${fmtF(a, 1)} mm)`;
}

function canineRequirement(rel) {
  const out = {
    available: false, incomplete: [], detail: [],
    upper_right: 0.0, upper_left: 0.0, lower_right: 0.0, lower_left: 0.0,
    signed_right: null, signed_left: null,
    label_right: '-', label_left: '-', short_right: '-', short_left: '-',
  };
  if (!rel) return out;
  const defs = [
    ['right', rel.rt_class, rel.rt_mm, 'upper_right', 'lower_right', 'ขวา'],
    ['left', rel.lt_class, rel.lt_mm, 'upper_left', 'lower_left', 'ซ้าย'],
  ];
  for (const [side, clsCode, mm, upKey, loKey, th] of defs) {
    if (clsCode === null || clsCode === undefined) continue;
    out.available = true;
    const v = relSigned(clsCode, mm);
    out['signed_' + side] = v;
    out['label_' + side] = (v === null) ? `Class ${clsCode} (ยังไม่กรอก mm)` : molarLabel(v);
    out['short_' + side] = molarShort(clsCode, mm);
    if (v === null) {
      out.incomplete.push(th);
      out.detail.push(`ข้าง${th}: Canine Class ${clsCode} แต่ไม่ได้กรอก Differences (mm) — ต้องยืนยันระยะก่อน`);
      continue;
    }
    if (v > 0) {
      out[upKey] = v;
      out.detail.push(`ข้าง${th}: Canine Class II ${fmtG(v)} mm -> ฟันบนข้างนี้ต้องถอยหลัง ${fmtG(v)} mm`);
    } else if (v < 0) {
      out[loKey] = pyRound(-v, 2);
      out.detail.push(`ข้าง${th}: Canine Class III ${fmtG(-v)} mm -> ฟันล่างข้างนี้ต้องถอยหลัง ${fmtG(-v)} mm`);
    } else {
      out.detail.push(`ข้าง${th}: Canine Class I อยู่แล้ว -> ไม่ต้องแก้เพิ่ม`);
    }
  }
  return out;
}

function predictMolarFinish(rel, budgetUpper, budgetLower) {
  const out = { available: false, sides: [], note: null };
  if (!rel || ((rel.rt_class === null || rel.rt_class === undefined)
    && (rel.lt_class === null || rel.lt_class === undefined))) return out;

  const bu = {}, bl = {};
  for (const s of (budgetUpper.sides || [])) bu[s.quad] = s.molar_burn || 0.0;
  for (const s of (budgetLower.sides || [])) bl[s.quad] = s.molar_burn || 0.0;

  const defs = [
    ['ขวา', rel.rt_class, rel.rt_mm, 'Q1', 'Q4'],
    ['ซ้าย', rel.lt_class, rel.lt_mm, 'Q2', 'Q3'],
  ];
  for (const [th, clsCode, mm, uq, lq] of defs) {
    if (clsCode === null || clsCode === undefined) continue;
    const start = relSigned(clsCode, mm);
    if (start === null) {
      out.sides.push({
        side_th: th, start: null, start_label: `Class ${clsCode} (ไม่มี mm)`,
        short: molarShort(clsCode, mm),
        burn_upper: bu[uq] || 0.0, burn_lower: bl[lq] || 0.0,
        final: null, final_label: 'ยืนยันระยะก่อน',
      });
      continue;
    }
    out.available = true;
    const burnU = pyRound(bu[uq] || 0.0, 2);
    const burnL = pyRound(bl[lq] || 0.0, 2);
    const final = pyRound(start + burnU - burnL, 2);
    out.sides.push({
      side_th: th, start, start_label: molarLabel(start),
      short: molarShort(clsCode, mm),
      burn_upper: burnU, burn_lower: burnL,
      final, final_label: molarLabel(final),
    });
  }
  if (out.available) {
    out.note = 'molar เป็นผลลัพธ์ของแบบถอน + anchorage (canine Class I คือเป้าหมาย) — '
      + 'ฟันกรามบนเลื่อนหน้า = burn บน · ฟันกรามล่างเลื่อนหน้า = burn ล่าง';
  }
  return out;
}

export {
  pyRound, nz, fmtG, fmtF, fmtFSigned, fmtGSigned, pyFloatStr, pyMax,
  ASSUMPTIONS, MCNAMARA_TABLE, MCNAMARA_NORMS,
  quad, sideRel, makeCase,
  upperTorqueCorrection, estimateInterincisalCurrent, lowerTorqueCorrection,
  midlineCorrectionSpace, resolveCos, totalSpaceRequired, expansionSpaceGain,
  spaceManagementDecision, asymmetricAnchorageNote,
  interp, distToRange, mcnamaraReferenceAnalysis,
  autoDiagnosis, elineAdvice, growthApplianceAdvice, overjetTargetPlan,
  relSigned, molarShort, molarLabel, canineRequirement, predictMolarFinish,
};
