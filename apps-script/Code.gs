/**
 * RSVP backend for rsvp.marwaan.net
 *
 * Paste this into a Google Apps Script project bound to a Google Sheet
 * (Sheet → Extensions → Apps Script), then Deploy → New deployment → Web app:
 *   Execute as: Me    Who has access: Anyone
 * Copy the Web App URL into assets/config.js → endpoint.
 */

const SHEET_NAME = 'RSVPs';
const NOTIFY_EMAIL = true; // email the sheet owner on every RSVP
const HEADERS = [
  'Submitted', 'Updated', 'Attending', 'Name', 'Email', 'Phone',
  'Adults', 'Kids', 'Kids names', 'Dietary', 'Message', 'User agent',
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (d.website) return json({ ok: true }); // honeypot hit: pretend success

    const attending = d.attending === 'yes' ? 'Yes' : d.attending === 'no' ? 'No' : '';
    const name = clean(d.name, 80);
    const email = clean(d.email, 120).toLowerCase();
    if (!attending || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: 'Missing or invalid fields' });
    }
    const yes = attending === 'Yes';
    const adults = yes ? clampInt(d.adults) : 0;
    const kids = yes ? clampInt(d.kids) : 0;

    const sheet = getSheet();
    const now = new Date();
    const row = [
      now, now, attending, name, email, clean(d.phone, 30),
      adults, kids, clean(d.kidNames, 200), clean(d.dietary, 200),
      clean(d.message, 500), clean(d.userAgent, 300),
    ];

    // Same email → update the existing row instead of adding a duplicate.
    const existing = findRowByEmail(sheet, email);
    let updated = false;
    if (existing) {
      row[0] = sheet.getRange(existing, 1).getValue(); // keep original submit time
      sheet.getRange(existing, 1, 1, row.length).setValues([row]);
      updated = true;
    } else {
      sheet.appendRow(row);
    }

    if (NOTIFY_EMAIL) notify(row, updated, sheet);
    return json({ ok: true, updated: updated });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: 'rsvp.marwaan.net' });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#ffe4c9');
  }
  return sheet;
}

function findRowByEmail(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const emails = sheet.getRange(2, 5, last - 1, 1).getValues();
  for (let i = 0; i < emails.length; i++) {
    if (String(emails[i][0]).toLowerCase() === email) return i + 2;
  }
  return null;
}

function notify(row, updated, sheet) {
  const totals = headcount(sheet);
  const subject = `${updated ? 'Updated' : 'New'} RSVP: ${row[3]} — ${row[2]}` +
    (row[2] === 'Yes' ? ` (${row[6]} adults, ${row[7]} kids)` : '');
  const body = [
    `Name: ${row[3]}`, `Email: ${row[4]}`, `Phone: ${row[5] || '-'}`,
    `Attending: ${row[2]}`, `Adults: ${row[6]}`, `Kids: ${row[7]}`,
    `Kids names: ${row[8] || '-'}`, `Dietary: ${row[9] || '-'}`, `Message: ${row[10] || '-'}`,
    '', `Running total — ${totals.adults} adults, ${totals.kids} kids (${totals.yes} yes / ${totals.no} no)`,
    SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  ].join('\n');
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject, body);
}

function headcount(sheet) {
  const t = { adults: 0, kids: 0, yes: 0, no: 0 };
  const last = sheet.getLastRow();
  if (last < 2) return t;
  sheet.getRange(2, 3, last - 1, 6).getValues().forEach(function (r) {
    if (r[0] === 'Yes') { t.yes++; t.adults += Number(r[4]) || 0; t.kids += Number(r[5]) || 0; }
    else if (r[0] === 'No') t.no++;
  });
  return t;
}

function clean(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return s;
}

function clampInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : Math.max(0, Math.min(10, n));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
