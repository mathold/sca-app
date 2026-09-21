/* plan_sheets.js — ตารางดุลพื้นที่รายควอดรันต์ (แบบเดียวกับ "ตารางสีแดง" ในฟอร์ม SCA)
 *
 * พอร์ตมาจาก fill_sca_plan.py ให้ได้ตัวเลขชุดเดียวกับที่กรอกลงฟอร์มจริง
 * ใช้ "สัมประสิทธิ์ของฟอร์ม" (อ่านจากสูตรในไฟล์ SCA จริง) ไม่ใช่ของ ortho_calc
 * เพื่อให้ทุกควอดรันต์ดุลกันเป๊ะเหมือนในชีต:
 *   torque:  บน (deg*0.32)/2   ล่าง (deg*0.24)/2
 *   bodily:  ดึงฟันบน mm*0.941 (ฟอร์มไม่หาร 2) · ที่เหลือ (mm*0.941)/2
 *
 * 3 แผน (ตัดสินใจคุณหมอ 21 ก.ย. 2569):
 *   1 auto           — แผนที่ระบบแนะนำ
 *   2 ext_lower      — ถอนฟันล่าง 2 ซี่ ช่องที่เหลือกลายเป็น molar burn
 *   3 molar_class_i  — บังคับ molar จบ Class I (ค่าอุดมคติ ไว้ประกอบการตัดสินใจ)
 */
const C_TQ_UP = 0.32, C_TQ_LO = 0.24, C_BODILY = 0.941;
const IPR_MAX = 6.0, AVG_PREMOLAR = 7.0;
const r2 = (x) => Math.round(x * 100) / 100;

function molarStartByQuad(result) {
  const mf = result.molar_finish || {};
  const out = {};
  if (!mf.available) return out;
  for (const s of mf.sides || []) {
    const start = Number(s.start || 0);
    if (s.side_th === 'ขวา') { out.Q1 = start; out.Q4 = start; }
    else { out.Q2 = start; out.Q3 = start; }
  }
  return out;
}

function buildOne(result, variant) {
  const w = result.working;
  const molarStart = variant === 'molar_class_i' ? molarStartByQuad(result) : {};
  const lowerBurn = {};
  const quads = [];
  const order = variant === 'molar_class_i' ? ['lower', 'upper'] : ['upper', 'lower'];

  for (const arch of order) {
    const b = result.space_budget[arch];
    const up = arch === 'upper';
    const tqDeg = up ? w.delta_u1 : w.delta_l1;
    const bodily = up ? w.retract_upper : w.retract_lower;
    const tqSpace = Math.abs(tqDeg) * (up ? C_TQ_UP : C_TQ_LO) / 2;
    const bodilySpace = up ? Math.abs(bodily) * C_BODILY : Math.abs(bodily) * C_BODILY / 2;
    const expSide = (b.expansion_gain || 0) / 2;
    const cosSide = (b.cos || 0) / 2;
    let iprLeft = IPR_MAX;

    for (const s of b.sides) {
      const plus = [], minus = [];
      const add = (arr, label, mm) => { if (mm > 0.005) arr.push({ label, mm: r2(mm) }); };

      add(minus, 'เก (crowding)', s.crowding);
      add(minus, 'midline', s.midline);
      if (!up) add(minus, 'COS ÷ 2', cosSide);
      if (tqDeg > 0) add(minus, 'มุมฟัน ' + r2(Math.abs(tqDeg)) + '°', tqSpace);
      else add(plus, 'มุมฟัน ' + r2(Math.abs(tqDeg)) + '° (procline)', tqSpace);
      if (bodily > 0) add(minus, 'ดึงฟันหน้า ' + r2(Math.abs(bodily)) + ' mm', bodilySpace);
      else add(plus, 'ยื่นฟันหน้า ' + r2(Math.abs(bodily)) + ' mm', bodilySpace);
      add(plus, 'ช่องว่างเดิม', s.spacing);
      add(plus, 'ขยาย arch', expSide);

      const forceExt = (variant !== 'auto') && !up && s.can_extract;
      let supply = (s.spacing || 0) + expSide + (tqDeg < 0 ? tqSpace : 0)
                 + (bodily < 0 ? bodilySpace : 0);
      const demand = (s.crowding || 0) + (s.midline || 0) + (up ? 0 : cosSide)
                   + (tqDeg > 0 ? tqSpace : 0) + (bodily > 0 ? bodilySpace : 0);
      if (s.extract_here || forceExt) {
        const ext = b.per_side_ext || AVG_PREMOLAR;
        add(plus, 'ถอนฟัน 1 ซี่', ext);
        supply += ext;
      }

      let gap = r2(demand - supply), burn = 0;
      if (variant === 'molar_class_i' && up && molarStart[s.quad] !== undefined) {
        const needUp = r2((lowerBurn[s.quad] || 0) - molarStart[s.quad]);
        if (needUp > 0.01) { burn = needUp; add(minus, 'molar บนเลื่อนมาหน้า', burn); gap = r2(gap + burn); }
        else if (needUp < -0.01) { add(plus, 'distalize molar บน', -needUp); gap = r2(gap + needUp); }
        if (gap > 0.01) { const ipr = r2(Math.min(gap, iprLeft)); add(plus, 'IPR', ipr); iprLeft = r2(iprLeft - ipr); }
      } else if (gap > 0.01) {
        const ipr = r2(Math.min(gap, iprLeft));
        add(plus, 'IPR', ipr); iprLeft = r2(iprLeft - ipr);
        const rest = r2(gap - ipr);
        if (rest > 0.01) add(plus, 'distalize molar', rest);
      } else if (gap < -0.01) {
        burn = r2(-gap);
        add(minus, 'molar เลื่อนมาปิดช่อง', burn);
      }
      if (!up) lowerBurn[s.quad === 'Q3' ? 'Q2' : 'Q1'] = burn;

      const sum = (a) => r2(a.reduce((t, x) => t + x.mm, 0));
      quads.push({ arch, quad: s.quad, side: s.side, plus, minus, burn,
                   totalPlus: sum(plus), totalMinus: sum(minus) });
    }
  }
  const ORD = ['Q1', 'Q2', 'Q3', 'Q4'];
  quads.sort((a, b2) => ORD.indexOf(a.quad) - ORD.indexOf(b2.quad));
  return quads;
}

export function buildPlanSheets(result) {
  const bl = result.space_budget.lower;
  const lowerCanExt = (bl.sides || []).some((s) => s.can_extract);
  const plans = [{
    key: 'auto', title: 'แผน 1 — แผนที่ระบบแนะนำ',
    note: result.space_budget.upper.plan_label + ' / ' + bl.plan_label,
  }];
  if (!bl.is_ext_plan && lowerCanExt) {
    plans.push({ key: 'ext_lower', title: 'แผน 2 — ถอนฟันล่าง 2 ซี่',
                 note: 'ช่องที่เหลือกลายเป็น molar burn — ใช้ดึง molar มาหน้าแก้ Class II' });
  }
  if ((result.molar_finish || {}).available) {
    plans.push({ key: 'molar_class_i', title: 'แผน 3 — molar จบ Class I (ค่าอุดมคติ)',
                 note: 'คุมให้ burn ล่าง − burn บน = ระยะ Class II เริ่มต้น · '
                     + 'ในทางปฏิบัติอาจทำไม่ได้ทุกเคส — ไว้ประกอบการตัดสินใจ' });
  }
  return plans.map((p, i) => ({ ...p, no: i + 1, quads: buildOne(result, p.key) }));
}
