/*
 * analyze.js — ส่วนที่สองของการพอร์ต ortho_calc.py
 *   space_budget()  +  analyze_case()
 * ตรรกะตรงกับฝั่ง Python ฉบับแก้ไข 18 ก.ย. 2569
 */
import {
  pyRound, nz, fmtG, fmtF, fmtGSigned, pyMax, ASSUMPTIONS,
  upperTorqueCorrection, estimateInterincisalCurrent, lowerTorqueCorrection,
  midlineCorrectionSpace, resolveCos, totalSpaceRequired, expansionSpaceGain,
  spaceManagementDecision, asymmetricAnchorageNote,
  mcnamaraReferenceAnalysis, autoDiagnosis, elineAdvice, growthApplianceAdvice,
  overjetTargetPlan, canineRequirement, predictMolarFinish, fmtFSigned,
} from './ortho_calc.js';

/* ------------------------------------------------------------------ *
 * space_budget — งบพื้นที่ต่อ arch (anchorage คำนวณท้ายสุด)
 * ------------------------------------------------------------------ */
function spaceBudget(arch, decision, premolarsExtracted, expansionGain,
                     tsd, cosComponent, midlineSpace, torqueSpace, apNeed, opts = {}) {
  const {
    avgToothWidth = ASSUMPTIONS.avg_premolar_width_mm,
    surplusThreshold = 7.0,
    iprMax = ASSUMPTIONS.ipr_max_per_arch,
    distalizeDefault = ASSUMPTIONS.distalize_default_mm,
    qRight = null, qLeft = null, midRight = 0.0, midLeft = 0.0,
    forceNonExt = false, protractionSupplyIn = 0.0,
    extRight = true, extLeft = true,
    apNeedRight = null, apNeedLeft = null,
  } = opts;

  // nz() กลบ -0 ไม่ให้รายงานขึ้นว่า "เก -0"
  const spacingExtra = nz(pyRound(pyMax(tsd, 0.0), 2));
  const crowding = nz(pyRound(pyMax(-tsd, 0.0), 2));
  const expansion = pyRound(pyMax(expansionGain, 0.0), 2);

  const apRight = (apNeedRight === null) ? apNeed : pyRound(apNeedRight, 2);
  const apLeft = (apNeedLeft === null) ? apNeed : pyRound(apNeedLeft, 2);
  const retractionRight = pyRound(apRight, 2);
  const retractionLeft = pyRound(apLeft, 2);
  const retractionAsym = Math.abs(retractionRight - retractionLeft) > 0.01;
  const retractionSide = pyRound(Math.max(apRight, apLeft), 2);
  const retractionTotal = pyRound(apRight + apLeft, 2);
  const structural = pyRound(crowding + cosComponent + midlineSpace + torqueSpace, 2);
  const netRequired = pyRound(structural + retractionTotal, 2);

  const protractionSupply = pyRound(Math.max(protractionSupplyIn, 0.0), 2);
  const baseSupply = pyRound(spacingExtra + expansion + protractionSupply, 2);
  const remaining = pyRound(netRequired - baseSupply, 2);

  const extSidesAvail = (extRight ? 1 : 0) + (extLeft ? 1 : 0);
  const extTeethPlanned = extSidesAvail;
  const ext2Space = pyRound(extTeethPlanned * avgToothWidth, 2);
  const leftoverOf = (add) => pyRound(baseSupply + add - netRequired, 2);
  const expOpt = ASSUMPTIONS.expansion_option_default_mm;
  const extLabel = extTeethPlanned === 0
    ? 'ถอนเพิ่มไม่ได้ (ฟันหายครบทั้ง 2 ข้างแล้ว)'
    : `ถอน ${extTeethPlanned} ซี่ (${fmtG(ext2Space)} mm)`;

  const options = [
    { label: extLabel, add: ext2Space, leftover: leftoverOf(ext2Space), leftover_side: pyRound(leftoverOf(ext2Space) / 2.0, 2) },
    { label: `ขยาย arch (~${fmtG(expOpt)} mm)`, add: expOpt, leftover: leftoverOf(expOpt), leftover_side: pyRound(leftoverOf(expOpt) / 2.0, 2) },
    { label: `IPR สูงสุด (~${fmtG(iprMax)} mm)`, add: iprMax, leftover: leftoverOf(iprMax), leftover_side: pyRound(leftoverOf(iprMax) / 2.0, 2) },
    { label: `Distalize (~${fmtG(distalizeDefault)} mm/arch)`, add: distalizeDefault, leftover: leftoverOf(distalizeDefault), leftover_side: pyRound(leftoverOf(distalizeDefault) / 2.0, 2) },
  ];

  const planSources = [];
  if (spacingExtra) planSources.push(['ช่องว่างเดิม (ฟันห่าง)', spacingExtra]);
  if (expansion) planSources.push(['ขยาย arch', expansion]);
  if (protractionSupply) planSources.push(['protraction ฟันล่างมาหน้า (Forsus)', protractionSupply]);

  let extUsed = 0.0, iprUsed = 0.0, distUsed = 0.0;
  let premolarsAssumed = false;
  let planLabel;

  if (forceNonExt) {
    if (remaining <= 0.5) {
      planLabel = 'Non-Extraction (Forsus — พื้นที่พอ)';
    } else {
      iprUsed = pyRound(Math.min(iprMax, remaining), 2);
      if (iprUsed > 0) planSources.push(['IPR (~0.3–0.5 mm/ซี่)', iprUsed]);
      const rem2 = pyRound(remaining - iprUsed, 2);
      if (rem2 > 0.5) {
        distUsed = pyRound(Math.min(distalizeDefault, rem2), 2);
        planSources.push([`Distalize molar (~${fmtG(distalizeDefault)} mm/arch)`, distUsed]);
      }
      planLabel = 'Non-Extraction (Forsus)'
        + (iprUsed > 0 ? ' + IPR' : '') + (distUsed > 0 ? ' + Distalize' : '');
    }
  } else if (remaining <= 0.5) {
    planLabel = 'Non-Extraction (พื้นที่พอจากช่องว่างเดิม/ขยาย)';
  } else if (remaining > 6 && extTeethPlanned > 0) {
    // เกณฑ์เดียว: ดูพื้นที่ที่ยังขาดเท่านั้น (18 ก.ย. 2569)
    let pe = (premolarsExtracted && premolarsExtracted > 0) ? premolarsExtracted : extTeethPlanned;
    pe = Math.min(pe, extTeethPlanned);
    if (!premolarsExtracted || premolarsExtracted <= 0) premolarsAssumed = true;
    extUsed = pyRound(pe * avgToothWidth, 2);
    planSources.push([`ถอนฟัน ${pe} ซี่ (พรีโมลาร์ ~${fmtG(avgToothWidth)} mm/ซี่)`, extUsed]);
    planLabel = `Extraction — ถอน ${pe} ซี่`;
    // ถอนแล้วยังขาด -> เติม IPR แล้ว distalize ให้งบลงตัวในแผนเลย (ตรงกับ ortho_calc.py)
    const short1 = pyRound(remaining - extUsed, 2);
    if (short1 > 0.01) {
      iprUsed = pyRound(Math.min(iprMax, short1), 2);
      if (iprUsed > 0) { planSources.push(['IPR (~0.3–0.5 mm/ซี่)', iprUsed]); planLabel += ' + IPR'; }
      const short2 = pyRound(short1 - iprUsed, 2);
      if (short2 > 0.01) {
        distUsed = pyRound(Math.min(distalizeDefault, short2), 2);
        planSources.push([`Distalize molar (~${fmtG(distalizeDefault)} mm/arch)`, distUsed]);
        planLabel += ' + Distalize';
      }
    }
  } else {
    iprUsed = pyRound(Math.min(iprMax, remaining), 2);
    planSources.push(['IPR (~0.3–0.5 mm/ซี่)', iprUsed]);
    const rem2 = pyRound(remaining - iprUsed, 2);
    if (rem2 > 0.5) { distUsed = rem2; planSources.push(['Distalize molar', distUsed]); }
    planLabel = 'IPR' + (distUsed > 0 ? ' + Distalize' : '');
  }

  const optKeys = ['ถอน', 'ขยาย', 'IPR', 'Distalize'];
  options.forEach((opt, i) => {
    const k = optKeys[i];
    if (k === 'ถอน') opt.recommended = planLabel.includes('Extraction');
    else if (k === 'ขยาย') opt.recommended = planLabel.includes('ขยาย');
    else if (k === 'IPR') opt.recommended = planLabel.includes('IPR');
    else opt.recommended = planLabel.includes('Distalize');
  });

  const planSupply = pyRound(baseSupply + extUsed + iprUsed + distUsed, 2);
  const balance = pyRound(planSupply - netRequired, 2);
  const leftover = pyRound(Math.max(balance, 0.0), 2);
  const deficit = pyRound(Math.max(-balance, 0.0), 2);
  let status;
  if (deficit > 0.5) status = 'deficit';
  else if (leftover >= surplusThreshold) status = 'surplus';
  else status = 'balanced';

  const leftoverSide = pyRound(balance / 2.0, 2);
  const perSideExt = pyRound(avgToothWidth, 2);
  const isExtPlan = extUsed > 0;
  const molarBurnSide = isExtPlan ? pyRound(Math.max(leftoverSide, 0.0), 2) : 0.0;
  const burnRatio = (isExtPlan && perSideExt) ? pyRound(molarBurnSide / perSideExt, 2) : null;

  let anch, appliance;
  if (status === 'deficit') {
    anch = 'เกิน Maximum (space ไม่พอ)';
    appliance = 'ต้องเพิ่มพื้นที่/ลดความต้องการก่อน (ดูคำแนะนำ)';
  } else if (isExtPlan) {
    if (burnRatio === null || burnRatio < 0.34) {
      anch = 'Maximum Anchorage'; appliance = 'molar เลื่อนหน้าได้น้อย (<1/3 ช่องถอน) — ยึด posterior: TAD / TPA / Headgear';
    } else if (burnRatio <= 0.66) {
      anch = 'Moderate Anchorage'; appliance = 'molar เลื่อนหน้าปานกลาง (~1/2 ช่องถอน) — TPA / light Class II elastics';
    } else {
      anch = 'Minimum Anchorage'; appliance = 'ยอมให้ molar เลื่อนหน้าปิดช่องเอง (≥2/3 ช่องถอน) — molar band ปกติ';
    }
  } else if (planSupply > 0) {
    const ratio = retractionTotal / planSupply;
    if (ratio > 0.66) { anch = 'Maximum Anchorage'; appliance = 'TAD (Mini-implant) หรือ Headgear'; }
    else if (ratio > 0.33) { anch = 'Moderate Anchorage'; appliance = 'TPA / light Class II elastics, เสริม TAD หากต้องการความแม่นยำ'; }
    else { anch = 'Minimum Anchorage'; appliance = 'molar band / light mechanics เพียงพอ'; }
  } else {
    if (retractionTotal > 4) { anch = 'Maximum Anchorage'; appliance = 'เสริม TAD หากต้อง retract มากแม้ไม่ถอนฟัน'; }
    else if (retractionTotal >= 2) { anch = 'Moderate Anchorage'; appliance = 'TPA / Lingual arch'; }
    else { anch = 'Minimum Anchorage'; appliance = 'passive arch, monitor เป็นระยะ'; }
  }

  const anchFromBurn = (br) => {
    if (br === null || br < 0.34) return 'Maximum Anchorage';
    if (br <= 0.66) return 'Moderate Anchorage';
    return 'Minimum Anchorage';
  };

  let qR = qRight, qL = qLeft;
  if (qR === null || qL === null) { qR = qL = pyRound(tsd / 2.0, 2); }
  const expSide = pyRound(expansion / 2.0, 2);

  const sideDefs = arch === 'upper'
    ? [['บนขวา', 'Q1', qR, midRight, !!extRight, apRight], ['บนซ้าย', 'Q2', qL, midLeft, !!extLeft, apLeft]]
    : [['ล่างขวา', 'Q4', qR, midRight, !!extRight, apRight], ['ล่างซ้าย', 'Q3', qL, midLeft, !!extLeft, apLeft]];

  const sides = [];
  for (const [sideTh, quadName, qv, mv, canExt, apS] of sideDefs) {
    const crowdS = nz(pyRound(pyMax(-qv, 0.0), 2));
    const spaceS = nz(pyRound(pyMax(qv, 0.0), 2));
    const midS = pyRound(mv || 0.0, 2);
    const demandS = pyRound(crowdS + torqueSpace / 2.0 + cosComponent / 2.0 + midS + apS, 2);
    const sideIsExt = !!(isExtPlan && canExt);
    const extS = sideIsExt ? perSideExt : 0.0;
    const supplyS = pyRound(extS + expSide + spaceS, 2);
    const leftoverS = pyRound(supplyS - demandS, 2);
    const burnS = isExtPlan ? pyRound(Math.max(leftoverS, 0.0), 2) : 0.0;
    const burnBase = sideIsExt ? perSideExt : (spaceS ? spaceS : 0.0);
    const brS = (isExtPlan && burnBase) ? pyRound(burnS / burnBase, 2) : null;
    sides.push({
      side_th: sideTh, quad: quadName, side: `${sideTh} (${quadName})`,
      crowding: crowdS, spacing: spaceS, midline: midS,
      retract: pyRound(apS, 2), demand: demandS, supply: supplyS,
      leftover: leftoverS, molar_burn: burnS, burn_ratio: brS,
      extract_here: sideIsExt,
      can_extract: !!canExt,        // ข้างนี้ยังมีพรีโมลาร์ให้ถอนไหม (ใช้ทำแผนทางเลือก)
      anchorage: isExtPlan ? anchFromBurn(brS) : '—',
    });
  }

  const recs = [];
  if (status === 'deficit') {
    recs.push(`หลังใช้แผน ${planLabel} แล้ว space ยังขาดอีก ${fmtG(deficit)} mm (ข้างละ ${fmtG(pyRound(deficit / 2, 2))}) — เพิ่ม IPR/distalize/TAD หรือทบทวน torque target แล้วยืนยันด้วย CBCT`);
  } else if (isExtPlan) {
    const retrTxt = retractionAsym
      ? `retract ขวา ${fmtG(retractionRight)} / ซ้าย ${fmtG(retractionLeft)} mm (ไม่เท่ากัน — จาก Canine relationship)`
      : `retract ข้างละ ${fmtG(retractionSide)} mm (×2 ทั้ง 2 ข้าง)`;
    recs.push(`แผน ${planLabel}: ${retrTxt} → เหลือช่องถอนข้างละ ${fmtG(molarBurnSide)} mm ให้ molar เลื่อนมาปิด (burn ${burnRatio !== null ? fmtG(pyRound(burnRatio * 100)) + '%' : '-'}) → ${anch}`);
  } else if (status === 'surplus') {
    recs.push(`แผน ${planLabel} ให้พื้นที่เหลือ ${fmtG(leftover)} mm (ข้างละ ${fmtG(leftoverSide)}) — พิจารณาลดจำนวนถอน / ปิดช่องด้วย prosthesis`);
  } else {
    recs.push(`แผน ${planLabel} — space สมดุล (เหลือ ${fmtG(leftover)} mm) ปิดช่องด้วย orthodontic space closure ตาม anchorage ที่กำหนด`);
  }

  let extNote = null;
  if (extSidesAvail < 2) {
    const missingSide = !extLeft ? 'ซ้าย' : 'ขวา';
    const keepSide = !extLeft ? 'ขวา' : 'ซ้าย';
    if (extSidesAvail === 0) {
      extNote = 'ฟันหายไปแล้วทั้ง 2 ข้างของ arch นี้ → ไม่มีซี่ให้ถอนเพิ่ม ใช้ช่องว่างเดิมเป็นแหล่งพื้นที่';
    } else {
      extNote = `ข้าง${missingSide}มีฟันหายไปแล้ว (มีช่องอยู่แล้ว) → ถ้าต้องถอน ให้ถอนเพียง 1 ซี่ ที่ข้าง${keepSide} เพื่อสมดุล ไม่ถอนซ้ำข้างที่ฟันหาย (asymmetric extraction)`;
    }
    recs.push(extNote);
  }
  if (premolarsAssumed) {
    recs.push(`[ยังไม่ได้ระบุจำนวนซี่ถอนจริง — ประมาณ ${extTeethPlanned} ซี่/arch (1 ซี่/ข้างที่ยังมีฟัน) กรุณายืนยัน]`);
  }

  const retrDetail = retractionAsym
    ? `ขวา ${fmtG(retractionRight)} + ซ้าย ${fmtG(retractionLeft)}`
    : `ข้างละ ${fmtG(retractionSide)} ×2`;
  const reason = `ต้องการสุทธิ ${fmtG(netRequired)} mm (เก ${fmtG(crowding)} + COS ${fmtG(pyRound(cosComponent, 2))} + midline ${fmtG(pyRound(midlineSpace, 2))} + torque(FACC→0) ${fmtGSigned(pyRound(torqueSpace, 2))} + retract ${fmtG(retractionTotal)} [${retrDetail}]) `
    + `− แผน ${planLabel} ให้ ${fmtG(planSupply)} mm → ดุล ${fmtFSigned(balance, 2)} mm (ข้างละ ${fmtFSigned(leftoverSide, 2)}) → ${anch}`;

  return {
    arch, decision_basis: decision,
    spacing_extra: spacingExtra, crowding, cos: pyRound(cosComponent, 2),
    midline: pyRound(midlineSpace, 2), torque_space: pyRound(torqueSpace, 2),
    expansion_gain: expansion, ap_need: pyRound(apNeed, 2),
    retraction_side: retractionSide, retraction_total: retractionTotal,
    retraction_right: retractionRight, retraction_left: retractionLeft,
    retraction_asym: retractionAsym,
    leftover_side: leftoverSide, molar_burn_side: molarBurnSide,
    burn_ratio: burnRatio, per_side_ext: perSideExt, is_ext_plan: isExtPlan,
    sides,
    side_asymmetric: (isExtPlan && Math.abs(sides[0].molar_burn - sides[1].molar_burn) > 0.5),
    structural, net_required: netRequired,
    base_supply: baseSupply, remaining,
    plan_label: planLabel, plan_sources: planSources, plan_supply: planSupply,
    ext2_space: ext2Space, options,
    ext_used: pyRound(extUsed, 2), ipr_used: pyRound(iprUsed, 2), dist_used: pyRound(distUsed, 2),
    ext_teeth_planned: extTeethPlanned, ext_sides_avail: extSidesAvail,
    ext_right_available: !!extRight, ext_left_available: !!extLeft,
    ext_note: extNote,
    balance, leftover, deficit,
    status, category: anch, appliance_recommendation: appliance,
    reason, recommendations: recs, premolars_assumed: premolarsAssumed,
    supply: planSupply, struct_demand: structural,
    space_for_ap: pyRound(planSupply - structural, 2),
    percent_used_for_retraction: null,
  };
}

