"""แปลง .xlsx เป็นโครงสร้างแบบ SheetJS เพื่อทดสอบตัวอ่านโดยไม่ต้องใช้ SheetJS จริง"""
import sys, json, openpyxl, datetime
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
ws = wb[wb.sheetnames[0]]
cells = {}
for row in ws.iter_rows(min_row=1, max_row=70, max_col=25):
    for c in row:
        if c.value is None: continue
        v = c.value
        if isinstance(v, (datetime.datetime, datetime.date)): v = v.isoformat()[:10]
        cells[c.coordinate] = {"v": v}
print(json.dumps({"SheetNames": [wb.sheetnames[0]], "Sheets": {wb.sheetnames[0]: cells}}, ensure_ascii=False))
