#!/usr/bin/env python3
"""สร้างไฟล์สำหรับเผยแพร่เป็น Claude Artifact จาก index.html ตัวจริง

Artifact ไม่ใช่เว็บเซิร์ฟเวอร์ธรรมดา — ต้องปรับ 4 อย่าง:
  1. ห้ามมี <!DOCTYPE>/<html>/<head>/<body> (ตัวระบบใส่ให้เอง)
  2. สคริปต์ภายนอกโหลดได้เฉพาะ CDN ที่อนุญาต -> xlsx ใช้ cdnjs
  3. ไม่มี service worker / manifest / ไอคอน
  4. ไม่เอาคอมเมนต์ที่เขียนรหัสผ่านจริงติดไปด้วย

ใช้:  python3 tools/make_artifact.py <โฟลเดอร์ปลายทาง>
แล้วเผยแพร่ index.html ในโฟลเดอร์นั้นพร้อม src/*.js
"""
import re
import shutil
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"


def build(html: str) -> str:
    # 1. ตัดเปลือกเอกสาร
    html = re.sub(r"^<!DOCTYPE html>\s*<html[^>]*>\s*<head>\s*", "", html, flags=re.I)
    html = re.sub(r'\s*<meta charset="utf-8">\s*', "", html, count=1, flags=re.I)
    html = re.sub(r'\s*<meta name="viewport"[^>]*>\s*', "", html, count=1, flags=re.I)
    html = re.sub(r"\s*</head>\s*<body>\s*", "\n", html, count=1, flags=re.I)
    html = re.sub(r"\s*</body>\s*</html>\s*$", "\n", html, flags=re.I)

    # 3. ของที่ Artifact ไม่มี
    for pat in (r'\s*<link rel="manifest"[^>]*>',
                r'\s*<meta name="theme-color"[^>]*>',
                r'\s*<meta name="apple-[^"]*"[^>]*>',
                r'\s*<link rel="apple-touch-icon"[^>]*>'):
        html = re.sub(pat, "", html, flags=re.I)
    html = re.sub(r"\nif \('serviceWorker' in navigator\) \{.*?\n\}\n", "\n",
                  html, flags=re.S)

    # 2. xlsx จาก cdnjs
    html = html.replace('<script src="vendor/xlsx.full.min.js"></script>',
                        '<script src="%s"></script>' % XLSX_CDN)

    # 4. ไม่เอารหัสผ่านตัวจริงติดไปด้วย
    html = re.sub(r"\n \* รหัสปัจจุบัน: .*", "", html)
    return html


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    out = Path(argv[0])
    (out / "src").mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(
        build((APP / "index.html").read_text(encoding="utf-8")), encoding="utf-8")
    for f in ("ortho_calc.js", "analyze.js", "sca_xlsx.js", "report.js"):
        shutil.copy2(APP / "src" / f, out / "src" / f)
    print("สร้างไฟล์สำหรับ Artifact ที่ %s" % out)
    for p in sorted(out.rglob("*")):
        if p.is_file():
            print("  %-22s %6d bytes" % (p.relative_to(out), p.stat().st_size))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