/* ------------------------------------------------------------------ *
 * analyze_case
 * ------------------------------------------------------------------ */
/* เขี้ยวลง Class I ได้ไหม (กติกาคุณหมอ 21 ก.ย. 2569) — ตรงกับ ortho_calc.canine_plan
 *   1) โปรไฟล์ตัดสินทิศก่อน: E-line ริมฝีปากล่าง > 0 = ยื่น -> ดึงเขี้ยวถอย molar อยู่กับที่
 *                                             <= 0 = ปกติ -> ให้ molar เดินมาปิด
 *   2) เขี้ยวเดิน = ช่องที่ต้องปิด − molar เดินมาหน้า · ต้องการ Mu − Ml = Su − Sl − need
 *   3) เกินเพดาน molar 7 mm -> ไม่ได้ ต้อง TAD / เปลี่ยนแบบถอน / ยอมที่ x mm
 */
function caninePlan(canReq, budgetUpper, budgetLower, elineLowerLip) {
  const cap = ASSUMPTIONS.molar_protraction_max_mm;
  const out = { available: false, sides: [], profile: null, note: null, prosthesis_suggested: false };
  if (!canReq.available) { out.note = 'ไม่มีข้อมูล Canine relationship ในฟอร์ม'; return out; }
  const protr = (elineLowerLip !== null && elineLowerLip !== undefined
                 && elineLowerLip > ASSUMPTIONS.eline_protrusive_mm);
  out.profile = protr
    ? `ยื่น (E-line ล่าง ${elineLowerLip > 0 ? '+' : ''}${n2s(elineLowerLip)} mm) -> ปิดช่องด้วยการดึงฟันหน้า/เขี้ยวถอย`
    : `ปกติ/ถอย (E-line ล่าง ${elineLowerLip === null || elineLowerLip === undefined ? 'ไม่มีข้อมูล' : n2s(elineLowerLip) + ' mm'}) -> ปิดช่องด้วย molar เดินมาหน้า`;

  const space = (b, quad) => {
    const s = (b.sides || []).find((x) => x.quad === quad);
    if (!s) return 0;
    return pyRound((s.spacing || 0) + (s.extract_here ? (b.per_side_ext || 0) : 0), 2);
  };
  for (const [sideTh, uq, lq, need] of [
        ['ขวา', 'Q1', 'Q4', canReq.upper_right || 0],
        ['ซ้าย', 'Q2', 'Q3', canReq.upper_left || 0]]) {
    const su = space(budgetUpper, uq), sl = space(budgetLower, lq);
    if (su > cap + 0.01 || sl > cap + 0.01) out.prosthesis_suggested = true;
    const capU = Math.min(su, cap), capL = Math.min(sl, cap);
    const k = pyRound(su - sl - need, 2);
    let mu, ml;
    if (protr) { if (k >= 0) { mu = k; ml = 0; } else { mu = 0; ml = -k; } }
    else {
      ml = Math.min(capL, Math.max(capU - k, 0));
      mu = pyRound(ml + k, 2);
      if (mu < 0) { mu = 0; ml = pyRound(-k, 2); }
    }
    mu = pyRound(mu, 2); ml = pyRound(ml, 2);
    const short = Math.max(mu - capU, ml - capL, -mu, -ml, 0);
    out.sides.push(short > 0.01
      ? { side_th: sideTh, need: pyRound(need, 2), space_upper: su, space_lower: sl,
          molar_upper: null, molar_lower: null, feasible: false, short_mm: pyRound(short, 2),
          label: `เขี้ยวลง Class I ไม่ได้ — ขาด ${n2s(short)} mm (ต้อง TAD / เปลี่ยนแบบถอน / ยอมจบที่ ${n2s(short)} mm)` }
      : { side_th: sideTh, need: pyRound(need, 2), space_upper: su, space_lower: sl,
          molar_upper: mu, molar_lower: ml, feasible: true, short_mm: 0,
          label: `ได้ — molar บนเดินมาหน้า ${n2s(mu)} · ล่าง ${n2s(ml)} mm` });
  }
  out.available = true;
  const notes = [out.sides.every((r) => r.feasible)
    ? 'เขี้ยวลง Class I ได้ทั้งสองข้างภายใต้ทิศที่โปรไฟล์กำหนด'
    : 'เขี้ยวลง Class I ไม่ได้ทุกข้าง — ดูรายข้าง'];
  if (out.prosthesis_suggested) {
    notes.push(`มีควอดรันต์ที่ช่องต้องปิดเกิน ${cap} mm — ปิดด้วยจัดฟันล้วนไม่ไหว ควรพิจารณาใส่ฟัน`);
  }
  out.note = notes.join(' · ');
  return out;
}

