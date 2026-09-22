"""ดัมพ์ผลลัพธ์ทุกเคสจากเครื่องคำนวณ Python ไว้เทียบกับ JavaScript"""
import json, io, glob, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
import importlib.util
# ชี้ไปที่ checkout อื่นได้ด้วย SCA_ROOT=... (เช่น git worktree ที่กำลังแก้บั๊กอยู่)
ROOT = os.environ.get('SCA_ROOT') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
spec = importlib.util.spec_from_file_location('oc', os.path.join(ROOT, 'ortho_calc.py'))
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)

out = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'cases', '*.json'))):
    raw = json.load(io.open(f, encoding='utf-8'))
    Q, S = M.QuadrantValues, M.SideRelation
    mid = Q(**raw.pop('midline', {}))
    exp = Q(**raw.pop('arch_expansion', {}))
    sd  = Q(**raw.pop('space_discrepancy', {}))
    can = S(**(raw.pop('canine_relationship', None) or {}))
    mol = S(**(raw.pop('molar_relationship', None) or {}))
    raw.pop('diagnosis', None); raw.pop('input_flag', None); raw.pop('_comment', None)
    c = M.CaseInput(midline=mid, arch_expansion=exp, space_discrepancy=sd,
                    canine_relationship=can, molar_relationship=mol, **raw)
    res = M.analyze_case(c)
    # diagnosis ฝั่ง Python ถูกประกอบใน generate_report.py ไม่ใช่ใน analyze_case
    # ทำซ้ำตรงนี้ด้วยสูตรเดียวกัน เพื่อให้ parity ตรวจ "ข้อความ diagnosis" ด้วย
    dx = M.auto_diagnosis(c)
    mcn = res.get('mcnamara') or {}
    if mcn.get('available'):
        ref = "McNamara: %s (ref = %s)" % (mcn['summary'], mcn['ref_label'])
        dx = ("%s · %s" % (dx, ref)) if dx else ref
    res['diagnosis'] = dx
    out[os.path.basename(f)] = res

io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'py_out.json'), 'w',
        encoding='utf-8').write(json.dumps(out, ensure_ascii=False))
print("dumped %d cases" % len(out))
