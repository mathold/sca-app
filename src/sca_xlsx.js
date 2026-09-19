/*
 * sca_xlsx.js — อ่านค่าจากไฟล์ SCA Table (.xlsx) ในเบราว์เซอร์
 *
 * แผนที่เซลล์ตรวจสอบแล้วกับไฟล์จริง 6 เคส (18 ก.ย. 2569): ตำแหน่งตรงกัน 194/244 ช่อง
 * และค่าที่อ่านได้ตรงกับไฟล์ JSON ที่ใช้งานจริงทุกค่า (เคส DN 11690)
 *
 * ต้องมี SheetJS (XLSX) โหลดไว้ก่อน — อ่านในเครื่องล้วน ไฟล์ไม่ถูกส่งออกที่ไหน
 */

// ช่องที่เก็บค่าเป็น "ส่วนต่างจาก 90°" ไม่ใช่องศาจริง
//   K37 = IMPA · U18 = BaN to PTM/Gn (McNamara facial axis)
// ortho_calc รับ l1_to_mpl_box เป็นค่าดิบจากช่องอยู่แล้ว จึงไม่ต้องบวก 90
const DEVIATION_CELLS = { K37: 'IMPA', U18: 'BaN to PTM/Gn' };

const CELL_MAP = {
  // --- ระบุตัวคนไข้ ---
  _name_a: 'E5', _name_b: 'N5', age: 'Q5', date: 'U5',

  // --- Steiner / Downs (คอลัมน์ K = ค่าที่วัดได้) ---
  sna: 'K11', snb: 'K12', anb: 'K13', sn_gogn: 'K16',
  fh_to_fop: 'K18', sn_to_ppl: 'K19', y_axis: 'K24', wits: 'K25',
  u1_to_na: 'K27', u1_sn: 'K30', u1_pp: 'K31',
  facc_to_fh: 'K32',
  l1_to_mpl_box: 'K37',          // ส่วนต่างจาก 90° — กรอกดิบ
  interincisal_current: 'K39',

  // --- McNamara (คอลัมน์ U) ---
  a_to_n: 'U10', pg_to_n: 'U11',
  co_a: 'U13', co_gn: 'U14', ans_me: 'U15',
  fma: 'U17',                     // FH to MP (Go-Me) — ใช้ค่านี้เป็น FMA เสมอ
  _fma_fallback: 'K21',           // FH to MP (Border) ถ้า U17 ว่าง
  l1_apog_current: 'U20',         // I/L to Apg — ใช้ค่านี้เสมอ ไม่ใช้ L1-NB
  _eline_pair: 'U28',             // รูปแบบ "-0.94 / -0.92" (บน / ล่าง)

  // --- Space condition (แถว 53-63) ---
  sd_q1: 'F53', sd_q2: 'H53', sd_q3: 'J53', sd_q4: 'L53',
  molar_rt_class: 'F54', molar_lt_class: 'H54',
  molar_rt_mm: 'F55', molar_lt_mm: 'H55',
  canine_rt_class: 'F56', canine_lt_class: 'H56',
  canine_rt_mm: 'F57', canine_lt_mm: 'H57',
  cos_q3: 'J59', cos_q4: 'L59',
  exp_q1: 'F60', exp_q2: 'H60', exp_q3: 'J60', exp_q4: 'L60',
  mid_q1: 'F62', mid_q2: 'H62', mid_q3: 'J62', mid_q4: 'L62',
  overjet_current: 'E63', overbite_current: 'K63',
};

