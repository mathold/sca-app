/* report.js — สร้าง HTML รายงานจากผลของ analyzeCase() */

// เวอร์ชันของตรรกะการคำนวณ — ขึ้นทั้งบนหน้าจอและในรายงานที่พิมพ์ออกมา
// เพื่อให้ตรวจได้ทันทีว่าใครถือเวอร์ชันไหนอยู่
// เลื่อนเลขอัตโนมัติด้วย tools/bump.py (มี pre-commit hook เรียกให้เอง) — ไม่ต้องแก้มือ
const APP_VERSION = '1.0.45';
const APP_UPDATED = '21 ก.ย. 2569';
const APP_OWNER = 'หมอผิ่น';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n2 = (v) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : (Math.round(v * 100) / 100).toFixed(2);
const n1 = (v) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : (Math.round(v * 10) / 10).toFixed(1);
const raw = (v) => (v === null || v === undefined || v === '') ? '—' : esc(v);

const PLAN_TH = {
  'Extraction': 'ถอนฟัน',
  'IPR': 'IPR',
  'Non-Extraction': 'ไม่ถอนฟัน',
};
import { buildPlanSheets } from './plan_sheets.js';

const planClass = (d) => d === 'Extraction' ? 'plan-ext' : (d === 'IPR' ? 'plan-ipr' : 'plan-non');

function kv(rows) {
  return `<table class="kv">${rows.filter(Boolean).map(([k, v, cls, strong]) =>
    `<tr${strong ? ' class="strong"' : ''}><th>${esc(k)}</th><td${cls ? ` class="${cls}"` : ''}>${v}</td></tr>`).join('')}</table>`;
}

