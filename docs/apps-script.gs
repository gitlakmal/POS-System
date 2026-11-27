/**
 * Naya Potha – Google Sheets mirror (Apps Script Web App).
 * Setup:
 *  1. Extensions > Apps Script, paste this file.
 *  2. Project Settings > Script properties: add SECRET (long random string) and SHEET_ID (the spreadsheet id).
 *  3. Deploy > New deployment > Web app (Execute as: Me, Access: Anyone). Copy the /exec URL.
 *  4. Put the URL + SECRET in the server's .env (GOOGLE_SHEETS_WEBHOOK_URL / GOOGLE_SHEETS_SECRET).
 * Nothing secret is hard-coded here; the secret is checked on every request.
 */
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var body = JSON.parse(e.postData.contents);
  if (body.secret !== props.getProperty('SECRET')) {
    return ContentService.createTextOutput('forbidden');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
    body.events.forEach(function (ev) {
      var p = ev.payload, now = new Date();
      if (ev.type === 'sale.create') {
        append(ss, 'Sales', ['Time', 'Bill', 'Customer', 'Total (Rs)', 'Paid (Rs)'],
          [p.sale.createdAt, p.sale.billNo, p.sale.customerId || 'cash', p.sale.totalCents / 100, p.sale.paidCents / 100]);
      } else if (ev.type === 'ledger.add') {
        append(ss, 'Ledger', ['Time', 'Customer', 'Type', 'Amount (Rs)', 'Note', 'By'],
          [p.createdAt, p.customerId, p.entryType, p.amountCents / 100, p.note, p.createdBy]);
      } else if (ev.type === 'customer.upsert') {
        append(ss, 'Customers', ['Synced', 'ID', 'Name', 'Phone'], [now, p.code, p.name, p.phone || '']);
      } else if (ev.type === 'product.upsert') {
        append(ss, 'Items', ['Synced', 'Name', 'Unit', 'Price (Rs)', 'Cost (Rs)'],
          [now, p.name, p.unit, p.priceCents / 100, p.costCents / 100]);
      }
    });
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput('ok');
}

function append(ss, name, header, row) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(header);
  sh.appendRow(row);
}
