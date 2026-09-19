/**
 * ตัวนับการใช้งาน — SCA App + Ceph Protractor
 * ผูกกับชีต "สถิติการใช้งาน — SCA App + Ceph Protractor"
 *
 * วิธีใช้
 *   1) Deploy > New deployment > Web app
 *      Execute as: Me   ·   Who has access: Anyone
 *   2) เอา URL ที่ลงท้ายด้วย /exec ไปใส่ในหน้าเว็บทั้งสองแอป
 *   3) รันฟังก์ชัน setup() หนึ่งครั้ง เพื่อสร้างแท็บ log + สรุป
 *
 * ไม่มีการเก็บข้อมูลคนไข้ เก็บแค่ชื่อแอป · ชนิดเหตุการณ์ · รหัสแท็บสุ่ม
 */
var TZ = 'Asia/Bangkok';
var LOG = 'log';
var SUM = 'สรุป';
var HEAD = ['เวลา (ไทย)', 'วันที่', 'app', 'event', 'detail', 'session', 'เวลาที่ชีตรับ'];

function logSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(LOG);
  if (!sh) {
    sh = ss.insertSheet(LOG);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e) {
  return record_(e);
}
function doGet(e) {
  return record_(e);
}

function record_(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var now = new Date();
    logSheet_().appendRow([
      String(p.t || '').slice(0, 30) || Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
      String(p.app || 'unknown').slice(0, 20),
      String(p.event || 'open').slice(0, 20),
      String(p.detail || '').slice(0, 60),
      String(p.session || '').slice(0, 40),
      Utilities.formatDate(now, TZ, 'd/M/yyyy, HH:mm:ss')
    ]);
  } catch (err) {}
  return ContentService.createTextOutput('ok');
}

/** รันครั้งเดียว — สร้างแท็บ log และแท็บสรุปพร้อมสูตร */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  logSheet_();
  var sh = ss.getSheetByName(SUM);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(SUM, 0);

  var L = "'" + LOG + "'!";
  var rows = [];
  rows.push(['สถิติการใช้งาน — SCA App + Ceph Protractor', '', '']);
  rows.push(['อัปเดตอัตโนมัติทุกครั้งที่เปิดชีต', '', '']);
  rows.push(['', '', '']);
  rows.push(['', 'SCA App', 'Ceph Protractor']);
  rows.push(['ผู้ใช้ทั้งหมด (นับแท็บที่ไม่ซ้ำ)',
    '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"sca")',
    '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"ceph")']);
  rows.push(['จำนวนครั้งที่เปิดเว็บ',
    '=COUNTIFS(' + L + 'C2:C,"sca",' + L + 'D2:D,"open")',
    '=COUNTIFS(' + L + 'C2:C,"ceph",' + L + 'D2:D,"open")']);
  rows.push(['ใช้งานวันนี้ (แท็บไม่ซ้ำ)',
    '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"sca",' + L + 'B2:B,TEXT(TODAY(),"yyyy-mm-dd"))',
    '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"ceph",' + L + 'B2:B,TEXT(TODAY(),"yyyy-mm-dd"))']);
  rows.push(['ใช้งาน 7 วันล่าสุด (แท็บไม่ซ้ำ)',
    '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"sca",' + L + 'B2:B,">="&TEXT(TODAY()-6,"yyyy-mm-dd"))',
    '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"ceph",' + L + 'B2:B,">="&TEXT(TODAY()-6,"yyyy-mm-dd"))']);
  rows.push(['', '', '']);
  rows.push(['เฉพาะ SCA App', '', '']);
  rows.push(['กรอกรหัสถูก', '=COUNTIFS(' + L + 'C2:C,"sca",' + L + 'D2:D,"gate",' + L + 'E2:E,"ok")', '']);
  rows.push(['กรอกรหัสผิด', '=COUNTIFS(' + L + 'C2:C,"sca",' + L + 'D2:D,"gate",' + L + 'E2:E,"fail")', '']);
  rows.push(['คนที่ผ่านรหัสได้ (ไม่ซ้ำ)',
    '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"sca",' + L + 'D2:D,"gate",' + L + 'E2:E,"ok")', '']);
  rows.push(['อัปโหลดไฟล์ xlsx', '=COUNTIFS(' + L + 'C2:C,"sca",' + L + 'D2:D,"xlsx")', '']);
  rows.push(['คำนวณแผนสำเร็จ', '=COUNTIFS(' + L + 'C2:C,"sca",' + L + 'D2:D,"calc")', '']);
  rows.push(['คนที่เคยคำนวณจริง (ไม่ซ้ำ)',
    '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"sca",' + L + 'D2:D,"calc")', '']);
  rows.push(['', '', '']);
  rows.push(['รายวัน (ใหม่สุดอยู่บน)', '', '']);
  rows.push(['วันที่', 'SCA — แท็บไม่ซ้ำ', 'Ceph — แท็บไม่ซ้ำ']);

  sh.getRange(1, 1, rows.length, 3).setValues(rows);

  var r = rows.length + 1;
  sh.getRange(r, 1).setFormula(
    '=LET(d, SORT(UNIQUE(FILTER(' + L + 'B2:B, ' + L + 'B2:B<>"")),1,FALSE), ' +
    'IFERROR(HSTACK(d, ' +
    'MAP(d, LAMBDA(x, COUNTUNIQUEIFS(' + L + 'F2:F, ' + L + 'B2:B, x, ' + L + 'C2:C, "sca"))), ' +
    'MAP(d, LAMBDA(x, COUNTUNIQUEIFS(' + L + 'F2:F, ' + L + 'B2:B, x, ' + L + 'C2:C, "ceph")))), ""))');

  sh.getRange('A1').setFontSize(14).setFontWeight('bold');
  sh.getRange('A4:C4').setFontWeight('bold');
  sh.getRange('A11').setFontWeight('bold');
  sh.getRange(rows.length, 1, 1, 3).setFontWeight('bold');
  sh.getRange('A5:A9').setFontWeight('bold');
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 140);
  sh.setColumnWidth(3, 140);
}
