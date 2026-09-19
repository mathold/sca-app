#!/usr/bin/env python3
"""เลื่อนเลขเวอร์ชันของแอพให้อัตโนมัติ — ไม่ต้องแก้มือ 2 ที่อีกต่อไป

แก้ให้พร้อมกัน:
  sw.js          const VERSION = 'NN'        -> ชื่อแคช sca-vNN
  src/report.js  APP_VERSION / APP_UPDATED   -> เลขที่โชว์บนหน้าจอและในรายงานที่พิมพ์

ใช้:  python3 tools/bump.py          (เลื่อนขึ้น 1 + ตั้งวันที่เป็นวันนี้)
      python3 tools/bump.py --show   (ดูเฉย ๆ ไม่แก้)

ติดตั้งให้ทำงานเองตอน commit:  python3 tools/bump.py --install-hook
"""
import datetime
import re
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SW = APP / "sw.js"
REPORT = APP / "src" / "report.js"
TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
             "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

HOOK = """#!/bin/sh
# เลื่อนเลขเวอร์ชันอัตโนมัติก่อน commit (ติดตั้งโดย tools/bump.py --install-hook)
# ข้ามชั่วคราวได้ด้วย:  SKIP_BUMP=1 git commit ...
[ -n "$SKIP_BUMP" ] && exit 0
python3 "$(git rev-parse --show-toplevel)/tools/bump.py" || exit 1
git add sw.js src/report.js
"""


def thai_today():
    d = datetime.date.today()
    return "%d %s %d" % (d.day, TH_MONTHS[d.month - 1], d.year + 543)


def current():
    m = re.search(r"const VERSION = '(\d+)'", SW.read_text(encoding="utf-8"))
    if not m:
        sys.exit("หา const VERSION ใน sw.js ไม่เจอ")
    return int(m.group(1))


def install_hook():
    hooks = subprocess.run(["git", "rev-parse", "--git-path", "hooks"],
                           cwd=APP, capture_output=True, text=True).stdout.strip()
    path = (APP / hooks) if not Path(hooks).is_absolute() else Path(hooks)
    path.mkdir(parents=True, exist_ok=True)
    f = path / "pre-commit"
    f.write_text(HOOK, encoding="utf-8")
    f.chmod(0o755)
    print("ติดตั้ง hook แล้ว: %s" % f)


def main(argv):
    if "--install-hook" in argv:
        install_hook()
        return 0

    n = current()
    if "--show" in argv:
        print("เวอร์ชันปัจจุบัน: sca-v%d" % n)
        return 0

    new = n + 1
    sw = SW.read_text(encoding="utf-8")
    SW.write_text(re.sub(r"const VERSION = '\d+'",
                         "const VERSION = '%d'" % new, sw, count=1), encoding="utf-8")

    rp = REPORT.read_text(encoding="utf-8")
    rp = re.sub(r"const APP_VERSION = '[^']*'",
                "const APP_VERSION = '1.0.%d'" % new, rp, count=1)
    rp = re.sub(r"const APP_UPDATED = '[^']*'",
                "const APP_UPDATED = '%s'" % thai_today(), rp, count=1)
    REPORT.write_text(rp, encoding="utf-8")

    print("sca-v%d -> sca-v%d · แก้ล่าสุด %s" % (n, new, thai_today()))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
