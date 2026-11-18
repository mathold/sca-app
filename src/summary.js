/* summary.js — ใบ "IX. Summary / X. SCA Table and Treatment plan Summary"
 *
 * พอร์ตจาก make_summary.py (LOGO) — แก้ตรรกะฝั่ง Python เมื่อไร ต้องแก้ที่นี่ด้วย
 * ค่าทั้งหมดมาจาก analyzeCase() ตัวเดียวกับรายงาน · readSummaryExtras() อ่านค่าที่ฟอร์มไม่มี
 * (NB angle, U6/L6 migration) และแผนที่คุณหมอกรอกในตารางแดง (ถ้ามี = ใช้เป็น Tx Plan)
 */
import { pyRound } from './ortho_calc.js';

const QS = ['Q1', 'Q2', 'Q3', 'Q4'];
const PLUS = { Q1: 'I', Q2: 'J', Q3: 'M', Q4: 'N' };
const MINUS = { Q1: 'K', Q2: 'L', Q3: 'O', Q4: 'P' };
const ANCHOR_CELL = { Q1: 'I', Q2: 'K', Q3: 'M', Q4: 'O' };
const MOLAR = { Q1: ['16', '17'], Q2: ['26', '27'], Q3: ['36', '37'], Q4: ['46', '47'] };