// ตารางแบบมีหัวคอลัมน์ (อ่านง่ายกว่า kv ที่เป็นแถว label/value เปล่า ๆ)
function gridKv(caption, head, rows) {
  return `<table class="grid">
    <caption>${esc(caption)}</caption>
    <thead><tr>${head.map((h, i) => `<th${i ? '' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.filter(Boolean).map(cells =>
      `<tr>${cells.map((c, i) => i === 0 ? `<th>${esc(String(c))}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

// ควอดรันต์ที่จะถอน — ข้างที่พรีโมลาร์ยังอยู่เท่านั้น (ข้างที่หายแล้วมีช่องอยู่แล้ว)
function extQuadrants(b, arch) {
  const q = arch === 'upper'
    ? { right: 'Q1 (บนขวา)', left: 'Q2 (บนซ้าย)' }
    : { right: 'Q4 (ล่างขวา)', left: 'Q3 (ล่างซ้าย)' };
  const out = [];
  if (b.ext_right_available) out.push(q.right);
  if (b.ext_left_available) out.push(q.left);
  return out;
}

// สรุปว่าแต่ละขากรรไกรวางแผนยังไง: ถอนกี่ซี่ ควอดรันต์ไหน เสริมด้วย IPR/distalize เท่าไร
function planSummaryRow(b, plan, arch, label) {
  const ext = b.is_ext_plan ? b.ext_teeth_planned : 0;
  const quads = ext > 0 ? extQuadrants(b, arch).slice(0, ext) : [];
  // plan_sources = [[ชื่อวิธี, mm], ...] — ตัดบรรทัดถอนฟันออก เหลือเฉพาะวิธีเสริม
  const extra = (b.plan_sources || [])
    .filter(([name]) => !/ถอนฟัน/.test(name))
    .map(([name, mm]) => `${esc(name.replace(/\s*\(.*?\)\s*/g, ''))} ${n1(mm)} mm`);
  const short = b.deficit > 0.01;
  return [
    label,
    `<b class="${planClass(plan.decision)}">${esc(PLAN_TH[plan.decision] || plan.decision)}</b>`,
    ext > 0 ? `<b>${ext} ซี่</b>` : '<span class="muted">ไม่ถอน</span>',
    quads.length ? esc(quads.join(' · ')) : '<span class="muted">—</span>',
    extra.length ? extra.join(' · ') : '<span class="muted">—</span>',
    short ? `<b class="hot">ยังขาด ${n2(b.deficit)} mm</b>` : `<span class="ok">พอดี (เหลือ ${n2(b.leftover)} mm)</span>`,
  ];
}

function archBudget(b, plan, label) {
  const opts = b.options.map(o =>
    `<tr class="${o.recommended ? 'rec' : ''}"><td>${esc(o.label)}</td><td class="num">+${n1(o.add)}</td><td class="num">${o.leftover >= 0 ? '+' : ''}${n2(o.leftover)}</td><td>${o.recommended ? 'แนะนำ' : ''}</td></tr>`).join('');
  const sides = b.sides.map(s =>
    `<tr><td>${esc(s.side)}</td><td class="num">${n2(s.crowding)}</td><td class="num">${n2(s.midline)}</td><td class="num">${n2(s.retract)}</td><td class="num">${n2(s.demand)}</td><td class="num">${n2(s.supply)}</td><td class="num">${n2(s.molar_burn)}</td><td>${s.burn_ratio === null ? '—' : Math.round(s.burn_ratio * 100) + '%'}</td><td>${esc(s.anchorage)}</td></tr>`).join('');

  return `
  <section class="arch">
    <h3>${esc(label)} <span class="badge ${planClass(plan.decision)}">${esc(PLAN_TH[plan.decision] || plan.decision)}</span></h3>
    ${kv([
      ['เก (crowding)', n2(b.crowding) + ' mm'],
      ['ช่องว่างเดิม', n2(b.spacing_extra) + ' mm'],
      ['COS ÷ 2', n2(b.cos) + ' mm'],
      ['มุมฟัน (torque)', (b.torque_space >= 0 ? '+' : '') + n2(b.torque_space) + ' mm'],
      ['Midline', n2(b.midline) + ' mm'],
      ['Retract (ขวา + ซ้าย)', `${n2(b.retraction_right)} + ${n2(b.retraction_left)} = ${n2(b.retraction_total)} mm`],
      ['รวมที่ต้องการ (Net Required)', n2(b.net_required) + ' mm', null, true],
      ['พื้นที่ที่มีอยู่แล้ว', n2(b.base_supply) + ' mm'],
      ['ยังขาด', n2(b.remaining) + ' mm', b.remaining > 6 ? 'hot' : null, true],
      ['Anchorage', esc(b.category)],
      ['อุปกรณ์ที่แนะนำ', esc(b.appliance_recommendation)],
    ])}
    <table class="grid">
      <caption>ทางเลือกหาพื้นที่</caption>
      <thead><tr><th>วิธี</th><th class="num">ได้ (mm)</th><th class="num">เหลือ (mm)</th><th></th></tr></thead>
      <tbody>${opts}</tbody>
    </table>
    <table class="grid">
      <caption>แยกซ้าย / ขวา</caption>
      <thead><tr><th>ข้าง</th><th class="num">เก</th><th class="num">midline</th><th class="num">retract</th><th class="num">ต้องใช้</th><th class="num">มีให้</th><th class="num">burn</th><th>ratio</th><th>Anchorage</th></tr></thead>
      <tbody>${sides}</tbody>
    </table>
    ${b.side_asymmetric ? `<p class="warn">burn สองข้างต่างกันเกิน 0.5 mm — พิจารณา Asymmetric Anchorage</p>` : ''}
    ${plan.asymmetric_note ? `<p class="warn">${esc(plan.asymmetric_note)}</p>` : ''}
    ${b.recommendations.map(r => `<p class="note">${esc(r)}</p>`).join('')}
    <p class="reason">${esc(b.reason)}</p>
  </section>`;
}

function planSheet(p) {
  const cell = (items) => items.length
    ? items.map(x => `${esc(x.label)} <b>${n2(x.mm)}</b>`).join('<br>')
    : '<span class="muted">—</span>';
  const rows = p.quads.map(q => `<tr>
      <th>${esc(q.side)}</th>
      <td>${cell(q.plus)}</td>
      <td class="num"><b>${n2(q.totalPlus)}</b></td>
      <td>${cell(q.minus)}</td>
      <td class="num"><b>${n2(q.totalMinus)}</b></td>
    </tr>`).join('');
  return `
  <section class="arch">
    <h3>${esc(p.title)}</h3>
    <p class="note">${esc(p.note)}</p>
    <table class="grid">
      <caption>ดุลพื้นที่รายควอดรันต์ — สองฝั่งต้องเท่ากัน (เหมือนตารางสีแดงในฟอร์ม SCA)</caption>
      <thead><tr><th>ควอดรันต์</th><th>หาพื้นที่ได้ (+)</th><th class="num">รวม</th>
        <th>ใช้พื้นที่ (−)</th><th class="num">รวม</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderReport(r, extraWarnings = []) {
  const w = r.working, e = r.endpoint, mcn = r.mcnamara;
  const modeTh = { class_i_ii: 'Class I / II (หรือ decompensation)', class_iii: 'Class III — camouflage', class_iii_facc: 'Class III + FACC (แผน C)' }[r.mode] || r.mode;

  // สรุปการถอน — ต้องบอกแยกบน/ล่าง ไม่ใช่ยอดรวมอย่างเดียว
  // (เคสฟันหายข้างเดียวจะถอนบน 1 ล่าง 2 — ยอดรวม "3 ซี่" เฉย ๆ ใช้วางแผนไม่ได้)
  const extUpper = r.space_budget.upper.is_ext_plan ? r.space_budget.upper.ext_teeth_planned : 0;
  const extLower = r.space_budget.lower.is_ext_plan ? r.space_budget.lower.ext_teeth_planned : 0;
  const extTotal = extUpper + extLower;
  const extParts = [];
  if (extUpper > 0) extParts.push(`บน ${extUpper} ซี่`);
  if (extLower > 0) extParts.push(`ล่าง ${extLower} ซี่`);
  const extText = extTotal > 0 ? `ถอน ${extParts.join(' · ')} (รวม ${extTotal} ซี่)` : 'ไม่ต้องถอนฟัน';

  const warnBlocks = [];
  if (extraWarnings.length) warnBlocks.push(`<div class="alert"><b>ตรวจก่อนใช้</b><ul>${extraWarnings.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`);
  if (r.canine.incomplete && r.canine.incomplete.length) {
    warnBlocks.push(`<div class="alert">Canine ข้าง ${esc(r.canine.incomplete.join(' / '))} เป็น Class 2/3 แต่ไม่ได้กรอกระยะ (mm) — ยังไม่นำมาคิดพื้นที่ ต้องกรอกก่อน</div>`);
  }
  if (r.canine.canine_drives_by_mm > 0) {
    warnBlocks.push(`<div class="alert">ระยะแก้ canine มากกว่าระยะแก้ overjet ${n2(r.canine.canine_drives_by_mm)} mm → Overjet จะจบที่ ${n2(r.canine.overjet_if_canine_driven)} mm (${r.canine.overjet_if_canine_driven < 2 ? 'ต่ำกว่า' : 'สูงกว่า'}เป้า 2 mm) — ชดเชยด้วย torque/procline ฟันบน หรือ protract ฟันล่าง</div>`);
  }
  if (e.needs_surgery) warnBlocks.push(`<div class="alert">เฟสจัดฟันไปไม่ถึงเป้า — ต้องพิจารณาผ่าตัด / skeletal correction ร่วม</div>`);
  if (r.class_iii && r.class_iii.floor_extended_used) {
    warnBlocks.push(`<div class="alert">IMPA floor 85° ปิด Overjet ไม่พอ ระบบหย่อนลงถึง ${n1(r.class_iii.impa_floor)}° — ยืนยัน bony envelope ด้วย CBCT</div>`);
  }
  if (r.root_torque_upper) warnBlocks.push(`<div class="alert">ฟันบนใช้ buccal root torque — ยืนยัน bony envelope ด้วย CBCT</div>`);

  // ฟันที่หายไป: ตาราง SCA ไม่มีช่องนี้ (sca_xlsx.js ตั้ง missing_teeth = [] เสมอ)
  // ต้องกรอกเองในฟอร์ม — ถ้าลืม ระบบจะคิดว่าฟันครบแล้ววางแผนถอนเป็นคู่ (2 ซี่/arch)
  // ซึ่งผิดสำหรับเคสที่มีพรีโมลาร์หายไปแล้ว จึงต้องเตือนทุกครั้งที่ช่องนี้ว่าง
  const missingList = (r.dentition && r.dentition.missing) || [];
  if (missingList.length) {
    warnBlocks.push(`<div class="alert">ฟันที่หายไปแล้ว: <b>${esc(missingList.join(', '))}</b> — ข้างที่พรีโมลาร์หาย (ตำแหน่ง 4/5) มีช่องอยู่แล้ว ระบบจึงไม่ถอนซ้ำข้างนั้น</div>`);
  } else {
    warnBlocks.push(`<div class="alert">ยังไม่ได้ระบุ <b>ฟันที่หายไปแล้ว</b> — ตาราง SCA ไม่มีข้อมูลนี้ ต้องกรอกเองในฟอร์ม · ถ้ามีพรีโมลาร์ (ตำแหน่ง 4/5) หายไปแล้ว <b>จำนวนซี่ที่ต้องถอนจะเปลี่ยน</b> (ข้างนั้นมีช่องอยู่แล้ว ไม่ถอนซ้ำ)</div>`);
  }

  const forsusBlock = r.forsus.needed
    ? `<div class="alert red"><b>เข้าเงื่อนไข Forsus</b> — ${esc(r.forsus.subtype_label)}<br>${esc(r.forsus.note)}</div>`
    : `<p class="note">Forsus: ${esc(r.forsus.subtype_label)} — ${esc(r.forsus.note)}</p>`;

  return `
  <article class="report">
    <header class="rep-head">
      <div>
        <h1>${raw(r.patient.name)} <span class="dn">DN ${raw(r.patient.dn)}</span></h1>
        <p class="sub">อายุ ${raw(r.patient.age)} · วันที่ ${raw(r.patient.date)} · โหมด ${esc(modeTh)}</p>
      </div>
      <div class="verdict">
        <div class="v-line"><span>ฟันบน</span><b class="${planClass(r.treatment_plan.upper.decision)}">${esc(PLAN_TH[r.treatment_plan.upper.decision])}</b></div>
        <div class="v-line"><span>ฟันล่าง</span><b class="${planClass(r.treatment_plan.lower.decision)}">${esc(PLAN_TH[r.treatment_plan.lower.decision])}</b></div>
        <div class="v-ext">${esc(extText)}</div>
      </div>
    </header>

    ${warnBlocks.join('')}

    <section>
      <h2>1 · ค่าที่ใช้</h2>
      <div class="cols">
        ${gridKv('โครงกระดูก', ['รายการ', 'ค่าที่วัดได้', 'ค่าปกติ'], [
          ['SNA / SNB / ANB', `${n1(r.input_summary.sna)} / ${n1(r.input_summary.snb)} / ${n1(r.input_summary.anb)}`, '82 / 80 / 2'],
          ['FMA', n1(r.input_summary.fma) + '°', '22–25°'],
          ['SN-GoGn', n1(r.input_summary.sn_gogn) + '°', '32°'],
          ['Wits', n1(r.input_summary.wits) + ' mm', '0 mm'],
          ['FACC to FH', n1(r.input_summary.facc_to_fh) + '°', '0°'],
          ['IMPA (ช่อง / จริง)', `${n1(r.input_summary.l1_to_mpl_box)} / ${n1(r.input_summary.l1_to_mpl_absolute)}°`, '~90°'],
        ])}
        ${gridKv('ฟันและเนื้อเยื่อ', ['รายการ', 'ค่าที่วัดได้', 'ค่าปกติ'], [
          ['1/1 ปัจจุบัน', n1(r.input_summary.interincisal_current) + '°' + (r.input_summary.interincisal_estimated ? ' (ประมาณ)' : ''), '125–131°'],
          ['L1-APog', n2(r.input_summary.l1_apog_current) + ' mm', '1–3 mm'],
          ['Overjet / Overbite', `${n1(r.input_summary.overjet_current)} / ${n1(r.input_summary.overbite_current)} mm`, '2 / 2 mm'],
          ['COS ที่ใช้', n2(r.input_summary.cos_mm) + ' mm', '0 mm'],
          ['TSD บน / ล่าง', `${n2(r.input_summary.tooth_size_discrepancy_upper)} / ${n2(r.input_summary.tooth_size_discrepancy_lower)} mm`, '0 mm'],
          ['E-line บน / ล่าง', `${n2(r.input_summary.eline_upper_lip)} / ${n2(r.input_summary.eline_lower_lip)} mm`, '−2 / 0 mm'],
        ])}
      </div>
      ${mcn.available ? `<div class="box"><b>Reference Jaw (McNamara)</b><br>${esc(mcn.note)}</div>`
        : `<p class="note">${esc(mcn.note)}</p>`}
    </section>

    <section>
      <h2>2 · ลำดับการคิด</h2>
      <ol class="steps">
        <li><b>ฟันบน — แก้ FACC ${n1(w.facc_current)}° → 0°</b><br>
          ΔU1 ${n1(w.delta_u1)}° · สเปซ ${w.space_upper_torque >= 0 ? '+' : ''}${n2(w.space_upper_torque)} mm · ΔOJ ${n2(w.delta_oj_upper)} mm
          ${r.root_torque_upper ? '<br><i>ใช้ buccal root torque — ไม่กินสเปซ ไม่เปลี่ยน OJ</i>' : ''}</li>
        <li><b>ฟันล่าง — 1/1 ${n1(w.ii_after_upper)}° → ${n1(w.ii_goal ?? w.ii_target)}°</b>
          ${w.ii_already_in_range ? '<span class="ok">อยู่ในช่วง 125–131° แล้ว ไม่ต้องขยับ</span>' : ''}<br>
          ΔL1 ${w.delta_l1 >= 0 ? '+' : ''}${n1(w.delta_l1)}° · สเปซ ${w.space_lower_torque >= 0 ? '+' : ''}${n2(w.space_lower_torque)} mm ·
          ΔOJ ${w.delta_oj_lower >= 0 ? '+' : ''}${n2(w.delta_oj_lower)} mm · ΔL1-APog ${n2(w.delta_l1apog_lower)} mm</li>
        <li><b>L1-APog</b> หลัง torque ${n2(w.l1apog_current)} mm —
          ${w.l1apog_in_range ? '<span class="ok">อยู่ในช่วง 1–3 mm แล้ว</span>' : `ต้องขยับ ${n2(w.l1apog_move)} mm เข้าหาขอบช่วง`}</li>
        <li><b>A-P — Overjet ${n2(w.oj_after_torque)} mm → เป้า 2 mm</b><br>
          retract รวม ${n2(w.retract_total)} mm (ฟันบน ${n2(w.retract_upper)} · ฟันล่าง ${n2(w.retract_lower)})</li>
      </ol>
    </section>

    <section>
      <h2>3 · งบพื้นที่และแผน</h2>
      ${gridKv('สรุปแผนแต่ละขากรรไกร', ['ขากรรไกร', 'แผน', 'ถอน', 'ตำแหน่งที่ถอน', 'วิธีเสริม', 'ผลงบพื้นที่'], [
        planSummaryRow(r.space_budget.upper, r.treatment_plan.upper, 'upper', 'ฟันบน'),
        planSummaryRow(r.space_budget.lower, r.treatment_plan.lower, 'lower', 'ฟันล่าง'),
      ])}
      ${archBudget(r.space_budget.upper, r.treatment_plan.upper, 'ฟันบน')}
      ${archBudget(r.space_budget.lower, r.treatment_plan.lower, 'ฟันล่าง')}
    </section>

    <section>
      <h2>4 · แผนทางเลือก — ตารางดุลพื้นที่</h2>
      <p class="note">ตัวเลขชุดเดียวกับที่กรอกลงฟอร์ม SCA จริง (ใช้สัมประสิทธิ์ของฟอร์ม)
        ทุกควอดรันต์สองฝั่งต้องเท่ากัน · <b>ส่งให้ดูครบทุกแผน ไม่เลือกให้</b></p>
      ${buildPlanSheets(r).map(planSheet).join('')}
    </section>

    <section>
      <h2>5 · Canine และ Molar</h2>
      ${r.canine.available ? kv([
        ['Canine ขวา / ซ้าย', `${esc(r.canine.label_right)} / ${esc(r.canine.label_left)}`],
        ['ระยะ retract ฟันบน ขวา / ซ้าย', `${n2(r.canine.upper_retract_right)} / ${n2(r.canine.upper_retract_left)} mm`],
        ['ระยะ retract ฟันล่าง ขวา / ซ้าย', `${n2(r.canine.lower_retract_right)} / ${n2(r.canine.lower_retract_left)} mm`],
        r.canine.skipped_reason ? ['หมายเหตุ', esc(r.canine.skipped_reason)] : null,
      ]) : '<p class="note">ไม่มีข้อมูล Canine relationship ในฟอร์ม</p>'}
      ${r.canine.detail && r.canine.detail.length ? `<ul class="plain">${r.canine.detail.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      ${r.molar_finish.available ? `<table class="grid">
        <caption>Molar หลังจบ (ผลลัพธ์ ไม่ใช่เป้าหมาย)</caption>
        <thead><tr><th>ข้าง</th><th>เริ่มต้น</th><th class="num">burn บน</th><th class="num">burn ล่าง</th><th>หลังจบ</th></tr></thead>
        <tbody>${r.molar_finish.sides.map(s => `<tr><td>${esc(s.side_th)}</td><td>${esc(s.start_label)}</td><td class="num">${n2(s.burn_upper)}</td><td class="num">${n2(s.burn_lower)}</td><td><b>${esc(s.final_label)}</b></td></tr>`).join('')}</tbody>
      </table>` : '<p class="note">ไม่มีข้อมูล Molar relationship ในฟอร์ม</p>'}
      ${r.molar_finish.note ? `<p class="note">${esc(r.molar_finish.note)}</p>` : ''}
    </section>

    <section>
      <h2>6 · เมื่อจบการรักษา</h2>
      ${gridKv('ค่าเมื่อจบการรักษา', ['รายการ', 'ค่าที่จะจบ', 'เป้าหมาย', 'ผล'], [
        ['FACC to FH', n1(e.facc) + '°' + (e.facc_kept ? ' (เก็บไว้ — camouflage)' : ''), '0°',
          Math.abs(e.facc) <= 0.5 ? '<span class="ok">ถึงเป้า</span>' : '<span class="hot">ยังห่างเป้า</span>'],
        ['Interincisal 1/1', n1(e.interincisal) + '°' + (e.interincisal_capped ? ' · ถูกจำกัดด้วย IMPA floor' : ''), '125–131°',
          e.interincisal_in_range ? '<span class="ok">อยู่ในช่วง</span>' : '<span class="hot">นอกช่วง</span>'],
        // overjet_ortho_phase = ค่าหลัง torque "ก่อน" retract A-P — ไม่ใช่ค่าเมื่อจบ
        // ระยะ retract ถูกคิดเป็นพื้นที่ในงบไว้แล้ว แผนจึงปิด OJ ลงมาที่ 2 mm ตามเป้า
        // (PDF ก็แสดง ep.overjet และโชว์ค่าเฟสจัดฟันเฉพาะตอนต้องผ่าตัด)
        ['Overjet', e.needs_surgery
            ? `<b class="hot">${n2(e.overjet_ortho_phase)} mm</b> <span class="muted">(จบเฟสจัดฟัน — ที่เหลือปิดด้วยผ่าตัด)</span>`
            : `${n1(e.overjet)} mm<br><span class="muted">หลัง torque ${n2(w.oj_after_torque)} mm → retract ${n2(w.retract_total)} mm (บน ${n2(w.retract_upper)} · ล่าง ${n2(w.retract_lower)})</span>`,
          '2 mm',
          e.needs_surgery ? '<span class="hot">ต้องผ่าตัดร่วม</span>'
            : (r.canine.canine_drives_by_mm > 0
                ? `<span class="hot">canine คุมแผน → จะจบที่ ${n2(r.canine.overjet_if_canine_driven)} mm</span>`
                : '<span class="ok">ถึงเป้า</span>')],
        ['L1-APog', n1(e.l1_apog) + ' mm' + (e.l1_apog_in_range ? '' : ` (ขยับ ${n2(e.l1_apog_move)} mm)`), '1–3 mm',
          e.l1_apog_in_range ? '<span class="ok">อยู่ในช่วง</span>' : '<span class="hot">นอกช่วง</span>'],
        ['ต้องผ่าตัดไหม', e.needs_surgery ? '<b class="hot">ต้องพิจารณาผ่าตัด</b>' : 'ไม่ต้อง', 'ไม่ต้อง',
          e.needs_surgery ? '<span class="hot">ทบทวนแผน</span>' : '<span class="ok">ผ่าน</span>'],
      ])}
    </section>

    <section>
      <h2>7 · ข้อพิจารณาอื่น</h2>
      ${forsusBlock}
      <p class="note"><b>Growth:</b> ${r.growth_appliance_advice.map(esc).join(' · ')}</p>
      <p class="note"><b>Soft tissue:</b> ${esc(r.eline_advice)}</p>
      ${r.overjet_overbite_table.how_to_warn ? `<div class="alert">${esc(r.overjet_overbite_table.how_to_warn)}</div>` : ''}
      <ul class="plain">${r.overjet_overbite_table.how_to_reach_target.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </section>

    <footer class="disclaimer">
      <div class="foot-row">
        <div>
          <div class="ai-note">
            ผลทั้งหมดเป็น <b>AI Clinical Decision Support</b> คำนวณจากค่า ceph 2 มิติและโมเดล
            ตอบไม่ได้ว่าฟันอยู่ในกระดูกหรือไม่ — ต้องยืนยันด้วย CBCT และให้ทันตแพทย์ผู้รักษาตัดสินใจก่อนใช้จริงทุกครั้ง
          </div>
          <div class="ver">เวอร์ชัน ${APP_VERSION} · แก้ล่าสุด ${APP_UPDATED}</div>
        </div>
        <div class="stamp" aria-label="ลิขสิทธิ์ โดย ${APP_OWNER}">
          <span>ลิขสิทธิ์</span>
          <span>โดย ${APP_OWNER}</span>
        </div>
      </div>
    </footer>
  </article>`;
}

export { renderReport, APP_VERSION, APP_UPDATED, APP_OWNER };
