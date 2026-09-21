/* report.js — สร้าง HTML รายงานจากผลของ analyzeCase() */

// เวอร์ชันของตรรกะการคำนวณ — ขึ้นทั้งบนหน้าจอและในรายงานที่พิมพ์ออกมา
// เพื่อให้ตรวจได้ทันทีว่าใครถือเวอร์ชันไหนอยู่
// เลื่อนเลขอัตโนมัติด้วย tools/bump.py (มี pre-commit hook เรียกให้เอง) — ไม่ต้องแก้มือ
const APP_VERSION = '1.0.36';
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
const planClass = (d) => d === 'Extraction' ? 'plan-ext' : (d === 'IPR' ? 'plan-ipr' : 'plan-non');

function kv(rows) {
  return `<table class="kv">${rows.filter(Boolean).map(([k, v, cls, strong]) =>
    `<tr${strong ? ' class="strong"' : ''}><th>${esc(k)}</th><td${cls ? ` class="${cls}"` : ''}>${v}</td></tr>`).join('')}</table>`;
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
    warnBlocks.push(`<div class="alert">ระยะแก้ canine มากกว่าระยะแก้ overjet ${n2(r.canine.canine_drives_by_mm)} mm → Overjet จะจบที่ ${n2(r.canine.overjet_if_canine_driven)} mm (ต่ำกว่าเป้า 2 mm) — ชดเชยด้วย torque/procline ฟันบน หรือ protract ฟันล่าง</div>`);
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
        ${kv([
          ['SNA / SNB / ANB', `${n1(r.input_summary.sna)} / ${n1(r.input_summary.snb)} / ${n1(r.input_summary.anb)}`],
          ['FMA', n1(r.input_summary.fma) + '°'],
          ['SN-GoGn', n1(r.input_summary.sn_gogn) + '°'],
          ['Wits', n1(r.input_summary.wits) + ' mm'],
          ['FACC to FH', n1(r.input_summary.facc_to_fh) + '°'],
          ['IMPA (ช่อง / จริง)', `${n1(r.input_summary.l1_to_mpl_box)} / ${n1(r.input_summary.l1_to_mpl_absolute)}°`],
        ])}
        ${kv([
          ['1/1 ปัจจุบัน', n1(r.input_summary.interincisal_current) + '°' + (r.input_summary.interincisal_estimated ? ' (ประมาณ)' : '')],
          ['L1-APog', n2(r.input_summary.l1_apog_current) + ' mm'],
          ['Overjet / Overbite', `${n1(r.input_summary.overjet_current)} / ${n1(r.input_summary.overbite_current)} mm`],
          ['COS ที่ใช้', n2(r.input_summary.cos_mm) + ' mm'],
          ['TSD บน / ล่าง', `${n2(r.input_summary.tooth_size_discrepancy_upper)} / ${n2(r.input_summary.tooth_size_discrepancy_lower)} mm`],
          ['E-line บน / ล่าง', `${n2(r.input_summary.eline_upper_lip)} / ${n2(r.input_summary.eline_lower_lip)} mm`],
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
      ${archBudget(r.space_budget.upper, r.treatment_plan.upper, 'ฟันบน')}
      ${archBudget(r.space_budget.lower, r.treatment_plan.lower, 'ฟันล่าง')}
    </section>

    <section>
      <h2>4 · Canine และ Molar</h2>
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
      <h2>5 · เมื่อจบการรักษา</h2>
      ${kv([
        ['FACC to FH', n1(e.facc) + '°' + (e.facc_kept ? ' (เก็บไว้ — camouflage)' : '')],
        ['Interincisal 1/1', `${n1(e.interincisal)}° <span class="${e.interincisal_in_range ? 'ok' : 'hot'}">(ช่วงเป้า 125–131°)</span>${e.interincisal_capped ? ' · ถูกจำกัดด้วย IMPA floor' : ''}`],
        ['Overjet (เฟสจัดฟัน)', n2(e.overjet_ortho_phase) + ' mm → เป้า 2 mm'],
        ['L1-APog', n1(e.l1_apog) + ' mm' + (e.l1_apog_in_range ? '' : ` (ขยับ ${n2(e.l1_apog_move)} mm)`)],
        ['ต้องผ่าตัดไหม', e.needs_surgery ? '<b class="hot">ต้องพิจารณาผ่าตัด</b>' : 'ไม่ต้อง'],
      ])}
    </section>

    <section>
      <h2>6 · ข้อพิจารณาอื่น</h2>
      ${forsusBlock}
      <p class="note"><b>Growth:</b> ${r.growth_appliance_advice.map(esc).join(' · ')}</p>
      <p class="note"><b>Soft tissue:</b> ${esc(r.eline_advice)}</p>
      ${r.overjet_overbite_table.how_to_warn ? `<div class="alert">${esc(r.overjet_overbite_table.how_to_warn)}</div>` : ''}
      <ul class="plain">${r.overjet_overbite_table.how_to_reach_target.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </section>

    <footer class="disclaimer">
      <div class="foot-row">
        <div>
          ผลทั้งหมดเป็น <b>AI Clinical Decision Support</b> คำนวณจากค่า ceph 2 มิติและโมเดล
          ตอบไม่ได้ว่าฟันอยู่ในกระดูกหรือไม่ — ต้องยืนยันด้วย CBCT และให้ทันตแพทย์ผู้รักษาตัดสินใจก่อนใช้จริงทุกครั้ง
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