function num(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(v, nd = 1) {
  if (v === null || v === undefined) return '–';
  let s = pyRound(Number(v), nd).toFixed(nd);   // ปัดแบบ Python (.x5 ที่ลงตัวพอดี -> เลขคู่)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// เปลี่ยนเฉพาะเครื่องหมายลบหน้าตัวเลข (ไม่แตะขีดใน Co-A, SN-GoGn)
const minus = s => String(s).replace(/(^|[^\w.])-(?=\d)/g, '$1−');
const out = s => minus(esc(s));

function thaiDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return String(iso || '');
  const [y, mo, d] = m.slice(1).map(Number);
  return `${d}/${mo}/${String((y + 543) % 100).padStart(2, '0')}`;
}

/* ---------- ค่าเพิ่มเติมจากไฟล์ SCA ---------- */
function readSummaryExtras(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const v = a => { const c = ws[a]; return (c && c.v !== undefined && c.v !== '') ? c.v : null; };
  const n = a => num(v(a));
  const x = {
    nb_angle: n('U29'),
    u6_mig: { Q1: n('F58'), Q2: n('H58') },
    l6_mig: { Q4: n('D95'), Q3: n('E95') },
  };
  const doc = { ext: {}, distal: {}, mesial: {}, ipr: {}, anchor: {} };
  for (const q of QS) {
    doc.ext[q] = n(PLUS[q] + '114');
    doc.distal[q] = n(PLUS[q] + '115');
    doc.mesial[q] = n(MINUS[q] + '115');
    doc.ipr[q] = n(PLUS[q] + '116');
    doc.anchor[q] = v(ANCHOR_CELL[q] + '120');
  }
  doc.bracket = { upper: v('I121'), lower: v('M121') };
  doc.u_retract = n('W93') || 0.0;
  const filled = ['ext', 'distal', 'mesial', 'ipr'].some(k => QS.some(q => doc[k][q]));
  x.doctor = filled ? doc : null;
  return x;
}

function anchorageCode(mesial, distal = 0) {
  if (distal && distal > 0) return 'Max+';
  const m = mesial || 0;
  if (m <= 1.5) return 'Max+';
  if (m <= 2.5) return 'Max';
  if (m <= 3.5) return 'Med';
  return 'Min';
}

/* ---------- ประกอบข้อความ (ตรงกับ build() ใน make_summary.py) ---------- */
function buildSummary(raw, result, xl) {
  const g = k => num(raw[k]);
  const missing = (raw.missing_teeth || []).map(String);
  const molarTooth = q => (missing.includes(MOLAR[q][0]) ? MOLAR[q][1] : MOLAR[q][0]);
  const w = result.working, ep = result.endpoint, sb = result.space_budget;
  const sd = raw.space_discrepancy || {};
  const sdq = q => num(sd[q.toLowerCase()]);
  const doc = (xl || {}).doctor || null;

  const anb = g('anb'), wits = g('wits'), sna = g('sna'), snb = g('snb');
  const fma = g('fma'), sngogn = g('sn_gogn'), ansme = g('ans_me');
  const facc = g('facc_to_fh'), ii = g('interincisal_current'), l1apog = g('l1_apog_current');
  const u1sn = g('u1_sn');
  const impa = g('l1_to_mpl_box') !== null ? g('l1_to_mpl_box') + 90 : null;
  const oj = g('overjet_current'), ob = g('overbite_current');
  const growth = raw.growth_pattern || 'average';

  // A. ค่าที่นอกเกณฑ์
  const a = [];
  if (fma !== null && (fma < 20 || fma > 28)) {
    let t = `${fma < 20 ? 'Low' : 'High'} MP angle — FMA ${fmt(fma)}°`;
    if (sngogn !== null) t += `, SN-GoGn ${fmt(sngogn)}°`;
    if (ansme !== null && (ansme < 58 || ansme > 64)) t += `, ${ansme < 58 ? 'short' : 'long'} LAFH (ANS-Me ${fmt(ansme)})`;
    a.push(t);
  }
  if (facc !== null && Math.abs(facc) >= 3) {
    let t = `${facc < 0 ? 'Retroclined' : 'Proclined'} U1 — `;
    if (u1sn !== null) t += `U1-SN ${fmt(u1sn)}°, `;
    t += `FACC ${fmt(facc)}°`;
    if (ii !== null) t += ` · 1/1 ${fmt(ii)}°`;
    a.push(t);
  } else if (ii !== null && !(ii >= 125 && ii <= 131)) {
    a.push(`1/1 ${fmt(ii)}° (${ii > 131 ? 'upright incisors' : 'proclined incisors'})`);
  }
  if (l1apog !== null && !(l1apog >= 1 && l1apog <= 3)) {
    let t = `L1 ${l1apog < 1 ? 'behind' : 'ahead of'} A-Pog (${fmt(l1apog)} mm)`;
    if (impa !== null) t += ` · IMPA ${fmt(impa)}°`;
    a.push(t);
  }
  if (wits !== null && Math.abs(wits) > 3) a.push(`Wits ${fmt(wits)} mm`);
  if (!a.length) a.push('ไม่มีค่าเด่นนอกเกณฑ์');

  // D. soft profile
  const prof = {
    convex: anb !== null && anb > 4, concave: anb !== null && anb < 0,
    retrog: snb !== null && snb < 78, prog: snb !== null && snb > 82,
    brachy: growth === 'low_angle', dolicho: growth === 'high_angle',
  };
  prof.straight = !(prof.convex || prof.concave);
  prof.orthog = !(prof.retrog || prof.prog);
  prof.meso = !(prof.brachy || prof.dolicho);
  const eu = g('eline_upper_lip'), elo = g('eline_lower_lip');
  const eline = (eu !== null || elo !== null) ? `${fmt(eu)} / ${fmt(elo)} mm` : '___ / ___';
  let elineNote = '';
  if (eu !== null && elo !== null) {
    if (eu < -2 && elo < -2) elineNote = '(ริมฝีปากบน-ล่างอยู่หลัง E-line — lips retrusive)';
    else if (eu > 0 || elo > 2) elineNote = '(ริมฝีปากยื่นเกิน E-line — lips protrusive)';
  }
  const nb = (xl || {}).nb_angle ?? null;

  // B. skeletal
  let sk;
  if ((anb !== null && anb < 0) || (oj !== null && oj < 0)) sk = 'Skeletal Class III';
  else if ((anb !== null && anb >= 4) || (wits !== null && wits > 2)) sk = 'Skeletal Class II';
  else sk = 'Skeletal Class I';
  sk += ` (ANB ${fmt(anb)}°, Wits ${fmt(wits)} mm)`;
  const mx = sna && sna > 84 ? 'prognathic Mx' : sna && sna < 80 ? 'retrognathic Mx' : null;
  const md = snb && snb > 82 ? 'prognathic Md' : snb && snb < 78 ? 'retrognathic Md' : null;
  const jaws = [mx, md].filter(Boolean).join(' · ') || 'orthognathic Mx & Md';
  const b = [sk + ' · ' + jaws];
  const mc = result.mcnamara || {};
  if (mc.available) b.push(`McNamara: ${mc.summary} (ref = ${mc.ref_label}; Co-A ${fmt(g('co_a'))} / Co-Gn ${fmt(g('co_gn'))})`);

  // C. dental
  const roman = { 1: 'I', 2: 'II', 3: 'III' };
  const relText = (name, rel, note) => {
    rel = rel || {};
    const rt = rel.rt_class, lt = rel.lt_class;
    if (!rt && !lt) return null;
    let t;
    if (rt === lt) t = `${name} Class ${roman[rt] ?? rt} — Rt ${fmt(num(rel.rt_mm))} / Lt ${fmt(num(rel.lt_mm))} mm`;
    else t = `${name} Rt Class ${roman[rt] ?? rt} ${fmt(num(rel.rt_mm))} mm / Lt Class ${roman[lt] ?? lt} ${fmt(num(rel.lt_mm))} mm`;
    return t + note;
  };
  const lowQ = ['Q3', 'Q4'].filter(q => missing.includes(MOLAR[q][0]));
  const mnote = lowQ.length
    ? ` (อ้างอิง ${lowQ.map(q => MOLAR[q][1]).join(', ')} — ${lowQ.map(q => MOLAR[q][0]).join(', ')} หาย)` : '';
  const c = [relText('Canine', raw.canine_relationship, ''), relText('Molar', raw.molar_relationship, mnote)].filter(Boolean);
  c.push(`OJ ${fmt(oj)} mm · OB ${fmt(ob)} mm`);

  // E. growth
  const e = [{ low_angle: 'Horizontal growth pattern (low angle)', high_angle: 'Vertical growth pattern (high angle)' }[growth]
    || 'Average growth pattern'];
  e.push([fma !== null ? `FMA ${fmt(fma)}°` : null, g('y_axis') !== null ? `Y-axis ${fmt(g('y_axis'))}°` : null]
    .filter(Boolean).join(' · '));

  // molar migration
  const mig = [];
  const u6 = (xl || {}).u6_mig || {}, l6 = (xl || {}).l6_mig || {};
  for (const [lab, pairs] of [['U6', [['Rt', u6.Q1], ['Lt', u6.Q2]]], ['L', [['Rt', l6.Q4], ['Lt', l6.Q3]]]]) {
    const s = pairs.filter(([, v]) => v).map(([k, v]) => `${k} ${fmt(v)}`).join(' / ');
    if (s) mig.push(`${lab} ${s}`);
  }

  const midline = raw.midline || {};
  const midCells = ['q1', 'q2', 'q4', 'q3'].map(q => (num(midline[q]) ? fmt(num(midline[q])) : ''));

  const ae = raw.arch_expansion || {};
  const arch = [];
  if (raw.arch_width_intercanine_upper || raw.arch_width_intercanine_lower)
    arch.push(`Intercanine U ${fmt(num(raw.arch_width_intercanine_upper))} / L ${fmt(num(raw.arch_width_intercanine_lower))} mm`);
  if (raw.arch_width_intermolar_upper || raw.arch_width_intermolar_lower)
    arch.push(`Intermolar U ${fmt(num(raw.arch_width_intermolar_upper))} / L ${fmt(num(raw.arch_width_intermolar_lower))} mm`);
  const expU = Math.max(num(ae.q1) || 0, num(ae.q2) || 0), expL = Math.max(num(ae.q3) || 0, num(ae.q4) || 0);
  if (expU || expL) arch.push('Expansion ' + [expU ? `U ${fmt(expU)}` : null, expL ? `L ${fmt(expL)}` : null].filter(Boolean).join(' · ') + ' mm/ข้าง');

  // special consideration
  const sp = [];
  const qList = (pred) => ['q1', 'q2', 'q3', 'q4'].filter(q => pred(num(sd[q]) || 0)).map(q => `Q${q[1]} ${fmt(num(sd[q]))}`);
  if (missing.length) {
    let t = [...missing].sort().join(', ') + ' missing';
    const spaces = qList(v => v > 0);
    if (spaces.length) t += ' — space ' + spaces.join(' / ') + ' mm';
    sp.push(t);
  }
  const crowd = qList(v => v < 0);
  if (crowd.length) sp.push('Crowding ' + crowd.join(' / ') + ' mm');
  if (!missing.length) {
    const space = qList(v => v > 0);
    if (space.length) sp.push('Spacing ' + space.join(' / ') + ' mm');
  }
  const drift = ['Q3', 'Q4'].filter(q => missing.includes(MOLAR[q][0])).map(q => MOLAR[q][1]);
  const cos = (sb && sb.lower && sb.lower.cos) || 0;
  const cosMm = cos * 2;
  const extra = [];
  if (drift.length) extra.push(`${drift.join(', ')} mesial drift`);
  if (cosMm) extra.push(`COS ${fmt(cosMm)} mm`);
  if (extra.length) sp.push(extra.join(' · '));
  if (!sp.length) sp.push('–');

  // ---------- Tx plan: แผนคุณหมอ (ถ้ามี) หรือแผนระบบ ----------
  const mesial = {}, distal = {}, ext = {}, ipr = {};
  let src, uRetract;
  if (doc) {
    src = 'แผนคุณหมอ';
    for (const q of QS) {
      mesial[q] = doc.mesial[q] || 0; distal[q] = doc.distal[q] || 0;
      ext[q] = doc.ext[q] || 0; ipr[q] = doc.ipr[q] || 0;
    }
    uRetract = doc.u_retract;
  } else {
    src = 'แผนระบบ';
    for (const archKey of ['upper', 'lower']) {
      const bb = sb[archKey];
      const nside = Math.max(bb.sides.length, 1);
      for (const s of bb.sides) {
        const q = s.quad;
        if (bb.is_ext_plan || s.extract_here) {
          mesial[q] = s.molar_burn || 0;
          ext[q] = s.extract_here ? 7 : 0;
        } else {
          mesial[q] = missing.includes(MOLAR[q][0]) ? Math.max(s.leftover || 0, 0) : 0;
          ext[q] = 0;
        }
        distal[q] = (bb.dist_used || 0) / nside;
        ipr[q] = (bb.ipr_used || 0) / nside;
      }
    }
    uRetract = w.retract_upper || 0;
  }

  const anch = {};
  for (const q of QS) {
    const manual = doc && doc.anchor[q];
    if (manual) anch[q] = String(manual);
    else if (doc || mesial[q] || distal[q] || ext[q]) anch[q] = anchorageCode(mesial[q], distal[q]);
    else {
      const cat = sb[(q === 'Q1' || q === 'Q2') ? 'upper' : 'lower'].category || '';
      anch[q] = cat.includes('เกิน') ? 'Max+' : cat.includes('Maximum') ? 'Max'
        : cat.includes('Moderate') ? 'Med' : cat.includes('Minimum') ? 'Min' : 'Max+';
    }
  }

  const archPlan = qs => {
    const e_ = qs.filter(q => ext[q]);
    const i_ = qs.reduce((s, q) => s + ipr[q], 0);
    const d_ = qs.reduce((s, q) => s + distal[q], 0);
    let t = e_.length ? `Ext. premolar ×${e_.length} (${e_.join(', ')})` : 'Non-ext';
    if (i_) t += ` + IPR ${fmt(i_)} mm`;
    if (d_) t += ` + distalize ${fmt(d_)} mm`;
    return t;
  };
  const upPlan = archPlan(['Q1', 'Q2']), loPlan = archPlan(['Q3', 'Q4']);
  const tx = upPlan === loPlan ? `${upPlan} (${src})` : `U: ${upPlan} · L: ${loPlan} (${src})`;

  const side = q => ((q === 'Q1' || q === 'Q4') ? 'Rt' : 'Lt');
  const movement = qs => {
    const parts = [];
    const mm = qs.filter(q => mesial[q]);
    if (mm.length) parts.push(`protract ${mm.map(molarTooth).join(', ')} → ${mm.map(q => `${side(q)} ${fmt(mesial[q])}`).join(' / ')} mm`);
    const dd = qs.filter(q => distal[q]);
    if (dd.length) parts.push(`distalize ${dd.map(q => fmt(distal[q])).join(' / ')} mm`);
    return parts;
  };

  let bracket = [];
  if (doc && (doc.bracket.upper || doc.bracket.lower)) {
    bracket = [`U: ${doc.bracket.upper || '–'}`, `L: ${doc.bracket.lower || '–'}`];
  } else {
    const um = Math.max(mesial.Q1, mesial.Q2);
    bracket.push(uRetract > 0 ? 'U: Retract' : (um ? `U: – (U6 mesial ≤ ${fmt(um)} mm)` : 'U: –'));
    const lm = ['Q4', 'Q3'].filter(q => mesial[q] > 1.5);
    bracket.push(lm.length ? `L: Protract ${lm.map(molarTooth).join(', ')}`
      : ((w.retract_lower || 0) > 0 ? 'L: Retract' : 'L: –'));
  }

  const prep = [];
  for (const [lab, qs] of [['U', ['Q1', 'Q2']], ['L', ['Q4', 'Q3']]]) {
    const codes = qs.map(q => anch[q]);
    const code = codes[0] === codes[1] ? codes[0] : `${codes[0]}/${codes[1]}`;
    let mv = movement(qs);
    if (!mv.length) {
      mv = [codes[0].startsWith('Max') ? `hold ${lab}6 (TPA / TADs)`
        : codes[0] === 'Med' ? 'reciprocal space closure' : 'space closure โดยให้ molar เลื่อนมาหน้า'];
    } else if (qs.every(q => mesial[q] <= 1.5) && !qs.some(q => distal[q])) {
      mv = [`hold ${lab}6 (TPA / TADs), mesial ≤ ${fmt(Math.max(...qs.map(q => mesial[q])))} mm`];
    } else if (qs.some(q => mesial[q] > 3.5)) {
      mv[mv.length - 1] += ' (anterior anchorage + TADs)';
    }
    if (lab === 'U' && uRetract > 0) mv.push(`retract U1 ${fmt(uRetract)} mm`);
    prep.push(`${lab}: ${code} — ${mv.join(', ')}`);
  }

  // remark
  const rem = [];
  for (const q of QS) {
    const spQ = sdq(q) || 0;
    if (!missing.includes(MOLAR[q][0]) || spQ <= 0) continue;
    const left = spQ - ((q === 'Q3' || q === 'Q4') ? cos : 0) - mesial[q];
    if (mesial[q] >= 7 || left > 0.5)
      rem.push(`Prosth: ช่อง ${q} ${fmt(spQ)} mm — molar ต้องเดิน ${fmt(mesial[q])} mm (เพดาน 7)${left > 0.5 ? ` เหลือ ${fmt(left)} mm` : ''} → เผื่อ implant/prosth`);
  }
  if (rem.length) prep.push('    ช่องที่เหลือ → implant / prosth');
  const moving = QS.filter(q => mesial[q] > 3.5).map(molarTooth);
  rem.push(moving.length ? `CBCT ยืนยันกระดูกก่อน protract ${moving.join(', ')}` : 'CBCT ยืนยัน bony envelope ก่อนเคลื่อนฟัน');

  // objectives
  const obj = [];
  const closing = ['Q1', 'Q2', 'Q4', 'Q3'].filter(q => missing.includes(MOLAR[q][0]) && mesial[q]);
  if (closing.length)
    obj.push(`Close spaces ${closing.map(q => MOLAR[q][0]).join('/')} by protracting ${closing.map(molarTooth).join(', ')} (${closing.map(q => `${side(q)} ${fmt(mesial[q])}`).join(' / ')} mm)`);
  if (!ep.facc_kept && facc !== null && Math.abs(facc) >= 1)
    obj.push(`Correct U1 torque (FACC ${fmt(facc)} → 0°), 1/1 → ${fmt(ep.interincisal)}°`);
  const gaps = QS.filter(q => (sdq(q) || 0) > 0 && !missing.includes(MOLAR[q][0]));
  if (gaps.length) obj.push('Close spacing ' + gaps.map(q => `${q} ${fmt(sdq(q))} mm`).join(' / '));
  if (ep.facc_kept) obj.push(`Class III camouflage — keep U1 (FACC ${fmt(facc)}°), retrocline/retract L1`);
  const canine = raw.canine_relationship || {};
  if (([2, 3].includes(canine.rt_class) || [2, 3].includes(canine.lt_class)) && (!doc || uRetract > 0))
    obj.push(`Canine → Class I (Rt ${fmt(num(canine.rt_mm))} / Lt ${fmt(num(canine.lt_mm))} mm)`);
  if ((w.retract_upper || 0) > 0 && !doc) obj.push(`Retract U1 ${fmt(w.retract_upper)} mm`);
  const tail = [`OJ ${fmt(ep.overjet)}`, `L1-APog ${fmt(ep.l1_apog)} mm`];
  if (cosMm) tail.push('level COS');
  obj.push(tail.join(' · '));
  if (obj.length < 3 && elineNote.startsWith('(ริมฝีปากบน-ล่างอยู่หลัง')) obj.push('Keep lip support');

  // Dx
  const dx = [b[0].replace('Skeletal Class', 'Skeletal Cl') + ', ' + e[0].toLowerCase().replace('growth pattern', 'growth')];
  const dent = c.slice(0, -1).map(x => x.replaceAll('Class ', 'Cl '));
  if (dent.length) dx.push(dent.join(' · '));
  if (sp[0] !== '–') dx.push(sp[0]);
  dx.push(a[0] !== 'ไม่มีค่าเด่นนอกเกณฑ์' ? a[0] : `OJ ${fmt(oj)} / OB ${fmt(ob)}`);

  return {
    a_items: a, prof, nb_angle: nb !== null ? `${fmt(nb)}°` : '____',
    eline, eline_note: elineNote, b_lines: b, c_lines: c, e_lines: e.filter(Boolean),
    molar_migration: mig.length ? mig.join(' · ') : '____',
    ob_oj: `${fmt(ob)} / ${fmt(oj)}`, midline: midCells, arch_note: arch.join(' · '),
    special_items: sp, remark_items: rem, objectives: obj, dx, tx_plan: tx,
    anchorage: [anch.Q1, anch.Q2, anch.Q4, anch.Q3], bracket,
    retention_upper: 'Wrap around', retention_lower: 'Fixed 3–3 + wrap around',
    anch_prep: prep, source: src,
  };
}

/* ---------- HTML ของใบ (แก้ข้อความ/ติ๊กช่องได้) ---------- */
function renderSummary(raw, ctx) {
  const ul = xs => `<ul contenteditable>${xs.map(x => `<li>${out(x)}</li>`).join('')}</ul>`;
  const box = (label, on) => `<span class="sx-box${on ? ' on' : ''}">${label}</span>`;
  const ce = (s, tag = 'div', st = '') => `<${tag} contenteditable${st ? ` style="${st}"` : ''}>${s}</${tag}>`;
  const lines = xs => xs.map(out).join('<br>');
  const p = ctx.prof;
  const name = raw.patient_name || '', dn = String(raw.dn || ''), age = raw.age;
  let header = `${esc(name)} &nbsp; DN ${esc(dn)}`;
  if (age) header += ` &nbsp; อายุ ${esc(age)}${/^\d+$/.test(String(age).trim()) ? ' ปี' : ''}`;
  if (raw.date) header += ` &nbsp; (SCA ${esc(thaiDate(raw.date))})`;
  const cross = (vals, cls = 'cross sm') => `<div class="${cls}">${vals.map(v => `<div contenteditable>${out(v)}</div>`).join('')}</div>`;
  const empty4 = ['', '', '', ''];

  return `
<div class="top">${ce('Dr. ________________')}${ce(header)}</div>
<h1>IX. Summary (10-5-65)</h1>
<table>
<colgroup><col style="width:50%"><col style="width:50%"></colgroup>
<tr>
  <td style="height:30mm"><span class="lbl">A. Exceptional Cephalometric Findings :</span>${ul(ctx.a_items)}</td>
  <td><span class="lbl">D. Assessment of Soft Profile :</span>
    <div class="cbs">${box('Straight', p.straight)}${box('Convex', p.convex)}${box('Concave', p.concave)}<br>
      ${box('Orthog', p.orthog)}${box('Retrog', p.retrog)}${box('Prog', p.prog)}<br>
      ${box('Meso', p.meso)}${box('Dolicho', p.dolicho)}${box('Brachy', p.brachy)}</div>
    NB angle ${ce(out(ctx.nb_angle), 'span')} &nbsp; E-Line ${ce(out(ctx.eline), 'span')}
    ${ce(out(ctx.eline_note))}</td>
</tr>
<tr class="sep">
  <td style="height:17mm"><span class="lbl">B. Assessment of Skeletal Relationship :</span>${ce(lines(ctx.b_lines))}</td>
  <td><span class="lbl">C. Assessment of Dental Relationship :</span>${ce(lines(ctx.c_lines))}</td>
</tr>
<tr class="sep">
  <td style="height:15mm"><span class="lbl">E. Growth Pattern ?</span>${ce(lines(ctx.e_lines))}</td>
  <td><span class="lbl">OMD</span> ${ce('–')}</td>
</tr>
<tr class="sep">
  <td>
    <div style="font-size:10pt">Molar migration : ${ce(out(ctx.molar_migration), 'span')} mm. &nbsp;OB/OJ ${ce(out(ctx.ob_oj), 'span')}</div>
    <div class="row" style="margin-top:1.5mm">Midline ${cross(ctx.midline)} &nbsp; X-bite ${cross(empty4)}</div>
    <div style="margin-top:1mm">Tooth Shape: &nbsp; ${box('Square')} &nbsp; ${box('Taper')} &nbsp; ${box('Barrel')}</div>
  </td>
  <td>
    <div style="font-size:10pt">Arch Form : ${box('Damon')} ${ce('__', 'span')}% &nbsp;${box('Square')} ${box('Bio')} ${box('Ovoid')}</div>
    ${ce(out(ctx.arch_note))}
    <div class="row" style="margin-top:1mm">Arch Symmetry ${cross(empty4)}</div>
  </td>
</tr>
<tr class="sep">
  <td style="height:17mm"><span class="lbl">Special Consideration : <span class="small">(Missing, Super, Size, Shape, TMD, Impacted)</span></span>${ul(ctx.special_items)}</td>
  <td><span class="lbl">Remark: (Perio, Frenum, Gingiva, RCT, Prosth)</span>${ul(ctx.remark_items)}</td>
</tr>
</table>
<h2>X. SCA Table and Treatment plan Summary</h2>
<table>
<colgroup><col style="width:47%"><col style="width:53%"></colgroup>
<tr>
  <td class="lines"><span class="lbl">Treatment Objectives</span>
    ${ctx.objectives.map(x => ce('– ' + out(x))).join('')}${ce('')}</td>
  <td class="lines"><span class="lbl">Dx</span>
    ${ctx.dx.map(x => ce('– ' + out(x))).join('')}</td>
</tr>
<tr class="sep">
  <td>
    <u>Tx Plan</u> ${ce('&nbsp;' + out(ctx.tx_plan), 'span')}
    <div class="row" style="margin-top:1.5mm"><span style="width:26mm">Anchorage<br>Requirement</span>${cross(ctx.anchorage, 'cross')}</div>
    <div class="row" style="margin-top:2mm"><span style="width:26mm">Bracket<br>Selection</span>${ce(lines(ctx.bracket), 'div', 'flex:1')}</div>
    <div class="row" style="margin-top:2.5mm"><span style="width:20mm">Retention<br>(Type)</span>
      <div style="flex:1">Upper: ${ce(out(ctx.retention_upper), 'span')}<br>Lower: ${ce(out(ctx.retention_lower), 'span')}</div></div>
    <div style="margin-top:2.5mm">Patient Corporation &nbsp; ${box('High')} &nbsp; ${box('Fair')} &nbsp; ${box('Poor')}</div>
  </td>
  <td class="lines">
    <span class="lbl">Anchorage Preparation</span>
    ${ctx.anch_prep.map(x => ce(out(x))).join('')}
    <div style="margin-top:3mm"><span class="lbl">OMT</span></div>
    ${ce('–')}${ce('')}${ce('')}
  </td>
</tr>
</table>
<div class="foot"><span>Modern Smile Institute (MSI)</span><span>1 of 11</span><span>AVS Orthodontics</span><span>All Right Reserved.</span></div>`;
}

export { readSummaryExtras, buildSummary, renderSummary };
