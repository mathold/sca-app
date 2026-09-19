"""ดัมพ์ผลลัพธ์ทุกเคสจากเครื่องคำนวณ Python ไว้เทียบกับ JavaScript"""
import json, io, glob, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
import importlib.util
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
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
    raw.pop('diagnosis', None); raw.pop('input_flag', None)
    c = M.CaseInput(midline=mid, arch_expansion=exp, space_discrepancy=sd,
                    canine_relationship=can, molar_relationship=mol, **raw)
    out[os.path.basename(f)] = M.analyze_case(c)

io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'py_out.json'), 'w',
        encoding='utf-8').write(json.dumps(out, ensure_ascii=False))
print("dumped %d cases" % len(out))
