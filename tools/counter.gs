/**
 * ตัวนับการใช้งาน — SCA App + Ceph Protractor + กราฟหุ้นไทย
 * ผูกกับชีต "สถิติการใช้งาน — SCA App + Ceph Protractor"
 *   (รับ 3 แอป: sca · ceph · stock — ดูตัวแปร APPS)
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
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.read === '1') {
    var json = JSON.stringify(stats_());
    var cb = String(p.callback || '').replace(/[^A-Za-z0-9_]/g, '');
    if (cb) {
      return ContentService.createTextOutput(cb + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  return record_(e);
}

/** สรุปตัวเลขจากแท็บ log — ใช้กับหน้า stats (ไม่นับเป็นการเข้าใช้) */
function stats_() {
  var sh = logSheet_();
  var last = sh.getLastRow();
  var rows = (last > 1) ? sh.getRange(2, 1, last - 1, 7).getValues() : [];
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var d7 = Utilities.formatDate(new Date(Date.now() - 6 * 86400000), TZ, 'yyyy-MM-dd');
  var d30 = Utilities.formatDate(new Date(Date.now() - 29 * 86400000), TZ, 'yyyy-MM-dd');

  function dayKey(v) {
    return (v instanceof Date) ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v).slice(0, 10);
  }

  var APPS = ['sca', 'ceph', 'stock'];
  var out = { updated: Utilities.formatDate(new Date(), TZ, 'd/M/yyyy HH:mm'),
              apps: {}, daily: [], devices: [] };
  var dev = {};                       // รหัสเครื่อง -> จำนวนครั้งที่ใช้จริงแยกตามแอป
  var u = {};
  APPS.forEach(function (a) {
    out.apps[a] = { users: 0, opens: 0, today: 0, d7: 0,
                    gate_ok: 0, gate_fail: 0, gate_users: 0,
                    xlsx: 0, calc: 0, calc_users: 0 };
    u[a] = { all: {}, today: {}, d7: {}, gate: {}, calc: {} };
  });
  var perDay = {};

  rows.forEach(function (r) {
    var day = dayKey(r[1]), app = String(r[2]), ev = String(r[3]),
        detail = String(r[4]), sid = String(r[5]);
    if (APPS.indexOf(app) < 0) return;
    var o = out.apps[app], uu = u[app];
    if (sid) uu.all[sid] = 1;
    if (ev === 'open') {
      o.opens++;
      if (sid) {                      // นับรายเครื่อง — event 'open' = การใช้งานจริง 1 ครั้ง
        if (!dev[sid]) {
          var blank = { id: sid, total: 0, first: day, last: day };
          APPS.forEach(function (a) { blank[a] = 0; });
          dev[sid] = blank;
        }
        var dd = dev[sid];
        dd[app]++; dd.total++;
        if (day < dd.first) dd.first = day;
        if (day > dd.last) dd.last = day;
      }
    }
    if (sid && day === today) uu.today[sid] = 1;
    if (sid && day >= d7) uu.d7[sid] = 1;
    if (ev === 'gate' && detail === 'ok') { o.gate_ok++; if (sid) uu.gate[sid] = 1; }
    if (ev === 'gate' && detail === 'fail') o.gate_fail++;
    if (ev === 'xlsx') o.xlsx++;
    if (ev === 'calc') { o.calc++; if (sid) uu.calc[sid] = 1; }
    if (day >= d30) {
      if (!perDay[day]) {
        perDay[day] = {};
        APPS.forEach(function (a) { perDay[day][a] = {}; });
      }
      if (sid) perDay[day][app][sid] = 1;
    }
  });

  APPS.forEach(function (a) {
    var o = out.apps[a], uu = u[a];
    o.users = Object.keys(uu.all).length;
    o.today = Object.keys(uu.today).length;
    o.d7 = Object.keys(uu.d7).length;
    o.gate_users = Object.keys(uu.gate).length;
    o.calc_users = Object.keys(uu.calc).length;
  });

  out.devices = Object.keys(dev).map(function (k) { return dev[k]; })
                 .sort(function (a, b) { return b.total - a.total; });

  Object.keys(perDay).sort().forEach(function (d) {
    var row = { date: d };
    APPS.forEach(function (a) { row[a] = Object.keys(perDay[d][a]).length; });
    out.daily.push(row);
  });
  return out;
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
  var NC = 4;                               // จำนวนคอลัมน์: ป้าย + 3 แอป
  var rows = [];
  function row(label, a, b, c) { rows.push([label, a || '', b || '', c || '']); }
  function uniq(app, extra) {               // เครื่องไม่ซ้ำของแอปนั้น
    return '=COUNTUNIQUEIFS(' + L + 'F2:F,' + L + 'C2:C,"' + app + '"' + (extra || '') + ')';
  }
  function cnt(app, extra) {                // จำนวนครั้ง
    return '=COUNTIFS(' + L + 'C2:C,"' + app + '"' + (extra || '') + ')';
  }
  var TODAY  = ',' + L + 'B2:B,TEXT(TODAY(),"yyyy-mm-dd")';
  var LAST7  = ',' + L + 'B2:B,">="&TEXT(TODAY()-6,"yyyy-mm-dd")';
  var OPEN   = ',' + L + 'D2:D,"open"';

  row('สถิติการใช้งาน — SCA App · Ceph Protractor · กราฟหุ้นไทย');
  row('อัปเดตอัตโนมัติทุกครั้งที่เปิดชีต');
  row('');
  row('', 'SCA App', 'Ceph Protractor', 'กราฟหุ้นไทย');
  row('ผู้ใช้ทั้งหมด (นับเครื่องที่ไม่ซ้ำ)', uniq('sca'), uniq('ceph'), uniq('stock'));
  row('จำนวนครั้งที่ใช้งานจริง', cnt('sca', OPEN), cnt('ceph', OPEN), cnt('stock', OPEN));
  row('ใช้งานวันนี้ (เครื่องไม่ซ้ำ)', uniq('sca', TODAY), uniq('ceph', TODAY), uniq('stock', TODAY));
  row('ใช้งาน 7 วันล่าสุด (เครื่องไม่ซ้ำ)', uniq('sca', LAST7), uniq('ceph', LAST7), uniq('stock', LAST7));
  row('');
  row('รหัสผ่าน / การใช้งานเชิงลึก');
  row('กรอกรหัสถูก', cnt('sca', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"ok"'),
                     cnt('ceph', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"ok"'),
                     cnt('stock', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"ok"'));
  row('กรอกรหัสผิด', cnt('sca', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"fail"'),
                     cnt('ceph', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"fail"'),
                     cnt('stock', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"fail"'));
  row('คนที่ผ่านรหัสได้ (ไม่ซ้ำ)', uniq('sca', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"ok"'),
                                   uniq('ceph', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"ok"'),
                                   uniq('stock', ',' + L + 'D2:D,"gate",' + L + 'E2:E,"ok"'));
  row('อัปโหลดไฟล์ xlsx (เฉพาะ SCA)', cnt('sca', ',' + L + 'D2:D,"xlsx"'));
  row('คำนวณแผนสำเร็จ (เฉพาะ SCA)', cnt('sca', ',' + L + 'D2:D,"calc"'));
  row('คนที่เคยคำนวณจริง (เฉพาะ SCA)', uniq('sca', ',' + L + 'D2:D,"calc"'));
  row('');
  row('รายวัน (ใหม่สุดอยู่บน)');
  row('วันที่', 'SCA — เครื่องไม่ซ้ำ', 'Ceph — เครื่องไม่ซ้ำ', 'หุ้น — เครื่องไม่ซ้ำ');

  sh.getRange(1, 1, rows.length, NC).setValues(rows);

  var r = rows.length + 1;
  function perDay(app) {
    return 'MAP(d, LAMBDA(x, COUNTUNIQUEIFS(' + L + 'F2:F, ' + L + 'B2:B, x, ' + L + 'C2:C, "' + app + '")))';
  }
  sh.getRange(r, 1).setFormula(
    '=LET(d, SORT(UNIQUE(FILTER(' + L + 'B2:B, ' + L + 'B2:B<>"")),1,FALSE), ' +
    'IFERROR(HSTACK(d, ' + perDay('sca') + ', ' + perDay('ceph') + ', ' + perDay('stock') + '), ""))');

  sh.getRange('A1').setFontSize(14).setFontWeight('bold');
  sh.getRange(4, 1, 1, NC).setFontWeight('bold');
  sh.getRange('A5:A8').setFontWeight('bold');
  sh.getRange('A10').setFontWeight('bold');
  sh.getRange('A17').setFontWeight('bold');
  sh.getRange(rows.length, 1, 1, NC).setFontWeight('bold');
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 140);
  sh.setColumnWidth(3, 140);
  sh.setColumnWidth(4, 140);
  sh.getRange(r, 1, 1000, 1).setNumberFormat('yyyy-mm-dd');
}

/** ล้างข้อมูลทดสอบทั้งหมด (เก็บหัวตารางไว้) */
function clearLog() {
  var sh = logSheet_();
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
}