function cellVal(ws, addr) {
  const c = ws[addr];
  if (!c) return null;
  const v = (c.v !== undefined) ? c.v : null;
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

function num(ws, addr) {
  const v = cellVal(ws, addr);
  if (v === null) return null;
  if (typeof v === 'number') return v;
  // ค่าอาจมาเป็นข้อความ เช่น "21.09" หรือ "5 mm" หรือ "(-4)"
  const m = String(v).replace(/[()]/g, '-').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function intVal(ws, addr) {
  const n = num(ws, addr);
  if (n === null) return null;
  const i = Math.round(n);
  return (i >= 1 && i <= 3) ? i : null;   // รหัส class ต้องเป็น 1/2/3 เท่านั้น
}

function text(ws, addr) {
  const v = cellVal(ws, addr);
  return v === null ? null : String(v).trim();
}

// E5/N5 สลับกันได้ — ช่องที่เป็นตัวเลขล้วนคือ HN
function readIdentity(ws) {
  const a = text(ws, CELL_MAP._name_a);
  const b = text(ws, CELL_MAP._name_b);
  const isHn = (s) => s !== null && /^\d+$/.test(s.replace(/\s/g, ''));
  if (isHn(a) && !isHn(b)) return { dn: a, patient_name: b || '' };
  if (isHn(b) && !isHn(a)) return { dn: b, patient_name: a || '' };
  return { dn: b || '', patient_name: a || '' };   // สเปกเดิม: E5=ชื่อ N5=DN
}

function readAge(ws) {
  const raw = text(ws, CELL_MAP.age);
  if (!raw) return null;
  // "26 ปี 8 เดือน" -> "26Y 8M"
  const m = raw.match(/(\d+)\s*ปี(?:\s*(\d+)\s*เดือน)?/);
  if (m) return m[2] ? `${m[1]}Y ${m[2]}M` : `${m[1]}Y`;
  return raw;
}

function readDate(ws) {
  const v = cellVal(ws, CELL_MAP.date);
  if (v === null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : s;
}

function readEline(ws) {
  const raw = text(ws, CELL_MAP._eline_pair);
  if (!raw) return [null, null];
  const parts = raw.split('/').map(p => {
    const m = p.replace(/[()]/g, '-').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  });
  return [parts[0] ?? null, parts[1] ?? null];
}

// แนะนำ growth pattern จาก FMA (หมอแก้ทับได้เสมอ)
// อิงจากเคสจริง 62 เคส: FMA < 22 = low · 22-27 = average · > 27 = high
function suggestGrowthPattern(fma, snGoGn) {
  if (fma === null || fma === undefined) return 'average';
  if (fma < 22 && !(snGoGn !== null && snGoGn >= 32)) return 'low_angle';
  if (fma > 27) return 'high_angle';
  return 'average';
}

/**
 * อ่านสมุดงาน SheetJS -> โครงสร้าง input ของ ortho_calc
 * @param {object} workbook  ผลจาก XLSX.read()
 * @returns {{input: object, warnings: string[], sheet: string}}
 */
function readScaWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const warnings = [];

  const ident = readIdentity(ws);
  if (!ident.patient_name) warnings.push('อ่านชื่อคนไข้จากช่อง E5/N5 ไม่ได้ — กรุณากรอกเอง');
  if (!ident.dn) warnings.push('อ่าน DN จากช่อง E5/N5 ไม่ได้ — กรุณากรอกเอง');

  let fma = num(ws, CELL_MAP.fma);
  if (fma === null) {
    fma = num(ws, CELL_MAP._fma_fallback);
    if (fma !== null) warnings.push('ช่อง McNamara "FH to MP (Go-Me)" (U17) ว่าง — ใช้ค่าจาก Steiner "FH to MP (Border)" (K21) แทน');
  }

  const [elineUp, elineLow] = readEline(ws);

  const sd = {
    q1: num(ws, CELL_MAP.sd_q1), q2: num(ws, CELL_MAP.sd_q2),
    q3: num(ws, CELL_MAP.sd_q3), q4: num(ws, CELL_MAP.sd_q4),
  };
  // TSD ต่อ arch = ผลรวมของสองควอดรันต์ (+ = ห่าง · − = เก) ตามที่ฟอร์มบันทึก
  const sumOr = (a, b) => {
    const vals = [a, b].filter(v => v !== null);
    return vals.length ? vals.reduce((x, y) => x + y, 0) : 0.0;
  };

  const facc = num(ws, CELL_MAP.facc_to_fh);
  if (facc === null) warnings.push('ช่อง FACC to FH (K32) ว่าง — ค่านี้ไวต่อผลมาก ต้องกรอกก่อนคำนวณ');

  const impaBox = num(ws, CELL_MAP.l1_to_mpl_box);
  const fmia = num(ws, 'K38');
  if (impaBox !== null && fma !== null && fmia !== null) {
    const impaCheck = 180 - fma - fmia;          // IMPA จริง
    if (Math.abs((impaBox + 90) - impaCheck) > 0.5) {
      warnings.push(`IMPA ในช่อง K37 (${impaBox} → ${(impaBox + 90).toFixed(2)}°) ไม่ตรงกับที่คำนวณจาก FMA+FMIA (${impaCheck.toFixed(2)}°) — ตรวจฟอร์มก่อนใช้`);
    }
  }

  const input = {
    patient_name: ident.patient_name,
    dn: ident.dn,
    age: readAge(ws),
    date: readDate(ws),

    sna: num(ws, CELL_MAP.sna),
    snb: num(ws, CELL_MAP.snb),
    anb: num(ws, CELL_MAP.anb),
    sn_gogn: num(ws, CELL_MAP.sn_gogn),
    fma,
    wits: num(ws, CELL_MAP.wits),
    fh_to_fop: num(ws, CELL_MAP.fh_to_fop),
    sn_to_ppl: num(ws, CELL_MAP.sn_to_ppl),
    y_axis: num(ws, CELL_MAP.y_axis),
    u1_to_na: num(ws, CELL_MAP.u1_to_na),
    u1_sn: num(ws, CELL_MAP.u1_sn),
    u1_pp: num(ws, CELL_MAP.u1_pp),

    facc_to_fh: facc === null ? 0.0 : facc,
    l1_to_mpl_box: impaBox === null ? 0.0 : impaBox,
    interincisal_current: num(ws, CELL_MAP.interincisal_current),
    l1_apog_current: num(ws, CELL_MAP.l1_apog_current) ?? 0.0,

    a_to_n: num(ws, CELL_MAP.a_to_n),
    pg_to_n: num(ws, CELL_MAP.pg_to_n),
    co_a: num(ws, CELL_MAP.co_a),
    co_gn: num(ws, CELL_MAP.co_gn),
    ans_me: num(ws, CELL_MAP.ans_me),

    eline_upper_lip: elineUp,
    eline_lower_lip: elineLow,

    overjet_current: num(ws, CELL_MAP.overjet_current) ?? 0.0,
    overbite_current: num(ws, CELL_MAP.overbite_current) ?? 0.0,

    space_discrepancy: sd,
    tooth_size_discrepancy_upper: sumOr(sd.q1, sd.q2),
    tooth_size_discrepancy_lower: sumOr(sd.q3, sd.q4),

    cos_mm: 0.0,
    cos_q3: num(ws, CELL_MAP.cos_q3),
    cos_q4: num(ws, CELL_MAP.cos_q4),

    midline: {
      q1: num(ws, CELL_MAP.mid_q1), q2: num(ws, CELL_MAP.mid_q2),
      q3: num(ws, CELL_MAP.mid_q3), q4: num(ws, CELL_MAP.mid_q4),
    },
    arch_expansion: {
      q1: num(ws, CELL_MAP.exp_q1), q2: num(ws, CELL_MAP.exp_q2),
      q3: num(ws, CELL_MAP.exp_q3), q4: num(ws, CELL_MAP.exp_q4),
    },

    molar_relationship: {
      rt_class: intVal(ws, CELL_MAP.molar_rt_class),
      lt_class: intVal(ws, CELL_MAP.molar_lt_class),
      rt_mm: num(ws, CELL_MAP.molar_rt_mm),
      lt_mm: num(ws, CELL_MAP.molar_lt_mm),
    },
    canine_relationship: {
      rt_class: intVal(ws, CELL_MAP.canine_rt_class),
      lt_class: intVal(ws, CELL_MAP.canine_lt_class),
      rt_mm: num(ws, CELL_MAP.canine_rt_mm),
      lt_mm: num(ws, CELL_MAP.canine_lt_mm),
    },
    molar_target: 'follow',
    missing_teeth: [],
    premolars_extracted_upper: 0,
    premolars_extracted_lower: 0,
    arch_width_data_available: false,
    growth_pattern: suggestGrowthPattern(fma, num(ws, CELL_MAP.sn_gogn)),
    treatment_mode: 'auto',
    upper_torque_type: 'crown',
  };

  // รหัส class 2/3 แต่ไม่กรอก mm = รู้ว่าผิดปกติแต่ไม่รู้กี่ mm -> ห้ามเดา
  for (const [label, rel] of [['Canine', input.canine_relationship], ['Molar', input.molar_relationship]]) {
    for (const [side, cls, mm] of [['ขวา (RT)', rel.rt_class, rel.rt_mm], ['ซ้าย (LT)', rel.lt_class, rel.lt_mm]]) {
      if (cls !== null && cls !== 1 && (mm === null || mm === undefined)) {
        warnings.push(`${label} ${side} เป็น Class ${cls} แต่ช่อง Differences (mm) ว่าง — ต้องกรอกระยะก่อน ระบบจะยังไม่นำมาคิดพื้นที่`);
      }
    }
  }

  return { input, warnings, sheet: sheetName };
}

export { readScaWorkbook, CELL_MAP, DEVIATION_CELLS, suggestGrowthPattern };
