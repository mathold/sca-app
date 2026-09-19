#!/usr/bin/env python3
"""เปลี่ยนรหัสผ่านของแอพ — รหัสตัวจริงไม่ออกจากเครื่องนี้

พิมพ์รหัสในเทอร์มินัลของคุณหมอเอง (ไม่โชว์บนจอ) สคริปต์คำนวณ SHA-256
แล้วเขียนทับค่า PASS_HASH ใน index.html ให้ — ไม่มีรหัสตัวจริงถูกบันทึกที่ไหน

ใช้:  python3 tools/set_pass.py             ตั้งรหัสใหม่
      python3 tools/set_pass.py --deploy    ตั้งรหัส + commit + push ขึ้นเว็บให้เลย

หมายเหตุตามตรง: นี่เป็นแค่ประตูกันคนที่บังเอิญเจอลิงก์ ไม่ใช่ความปลอดภัยระดับสูง
เพราะทุกอย่างทำงานในเบราว์เซอร์ คนที่ตั้งใจและรู้วิธียังเดารหัสสั้น ๆ จากค่า hash ได้
-> ตั้งรหัสให้ยาวหน่อย และอย่าใช้รหัสซ้ำกับที่อื่น
"""
import getpass
import hashlib
import re
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
INDEX = APP / "index.html"
MIN_LEN = 8


def main(argv):
    if sys.stdin.isatty():
        pw = getpass.getpass("รหัสใหม่ (ไม่โชว์บนจอ): ")
        again = getpass.getpass("พิมพ์อีกครั้งเพื่อยืนยัน: ")
        if pw != again:
            sys.exit("สองครั้งไม่ตรงกัน — ยังไม่เปลี่ยนอะไร")
    else:                                    # เผื่อเรียกจากสคริปต์อื่น
        pw = sys.stdin.readline().rstrip("\n")

    if not pw.strip():
        sys.exit("ยังไม่ได้พิมพ์รหัส — ยังไม่เปลี่ยนอะไร")
    if len(pw) < MIN_LEN:
        sys.exit("รหัสสั้นเกินไป (ต้องอย่างน้อย %d ตัว) — ยังไม่เปลี่ยนอะไร" % MIN_LEN)

    digest = hashlib.sha256(pw.encode("utf-8")).hexdigest()
    del pw                                   # ไม่เก็บรหัสตัวจริงไว้ในหน่วยความจำต่อ

    html = INDEX.read_text(encoding="utf-8")
    new, n = re.subn(r"const PASS_HASH = '[0-9a-f]{64}'",
                     "const PASS_HASH = '%s'" % digest, html, count=1)
    if n != 1:
        sys.exit("หา PASS_HASH ใน index.html ไม่เจอ — ยังไม่เปลี่ยนอะไร")
    # กันคอมเมนต์ที่เคยเขียนรหัสจริงไว้กลับมาอีก
    new = re.sub(r"\n \* รหัสปัจจุบัน: .*", "", new)
    INDEX.write_text(new, encoding="utf-8")
    print("เปลี่ยนรหัสใน index.html แล้ว (เก็บเป็นค่า hash ไม่ใช่รหัสจริง)")

    if "--deploy" in sys.argv[1:]:
        for cmd in (["git", "add", "index.html"],
                    ["git", "commit", "-m", "gate: เปลี่ยนรหัสผ่าน"],
                    ["git", "push", "origin", "main"]):
            if subprocess.run(cmd, cwd=APP).returncode:
                sys.exit("คำสั่ง %s ไม่สำเร็จ" % " ".join(cmd))
        print("ขึ้นเว็บแล้ว — รออีกสัก 1 นาทีให้ GitHub Pages อัปเดต")
    else:
        print("ยังไม่ขึ้นเว็บ — สั่ง deploy ด้วย:")
        print("  cd %s && git add index.html && git commit -m 'gate: เปลี่ยนรหัสผ่าน' && git push" % APP)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