const n2s = (v) => (Math.round(v * 100) / 100).toFixed(2);

function analyzeCase(inp) {
  const mode = String(inp.treatment_mode || 'auto').toLowerCase();
  const ciiiFacc = (mode === 'class_iii_facc');
  const classIiForsus = (mode === 'class_ii_forsus');

  let classIii;
  if (mode === 'class_i_ii' || mode === 'class_ii_forsus') classIii = false;
  else if (mode === 'class_iii' || mode === 'class_iii_facc') classIii = true;
  else classIii = ((inp.anb !== null && inp.anb < 0) || (inp.overjet_current !== null && inp.overjet_current < 0));

  const underlyingCiii = ((inp.anb !== null && inp.anb < 0) || (inp.overjet_current !== null && inp.overjet_current < 0));
  const classIiiPlanA = (mode === 'class_i_ii') && underlyingCiii;
  const torqueType = String(inp.upper_torque_type || 'crown').toLowerCase();
  const rootTorqueUpper = (torqueType === 'root') || classIiiPlanA;

  let lowerCappedImpa = false;
  let protractionLower = 0.0, protractionNeed = 0.0, protractionShort = 0.0;
  let ciii = null, planC = null;
  let up, low, overjetFinal;

  if (!classIii && !classIiForsus) {
    const upFull = upperTorqueCorrection(inp.facc_to_fh);
    up = rootTorqueUpper
      ? { delta_u1: upFull.delta_u1, space_upper_torque_mm: 0.0, delta_overjet_mm: 0.0 }
      : upFull;
    low = lowerTorqueCorrection(inp.l1_to_mpl_box, up.delta_u1, inp.interincisal_current, inp.facc_to_fh);

    if (classIiiPlanA && low.delta_l1 > 0) {
      const impaCur = 90.0 + inp.l1_to_mpl_box;
      const maxRetro = Math.max(impaCur - ASSUMPTIONS.class3_impa_floor, 0.0);
      if (low.delta_l1 > maxRetro) {
        const dl1 = pyRound(maxRetro, 2);
        low = Object.assign({}, low, {
          delta_l1: dl1,
          space_lower_torque_mm: pyRound((dl1 / 5.0) * 1.2, 2),
          delta_overjet_mm: pyRound((dl1 / 5.0) * 1.3, 2),
          delta_l1apog_mm: nz(pyRound(-(dl1 / 5.0) * ASSUMPTIONS.l1apog_torque_coeff, 2)),
        });
        lowerCappedImpa = true;
      }
    }
    overjetFinal = pyRound(inp.overjet_current + up.delta_overjet_mm + low.delta_overjet_mm, 2);

  } else if (classIiForsus) {
    up = upperTorqueCorrection(inp.facc_to_fh);
    const iiCur = (inp.interincisal_current !== null && inp.interincisal_current !== undefined)
      ? inp.interincisal_current : estimateInterincisalCurrent(inp.facc_to_fh, inp.l1_to_mpl_box);
    const ojAfterUpper = pyRound(inp.overjet_current + up.delta_overjet_mm, 2);
    protractionNeed = pyRound(Math.max(ojAfterUpper - 2.0, 0.0), 2);
    // ดึงฟันล่างทั้งซี่มาหน้าได้ไม่เกิน protraction_max_mm (procline ไม่ติดเพดานนี้)
    protractionLower = pyRound(Math.min(protractionNeed, ASSUMPTIONS.protraction_max_mm), 2);
    protractionShort = pyRound(protractionNeed - protractionLower, 2);
    overjetFinal = pyRound(ojAfterUpper - protractionLower, 2);
    low = {
      interincisal_current: pyRound(iiCur, 2),
      interincisal_was_estimated: (inp.interincisal_current === null || inp.interincisal_current === undefined),
      interincisal_interim_after_upper: pyRound(iiCur + up.delta_u1, 2),
      delta_l1: 0.0, space_lower_torque_mm: 0.0, delta_overjet_mm: 0.0, delta_l1apog_mm: 0.0,
    };

  } else if (ciiiFacc) {
    const iiTarget = ASSUMPTIONS.interincisal_target_default;
    const iiCur = (inp.interincisal_current !== null && inp.interincisal_current !== undefined)
      ? inp.interincisal_current : estimateInterincisalCurrent(inp.facc_to_fh, inp.l1_to_mpl_box);
    const cosL = resolveCos(inp.cos_mm, inp.cos_q3, inp.cos_q4)[0] / 2.0;
    const midL = midlineCorrectionSpace(inp.midline, 'lower');
    const expL = expansionSpaceGain(inp.arch_expansion, 'lower').total_space_gained_mm;
    const lowerStruct = totalSpaceRequired(inp.tooth_size_discrepancy_lower, cosL, 0.0, midL);
    const l1apogTmp = (inp.l1_apog_after_torque_est !== null && inp.l1_apog_after_torque_est !== undefined)
      ? inp.l1_apog_after_torque_est : inp.l1_apog_current;
    const lowerDec = spaceManagementDecision(pyRound(lowerStruct - expL, 2), l1apogTmp).decision;
    const prem = ASSUMPTIONS.avg_premolar_width_mm;
    const lowerSupply = (lowerDec === 'Extraction' ? 2 * prem : ASSUMPTIONS.ipr_max_per_arch) + expL;
    const leftoverSide = Math.max(pyRound((lowerSupply - lowerStruct) / 2.0, 2), 0.0);
    const ojGap0 = pyRound(inp.overjet_current - 2.0, 2);
    const dU1Space = (leftoverSide + ojGap0) * 5.0 / 1.7;
    let dU1 = Math.max(Math.min(inp.facc_to_fh, iiTarget - iiCur, dU1Space), 0.0);
    dU1 = pyRound(dU1, 1);
    const dOjLower = pyRound(Math.max((dU1 / 5.0) * 1.7 - ojGap0, 0.0), 2);
    up = {
      delta_u1: dU1,
      space_upper_torque_mm: pyRound((dU1 / 5.0) * 1.6, 2),
      delta_overjet_mm: nz(pyRound(-(dU1 / 5.0) * 1.7, 2)),
    };
    const iiAfter = pyRound(iiCur + dU1, 2);
    low = {
      interincisal_current: pyRound(iiCur, 2),
      interincisal_was_estimated: (inp.interincisal_current === null || inp.interincisal_current === undefined),
      interincisal_interim_after_upper: iiAfter,
      delta_l1: 0.0, space_lower_torque_mm: 0.0,
      delta_overjet_mm: pyRound(dOjLower, 2), delta_l1apog_mm: 0.0,
    };
    overjetFinal = pyRound(inp.overjet_current - (dU1 / 5.0) * 1.7 + dOjLower, 2);
    planC = {
      dU1, facc_end: pyRound(inp.facc_to_fh - dU1, 1), ii_end: iiAfter,
      d_oj_lower: dOjLower, leftover_side: leftoverSide,
      impa_current: pyRound(90 + inp.l1_to_mpl_box, 2),
      space_limited: pyRound(dU1Space, 1) <= pyRound(inp.facc_to_fh, 1),
    };

  } else {
    // Class III camouflage (แผน B) — เพดาน retrocline 2 ชั้น 85 -> 80
    const floorPrimary = ASSUMPTIONS.class3_impa_floor;
    const floorExtended = ASSUMPTIONS.class3_impa_floor_extended;
    const impaCur = pyRound(90 + inp.l1_to_mpl_box, 2);
    const dOjNeeded = pyRound(Math.max(2.0 - inp.overjet_current, 0.0), 2);

    let floor = floorPrimary;
    let retroRoom = pyRound(Math.max(impaCur - floor, 0.0), 2);
    let dOjRetroMax = pyRound((retroRoom / 5.0) * 1.3, 2);
    let floorExtendedUsed = false;
    if (dOjRetroMax < dOjNeeded) {
      const roomExt = pyRound(Math.max(impaCur - floorExtended, 0.0), 2);
      const maxExt = pyRound((roomExt / 5.0) * 1.3, 2);
      if (maxExt > dOjRetroMax) {
        floor = floorExtended; retroRoom = roomExt; dOjRetroMax = maxExt; floorExtendedUsed = true;
      }
    }

    const dOjRetro = pyRound(Math.min(dOjNeeded, dOjRetroMax), 2);
    const retroDegUsed = pyRound(Math.min(retroRoom, (dOjNeeded / 1.3) * 5.0), 2);
    const dOjBodily = pyRound(dOjNeeded - dOjRetro, 2);
    const iiCur = (inp.interincisal_current !== null && inp.interincisal_current !== undefined)
      ? inp.interincisal_current : estimateInterincisalCurrent(inp.facc_to_fh, inp.l1_to_mpl_box);

    up = { delta_u1: 0.0, space_upper_torque_mm: 0.0, delta_overjet_mm: 0.0 };
    low = {
      interincisal_current: pyRound(iiCur, 2),
      interincisal_was_estimated: (inp.interincisal_current === null || inp.interincisal_current === undefined),
      interincisal_interim_after_upper: pyRound(iiCur, 2),
      // เครื่องหมายต้องตรงกับกติกากลาง (ortho_calc.js บรรทัด 235): "+ = retrocline (upright)"
      // เดิมเขียน -retroDegUsed โดยนิยามกลับด้าน -> ปลายทางอ่านผิดเป็น "procline":
      // interincisal จบหักลบแทนที่จะบวก และตารางแดงกรอกลงคอลัมน์ Pro แทน Re
      delta_l1: nz(retroDegUsed),
      // retrocline กินพื้นที่เหมือน Class I/II (18 ก.ย. 2569)
      space_lower_torque_mm: pyRound((retroDegUsed / 5.0) * 1.2, 2),
      delta_overjet_mm: pyRound(dOjRetro, 2),
      delta_l1apog_mm: nz(pyRound(-(retroDegUsed / 5.0) * ASSUMPTIONS.l1apog_torque_coeff, 2)),
    };
    overjetFinal = pyRound(inp.overjet_current + dOjRetro + dOjBodily, 2);
    ciii = {
      impa_current: impaCur, impa_floor: floor,
      impa_floor_primary: floorPrimary, impa_floor_extended: floorExtended,
      floor_extended_used: floorExtendedUsed, d_oj_needed: dOjNeeded,
      retro_deg: retroDegUsed, d_oj_retro: dOjRetro, d_oj_bodily: dOjBodily,
    };
  }

  const overjetResidualGap = pyRound(2.0 - overjetFinal, 2);

  const midlineUpper = midlineCorrectionSpace(inp.midline, 'upper');
  const midlineLower = midlineCorrectionSpace(inp.midline, 'lower');
  const [cosEffective, cosDetail] = resolveCos(inp.cos_mm, inp.cos_q3, inp.cos_q4);
  const cosComponentLower = pyRound(cosEffective / 2.0, 2);

  const totalUpper = totalSpaceRequired(inp.tooth_size_discrepancy_upper, 0.0, up.space_upper_torque_mm, midlineUpper);
  const totalLower = totalSpaceRequired(inp.tooth_size_discrepancy_lower, cosComponentLower, low.space_lower_torque_mm, midlineLower);

  const expansionUpper = expansionSpaceGain(inp.arch_expansion, 'upper');
  const expansionLower = expansionSpaceGain(inp.arch_expansion, 'lower');
  const totalUpperAfterExp = pyRound(totalUpper - expansionUpper.total_space_gained_mm, 2);
  const totalLowerAfterExp = pyRound(totalLower - expansionLower.total_space_gained_mm, 2);

  const l1apogTorqueShift = nz(pyRound((low.delta_l1apog_mm || 0.0) + 0.0, 2));
  const l1ApogAfterTorqueComputed = pyRound(inp.l1_apog_current + l1apogTorqueShift, 2);
  const l1ApogFinal = (inp.l1_apog_after_torque_est !== null && inp.l1_apog_after_torque_est !== undefined)
    ? inp.l1_apog_after_torque_est : l1ApogAfterTorqueComputed;
  const l1ApogInRange = (1 <= l1ApogFinal && l1ApogFinal <= 3);
  let l1ApogTarget;
  if (l1ApogInRange) l1ApogTarget = l1ApogFinal;
  else if (l1ApogFinal > 3) l1ApogTarget = ASSUMPTIONS.l1_apog_target_high;
  else l1ApogTarget = ASSUMPTIONS.l1_apog_target_low;
  const l1ApogToMove = l1ApogInRange ? null : pyRound(l1ApogFinal - l1ApogTarget, 2);

  // ---- Forsus ----
  const mcn = mcnamaraReferenceAnalysis(inp);
  const { sna: _sna, snb: _snb, anb: _anb, wits: _wits, pg_to_n: _pgN, a_to_n: _aN } = inp;
  const mcnAvail = mcn.available;
  const classIiSkeletal = (!classIii) && (((_anb !== null && _anb >= 4)) || (_wits !== null && _wits > 2));

  const mandConfirm = [];
  if (_snb !== null && _snb < 78) mandConfirm.push('SNB<78');
  if (_pgN !== null && _pgN < -4) mandConfirm.push('Pg-N<-4');
  if (_wits !== null && _wits > 2) mandConfirm.push('Wits>+2');
  const maxConfirm = [];
  if (_sna !== null && _sna > 84) maxConfirm.push('SNA>84');
  if (_aN !== null && _aN > 4) maxConfirm.push('A-N>+4');

  const mcnMandSmall = !!(mcnAvail && mcn.mandible_status === 'small');
  const mcnMaxBig = !!(mcnAvail && mcn.maxilla_status === 'big');

  let mandDeficient, maxillaExcess, mandSignals, maxSignals, basis;
  if (mcnAvail) {
    mandDeficient = mcnMandSmall && mandConfirm.length >= 1;
    maxillaExcess = mcnMaxBig && maxConfirm.length >= 1;
    mandSignals = (mcnMandSmall ? ['McNamara Co-Gn small (นำ)'] : []).concat(mandConfirm);
    maxSignals = (mcnMaxBig ? ['McNamara Co-A big (นำ)'] : []).concat(maxConfirm);
    basis = 'McNamara นำ + ยืนยัน ≥1';
  } else {
    const mandPool = mandConfirm.slice();
    if (_anb !== null && _anb >= 4) mandPool.push('ANB>=4');
    mandDeficient = mandPool.length >= 2;
    maxillaExcess = maxConfirm.length >= 2;
    mandSignals = mandPool;
    maxSignals = maxConfirm.slice();
    basis = 'ไม่มี McNamara → ใช้ ≥2 ค่า';
  }

  const dentalSignal = l1ApogFinal < 1;
  const obs = dentalSignal ? '  · จุดสังเกต: L1-APog < 1 mm (ล่างตั้งตรง/ถอย)' : '';

  let forsusSubtype, forsusSubtypeLabel;
  if (!classIiSkeletal) {
    forsusSubtype = 'not_class_ii'; forsusSubtypeLabel = 'ไม่ใช่ skeletal Class II (ANB/Wits ไม่เข้าเกณฑ์)';
  } else if (mandDeficient && maxillaExcess) {
    forsusSubtype = 'both'; forsusSubtypeLabel = 'แบบ 3: Maxilla ใหญ่ + Mandible เล็ก';
  } else if (maxillaExcess) {
    forsusSubtype = 'max_excess'; forsusSubtypeLabel = 'แบบ 1: Maxilla ใหญ่ / Mandible ปกติ';
  } else if (mandDeficient) {
    forsusSubtype = 'mand_deficiency'; forsusSubtypeLabel = 'แบบ 2: Maxilla ปกติ / Mandible เล็ก (McNamara นำ + ยืนยัน)';
  } else {
    forsusSubtype = 'indeterminate'; forsusSubtypeLabel = 'Class II แต่ McNamara ยังไม่ยืนยัน mand เล็ก';
  }

  const sigTxt = `[${basis} · สัญญาณ mand เล็ก: ${mandSignals.length ? mandSignals.join(', ') : 'ไม่พบ'}]`;
  let forsusNeeded, forsusNote;
  if (forsusSubtype === 'mand_deficiency' || forsusSubtype === 'both') {
    forsusNeeded = true;
    forsusNote = forsusSubtype === 'both'
      ? ('เข้าเงื่อนไข Forsus (บางส่วน) — Skeletal Class II แบบ 3 (max ใหญ่ + mand เล็ก): '
        + 'Forsus แก้ส่วน mandibular deficiency ได้ แต่ maxillary excess ต้องจัดการแยก '
        + `(headgear / camouflage-extraction / ผ่าตัด). ${sigTxt}${obs} · `
        + 'เหมาะกับคนไข้ที่ยังโตอยู่ (growing) — ยืนยัน growth ที่เหลือด้วยอายุ/CVM ก่อนใช้')
      : ('เข้าเงื่อนไข Forsus — Skeletal Class II จาก mandibular deficiency '
        + `(McNamara Co-Gn เล็ก เป็นตัวนำ + ยืนยันอีก ≥1 ค่า). ${sigTxt}${obs} · `
        + 'Forsus / functional appliance ดันขากรรไกรล่างมาหน้า · '
        + 'เหมาะกับคนไข้ที่ยังโตอยู่ (growing) — ยืนยัน growth ที่เหลือด้วยอายุ/CVM ก่อนใช้');
  } else if (forsusSubtype === 'max_excess') {
    forsusNeeded = false;
    forsusNote = 'Skeletal Class II จาก maxillary excess (max ใหญ่ / mand ปกติ) — Forsus ไม่เหมาะ '
      + '(ดันล่างมาหน้าไม่แก้ maxilla ที่ยื่น). พิจารณา headgear / camouflage-extraction / ผ่าตัดแทน' + obs;
  } else if (forsusSubtype === 'indeterminate') {
    forsusNeeded = false;
    forsusNote = `Skeletal Class II แต่ McNamara ยังไม่ยืนยัน mand เล็ก (หรือยืนยันไม่ครบ) ${sigTxt} — `
      + `ยังไม่สรุป Forsus, แนะนำตรวจ McNamara (Co-A/Co-Gn) · Pg-N · SNB เพิ่ม${obs}`;
  } else {
    forsusNeeded = false;
    forsusNote = 'ไม่ใช่ skeletal Class II — ไม่เข้าเงื่อนไข Forsus'
      + (dentalSignal ? `${obs} (เป็นข้อสังเกตทางทันตกรรมเท่านั้น)` : '');
  }

  // ---- A-P demand ----
  let totalAp, lowerAp, upperAp;
  if (ciiiFacc) {
    totalAp = planC.d_oj_lower; lowerAp = planC.d_oj_lower; upperAp = 0.0;
  } else if (classIii) {
    totalAp = ciii.d_oj_bodily; lowerAp = ciii.d_oj_bodily; upperAp = 0.0;
  } else if (classIiForsus) {
    totalAp = 0.0; lowerAp = 0.0; upperAp = 0.0;
  } else {
    totalAp = pyRound(Math.max(overjetFinal - 2.0, 0.0), 2);
    // L1-APog กำหนดตำแหน่งฟันล่างก่อน — ไม่ถูก cap ด้วยระยะแก้ overjet (18 ก.ย. 2569)
    if (l1ApogFinal > ASSUMPTIONS.l1_apog_target_high) {
      lowerAp = pyRound(Math.max(l1ApogFinal - l1ApogTarget, 0.0), 2);
    } else {
      lowerAp = 0.0;
    }
    // ทิศ overjet ต้องตรงกับขั้น torque: ดึงฟันล่างถอย -> OJ เพิ่มอีก lowerAp
  // ฟันบนจึงต้องถอยชดเชยด้วย เพื่อคุม OJ = 2 ตลอด (ตรงกับ ortho_calc.py)
  //   OJ_จบ = overjetFinal + lowerAp - upperAp = 2
  upperAp = pyRound(Math.max(overjetFinal - 2.0 + lowerAp, 0.0), 2);
  }

  // ---- Canine ----
  const canReq = canineRequirement(inp.canine_relationship);
  const canineApplies = !(classIiForsus || ciiiFacc);
  let upperApRight, upperApLeft, lowerApRight, lowerApLeft;
  if (canineApplies && canReq.available) {
    upperApRight = pyRound(Math.max(upperAp, canReq.upper_right), 2);
    upperApLeft = pyRound(Math.max(upperAp, canReq.upper_left), 2);
    lowerApRight = pyRound(Math.max(lowerAp, canReq.lower_right), 2);
    lowerApLeft = pyRound(Math.max(lowerAp, canReq.lower_left), 2);
  } else {
    upperApRight = upperApLeft = upperAp;
    lowerApRight = lowerApLeft = lowerAp;
  }
  canReq.applies = !!(canineApplies && canReq.available);
  canReq.skipped_reason = canineApplies ? null
    : (classIiForsus ? 'แผน Forsus: Class II แก้ด้วยการดันขากรรไกรล่างมาหน้า ไม่ได้ใช้ช่องถอน'
      : 'แผน C (Class III & FACC): ช่องล่างถูกใช้สร้าง OJ ให้ฟันบนอยู่แล้ว');
  canReq.oj_retract_side = pyRound(upperAp, 2);
  canReq.upper_retract_right = upperApRight;
  canReq.upper_retract_left = upperApLeft;
  canReq.lower_retract_right = lowerApRight;
  canReq.lower_retract_left = lowerApLeft;
  const canDrive = pyRound(Math.max(upperApRight, upperApLeft) - upperAp, 2);
  canReq.canine_drives_by_mm = canDrive > 0.01 ? canDrive : 0.0;
  // OJ ที่จะจบจริง = OJ หลัง torque + (ดึงล่าง ทำให้เพิ่ม) − (ดึงบน ทำให้ลด)
  canReq.overjet_if_canine_driven = canDrive > 0.01
    ? pyRound(overjetFinal + Math.max(lowerApRight, lowerApLeft)
              - Math.max(upperApRight, upperApLeft), 2) : null;

  // ---- ฟันที่หายไป ----
  const sd = inp.space_discrepancy;
  const missingQuads = new Set();
  for (let t of (inp.missing_teeth || [])) {
    t = String(t).trim();
    if (t.length === 2 && '1234'.includes(t[0]) && '45'.includes(t[1])) missingQuads.add(t[0]);
  }

  const mkBudgets = (uAp, uR, uL, lAp, lR, lL) => [
    spaceBudget('upper', null, inp.premolars_extracted_upper,
      expansionUpper.total_space_gained_mm, inp.tooth_size_discrepancy_upper,
      0.0, midlineUpper, up.space_upper_torque_mm, uAp, {
        qRight: sd.q1, qLeft: sd.q2, midRight: inp.midline.q1, midLeft: inp.midline.q2,
        forceNonExt: classIiForsus,
        extRight: !missingQuads.has('1'), extLeft: !missingQuads.has('2'),
        apNeedRight: uR, apNeedLeft: uL,
      }),
    spaceBudget('lower', null, inp.premolars_extracted_lower,
      expansionLower.total_space_gained_mm, inp.tooth_size_discrepancy_lower,
      cosComponentLower, midlineLower, low.space_lower_torque_mm, lAp, {
        qRight: sd.q4, qLeft: sd.q3, midRight: inp.midline.q4, midLeft: inp.midline.q3,
        forceNonExt: classIiForsus, protractionSupplyIn: protractionLower,
        extRight: !missingQuads.has('4'), extLeft: !missingQuads.has('3'),
        apNeedRight: lR, apNeedLeft: lL,
      }),
  ];

  let [budgetUpper, budgetLower] = mkBudgets(upperAp, upperApRight, upperApLeft,
                                             lowerAp, lowerApRight, lowerApLeft);

  // ด่านตรวจ L1-APog กับ IPR — ตรงกับ ortho_calc.py
  // ดึงฟันล่างให้ L1-APog = 3 ทำให้ฟันบนต้องถอยชดเชยด้วย งบตึงทั้งสอง arch
  // ถ้าต้องแลกด้วย IPR เกินเพดาน -> ไม่ดึงเพิ่ม ยอมรับ L1-APog หลัง torque
  let l1apogRetractSkipped = false;
  if (lowerAp > 0.01 && !ciii && !ciiiFacc && !classIiForsus) {
    const iprNeeded = Math.max(budgetUpper.ipr_used || 0, budgetLower.ipr_used || 0);
    if (iprNeeded > ASSUMPTIONS.l1apog_ipr_guard_mm) {
      upperAp = pyRound(Math.max(overjetFinal - 2.0, 0.0), 2);
      if (canineApplies && canReq.available) {
        upperApRight = pyRound(Math.max(upperAp, canReq.upper_right), 2);
        upperApLeft = pyRound(Math.max(upperAp, canReq.upper_left), 2);
        lowerApRight = pyRound(canReq.lower_right, 2);
        lowerApLeft = pyRound(canReq.lower_left, 2);
      } else {
        upperApRight = upperApLeft = upperAp;
        lowerApRight = lowerApLeft = 0.0;
      }
      lowerAp = 0.0;
      l1apogRetractSkipped = true;
      canReq.oj_retract_side = pyRound(upperAp, 2);
      canReq.upper_retract_right = upperApRight;
      canReq.upper_retract_left = upperApLeft;
      canReq.lower_retract_right = lowerApRight;
      canReq.lower_retract_left = lowerApLeft;
      const canDrive2 = pyRound(Math.max(upperApRight, upperApLeft) - upperAp, 2);
      canReq.canine_drives_by_mm = canDrive2 > 0.01 ? canDrive2 : 0.0;
      canReq.overjet_if_canine_driven = canDrive2 > 0.01
        ? pyRound(overjetFinal + Math.max(lowerApRight, lowerApLeft)
                  - Math.max(upperApRight, upperApLeft), 2) : null;
      [budgetUpper, budgetLower] = mkBudgets(upperAp, upperApRight, upperApLeft,
                                             lowerAp, lowerApRight, lowerApLeft);
    }
  }

  // ---- OJ ที่ทำนายว่าจะจบจริง (คุณหมอ 23 ก.ย. 2569: รายงานต้องโชว์ค่านี้ ไม่ใช่เป้า 2) ----
  // Class I/II (+ Plan A): OJ หลัง torque + ดึงล่างถอย − ดึงบนถอย · Class III/Forsus: ค่าจบของโหมด
  const overjetEnd = (classIii || classIiForsus) ? overjetFinal
    : pyRound(overjetFinal + Math.max(lowerApRight, lowerApLeft)
              - Math.max(upperApRight, upperApLeft), 2);

  // ---- ตัดสินแผน (เกณฑ์เดียว: พื้นที่ที่ยังขาด) ----
  const planUpper = spaceManagementDecision(budgetUpper.remaining, l1ApogFinal, totalUpperAfterExp);
  const planLower = spaceManagementDecision(budgetLower.remaining, l1ApogFinal, totalLowerAfterExp);
  planUpper.asymmetric_note = asymmetricAnchorageNote(inp.midline, 'upper', planUpper.decision);
  planLower.asymmetric_note = asymmetricAnchorageNote(inp.midline, 'lower', planLower.decision);
  budgetUpper.decision_basis = planUpper.decision;
  budgetLower.decision_basis = planLower.decision;

  const molarFinish = predictMolarFinish(inp.molar_relationship, budgetUpper, budgetLower);
  if (String(inp.molar_target || 'follow').toLowerCase() === 'class_i') {
    molarFinish.target_forced_class_i = true;
    molarFinish.note = (molarFinish.note || '')
      + ' · ทันตแพทย์บังคับเป้า molar = Class I -> ส่วนต่างที่เหลือต้องแก้ด้วย '
      + 'distalize บน / protract ล่าง / ปรับแบบถอน';
  } else {
    molarFinish.target_forced_class_i = false;
  }

  const overjetPlan = overjetTargetPlan(inp.overjet_current, up.delta_overjet_mm, low.delta_overjet_mm,
    overjetFinal, overjetResidualGap, inp.facc_to_fh, budgetUpper, budgetLower);

  const interincisalEnd = pyRound(low.interincisal_interim_after_upper + low.delta_l1, 1);
  let faccEnd;
  if (!classIii) faccEnd = 0.0;
  else if (ciiiFacc) faccEnd = planC.facc_end;
  else faccEnd = inp.facc_to_fh;

  let needsSurgery;
  if (classIiiPlanA) {
    needsSurgery = (pyRound(2.0 - overjetFinal, 2) > 0.5)
      || (interincisalEnd < ASSUMPTIONS.interincisal_range_low);
  } else {
    needsSurgery = overjetFinal < ASSUMPTIONS.surgery_reverse_oj_threshold;
  }

  const result = {
    patient: { name: inp.patient_name, dn: inp.dn, age: inp.age, date: inp.date },
    input_summary: {
      sna: inp.sna, snb: inp.snb, anb: inp.anb, sn_gogn: inp.sn_gogn, fma: inp.fma,
      facc_to_fh: inp.facc_to_fh,
      l1_to_mpl_box: inp.l1_to_mpl_box,
      l1_to_mpl_absolute: pyRound(90 + inp.l1_to_mpl_box, 2),
      interincisal_current: low.interincisal_current,
      interincisal_estimated: low.interincisal_was_estimated,
      l1_apog_current: inp.l1_apog_current,
      cos_mm: cosEffective, cos_detail: cosDetail,
      overjet_current: inp.overjet_current, overbite_current: inp.overbite_current,
      eline_upper_lip: inp.eline_upper_lip, eline_lower_lip: inp.eline_lower_lip,
      tooth_size_discrepancy_upper: inp.tooth_size_discrepancy_upper,
      tooth_size_discrepancy_lower: inp.tooth_size_discrepancy_lower,
      midline_raw: Object.assign({}, inp.midline),
      arch_width_data_available: inp.arch_width_data_available,
      wits: inp.wits, u1_sn: inp.u1_sn, u1_pp: inp.u1_pp,
      fh_to_fop: inp.fh_to_fop, y_axis: inp.y_axis, u1_to_na: inp.u1_to_na, sn_to_ppl: inp.sn_to_ppl,
      arch_width: {
        intercanine_upper: inp.arch_width_intercanine_upper,
        intercanine_lower: inp.arch_width_intercanine_lower,
        intermolar_upper: inp.arch_width_intermolar_upper,
        intermolar_lower: inp.arch_width_intermolar_lower,
        any_data: [inp.arch_width_intercanine_upper, inp.arch_width_intercanine_lower,
          inp.arch_width_intermolar_upper, inp.arch_width_intermolar_lower]
          .some(v => v !== null && v !== undefined),
      },
    },
    phase1: {
      upper: Object.assign({}, up, {
        tsd: inp.tooth_size_discrepancy_upper, cos_component: 0.0,
        midline_space: midlineUpper, total_space_required: totalUpper,
        expansion: expansionUpper, total_after_expansion: totalUpperAfterExp,
      }),
      lower: Object.assign({}, low, {
        tsd: inp.tooth_size_discrepancy_lower, cos_component: cosComponentLower,
        midline_space: midlineLower, total_space_required: totalLower,
        expansion: expansionLower, total_after_expansion: totalLowerAfterExp,
      }),
      overjet_final_estimate: overjetFinal,
      overjet_residual_gap: overjetResidualGap,
    },
    phase2: {
      l1_apog_current: inp.l1_apog_current,
      l1_apog_torque_shift_mm: l1apogTorqueShift,
      l1_apog_after_torque_est: l1ApogFinal,
      l1_apog_clinician_override: (inp.l1_apog_after_torque_est !== null && inp.l1_apog_after_torque_est !== undefined),
      target_range: '1-3 mm',
      in_range: l1ApogInRange,
      amount_to_move_mm: l1ApogToMove,
    },
    treatment_plan: { upper: planUpper, lower: planLower },
    forsus: {
      needed: forsusNeeded, note: forsusNote,
      subtype: forsusSubtype, subtype_label: forsusSubtypeLabel,
      mand_signals: mandSignals, max_signals: maxSignals,
    },
    mcnamara: mcn,
    canine: canReq,
    canine_plan: caninePlan(canReq, budgetUpper, budgetLower, inp.eline_lower_lip),
    molar_finish: molarFinish,
    growth_appliance_advice: growthApplianceAdvice(inp.growth_pattern),
    eline_advice: elineAdvice(inp.eline_upper_lip, inp.eline_lower_lip),
    anchorage: { upper: budgetUpper, lower: budgetLower },
    space_budget: { upper: budgetUpper, lower: budgetLower, overjet_final_estimate: overjetFinal, overjet_target: 2.0 },
    overjet_overbite_table: {
      overjet: {
        before: inp.overjet_current, after_estimate: overjetFinal, target: 2.0,
        note: overjetFinal > 2.5
          ? `Overjet หลัง torque = ${fmtF(overjetFinal, 2)}mm > เป้า 2mm → ต้อง retract อีก ${fmtF(overjetFinal - 2, 2)}mm (en-masse, กินช่องถอน 2 ข้าง ตาม anchorage)`
          : (overjetFinal < 1.5
            ? `Overjet หลัง torque = ${fmtF(overjetFinal, 2)}mm < เป้า 2mm → การแก้ FACC→0 ทำให้ overjet ต่ำ/reverse ต้อง advance/procline ฟันหน้า (ไม่กินช่องถอน 2 ข้าง) หรือทบทวน torque target — space A-P ตั้ง = 0`
            : 'Overjet หลัง torque เข้าใกล้เป้า 2mm ไม่ต้องเคลื่อน A-P เพิ่ม'),
      },
      overbite: { before: inp.overbite_current, after_estimate: null, note: 'ประมาณจาก COS leveling และ growth pattern — ระบุเป็นช่วง ไม่ใช่ตัวเลขสัมบูรณ์' },
      how_to_reach_target: overjetPlan.steps,
      how_to_warn: overjetPlan.warn,
    },
    midline: Object.assign({}, inp.midline),
    mode: ciiiFacc ? 'class_iii_facc' : (classIii ? 'class_iii' : 'class_i_ii'),
    class_iii: ciii,
    dentition: { standard: '#16–26 (บน) · #36–46 (ล่าง)', missing: (inp.missing_teeth || []).slice() },
    working: {
      facc_current: inp.facc_to_fh,
      delta_u1: up.delta_u1,
      space_upper_torque: up.space_upper_torque_mm,
      crowding_upper: pyRound(pyMax(-inp.tooth_size_discrepancy_upper, 0.0), 2),
      delta_oj_upper: up.delta_overjet_mm,
      oj_before: inp.overjet_current,
      oj_interim_after_upper: pyRound(inp.overjet_current + up.delta_overjet_mm, 2),
      ii_current: low.interincisal_current,
      ii_estimated: low.interincisal_was_estimated,
      ii_after_upper: low.interincisal_interim_after_upper,
      ii_target: ASSUMPTIONS.interincisal_target_default,
      ii_range_low: ASSUMPTIONS.interincisal_range_low,
      ii_range_high: ASSUMPTIONS.interincisal_range_high,
      ii_goal: (low.interincisal_goal !== undefined ? low.interincisal_goal : null),
      ii_already_in_range: (low.interincisal_already_in_range !== undefined ? low.interincisal_already_in_range : null),
      delta_l1: low.delta_l1,
      space_lower_torque: low.space_lower_torque_mm,
      delta_oj_lower: low.delta_overjet_mm,
      delta_l1apog_lower: low.delta_l1apog_mm || 0.0,
      l1apog_before_torque: inp.l1_apog_current,
      impa_current: pyRound(90 + inp.l1_to_mpl_box, 2),
      oj_after_torque: overjetFinal,
      oj_target: 2.0,
      oj_residual: overjetResidualGap,
      l1apog_current: l1ApogFinal,
      l1apog_in_range: l1ApogInRange,
      l1apog_move: l1ApogToMove,
      retract_total: totalAp,
      retract_bilateral: pyRound(2 * totalAp, 2),
      retract_upper: upperAp,
      retract_lower: lowerAp,
      midline_upper: midlineUpper,
      midline_lower: midlineLower,
    },
    endpoint: {
      facc: pyRound(faccEnd, 1),
      facc_kept: (classIii && !ciiiFacc),
      interincisal: interincisalEnd,
      interincisal_target: ASSUMPTIONS.interincisal_target_default,
      interincisal_range_low: ASSUMPTIONS.interincisal_range_low,
      interincisal_range_high: ASSUMPTIONS.interincisal_range_high,
      interincisal_in_range: (ASSUMPTIONS.interincisal_range_low <= interincisalEnd
        && interincisalEnd <= ASSUMPTIONS.interincisal_range_high),
      interincisal_capped: lowerCappedImpa,
      // ค่าที่โชว์ = OJ ที่ทำนายว่าจะจบจริง · เคสผ่าตัดจบที่เป้าหลังผ่า
      overjet: needsSurgery ? 2.0 : overjetEnd,
      overjet_target: 2.0,
      overjet_ortho_phase: overjetEnd,
      overjet_off_target: !needsSurgery && Math.abs(overjetEnd - 2.0) > 0.5,
      needs_surgery: needsSurgery,
      // ด่าน IPR สั่งไม่ให้ดึงเพิ่ม -> ค่าที่จะจบคือค่าหลัง torque ตามจริง
      l1_apog: (l1ApogInRange || l1apogRetractSkipped) ? pyRound(l1ApogFinal, 1) : l1ApogTarget,
      l1_apog_retract_skipped: l1apogRetractSkipped,
      l1_apog_current: l1ApogFinal,
      l1_apog_in_range: l1ApogInRange,
      l1_apog_move: (l1ApogInRange || l1apogRetractSkipped) ? 0.0 : pyRound(l1ApogFinal - l1ApogTarget, 2),
    },
    plan_a_root_torque: classIiiPlanA,
    root_torque_upper: rootTorqueUpper,
    upper_torque_type: torqueType,
    lower_capped_impa: lowerCappedImpa,
    class_ii_forsus: classIiForsus,
    forsus_plan2: {
      protraction_lower_mm: pyRound(protractionLower, 2),
      protraction_need_mm: pyRound(protractionNeed, 2),
      protraction_short_mm: pyRound(protractionShort, 2),
      protraction_capped: protractionShort > 0.01,
      protraction_max_mm: ASSUMPTIONS.protraction_max_mm,
      distalize_upper_default_mm: ASSUMPTIONS.distalize_default_mm,
    },
  };

  // --- Diagnosis: ให้แอพแสดงเหมือนรายงาน PDF (คุณหมอสั่ง 22 ก.ย. 2569) ---
  // ใช้ autoDiagnosis ชุดเดียวกับ Python แล้วต่อท้ายด้วยสรุปหัวข้อ 1 (McNamara)
  // เฉพาะเมื่อมีค่า Co-A/Co-Gn — ตรงกับที่ generate_report.py ทำ
  let dx = (inp.diagnosis && String(inp.diagnosis).trim()) || autoDiagnosis(inp);
  if (mcn && mcn.available) {
    const refLine = 'McNamara: ' + mcn.summary + ' (ref = ' + mcn.ref_label + ')';
    dx = dx ? (dx + ' · ' + refLine) : refLine;
  }
  result.diagnosis = dx;

  return result;
}

export { spaceBudget, analyzeCase, autoDiagnosis };
