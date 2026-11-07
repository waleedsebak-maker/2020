import { google } from 'googleapis';

const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const AR_MON = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const AR_DAY = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
export const GUIDES_TAB = 'Guides';
export const SUBS_TAB = 'PushSubs';

let _client;
function sheets() {
  if (_client) return _client;
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON مش متظبط');
  const creds = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString());
  const auth = new google.auth.JWT({
    email: creds.client_email, key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  _client = google.sheets({ version: 'v4', auth });
  return _client;
}
const SID = () => process.env.SHEET_ID;
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const nk = s => String(s || '').toLowerCase().replace(/\s+/g, '');
const q = t => "'" + t.replace(/'/g, "''") + "'";

/* ---------- التواريخ (توقيت القاهرة) ---------- */
export function cairoToday() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
}
export function cairoHour() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
}
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const dayKey = d => d.getUTCDate() + MON[d.getUTCMonth()];
export function tabKey(name) {
  const m = String(name).trim().match(/^(\d{1,2})\s*([A-Za-z]+)/);
  return m ? parseInt(m[1], 10) + m[2].slice(0, 3).toUpperCase() : null;
}

/* ---------- الفلترة والتحليل ---------- */
export function direction(status) {
  const st = clean(status).toUpperCase();
  if (/(HRG|HURGHADA)\s*(APT|AIRPORT)/.test(st)) return null;
  const m = st.match(/(HRG|HURGHADA)\s*\/\s*(CAI|CAIRO|LUX|LUXOR)/);
  if (!m) return null;
  return /^C/.test(m[2]) ? 'CAI' : 'LUX';
}
export function parseGuide(cell) {
  const t = clean(cell);
  const m = t.match(/(\+?\d[\d\s\-]{7,}\d)/);
  const phone = m ? m[1].replace(/[\s\-]/g, '') : '';
  const name = (m ? t.replace(m[1], '') : t).replace(/[.,]+$/, '').trim();
  return { name, phone };
}

/* ---------- التابات ---------- */
let cache = { t: 0, map: null, titles: null };
async function tabs(force) {
  if (!force && cache.map && Date.now() - cache.t < 300000) return cache;
  const r = await sheets().spreadsheets.get({ spreadsheetId: SID(), fields: 'sheets.properties.title' });
  const map = {}, titles = new Set();
  r.data.sheets.forEach(s => {
    const t = s.properties.title; titles.add(t);
    const k = tabKey(t); if (k && !map[k]) map[k] = t;
  });
  cache = { t: Date.now(), map, titles };
  return cache;
}
async function ensureTab(title, header) {
  let c = await tabs();
  if (c.titles.has(title)) return;
  c = await tabs(true);
  if (c.titles.has(title)) return;
  await sheets().spreadsheets.batchUpdate({ spreadsheetId: SID(), requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  await sheets().spreadsheets.values.update({
    spreadsheetId: SID(), range: `${q(title)}!A1`, valueInputOption: 'RAW', requestBody: { values: [header] } });
  await tabs(true);
}

/* ---------- قراءة الأيام ---------- */
export async function readDays(fromOffset, count, all = false) {
  let c = await tabs();
  const dates = [];
  for (let i = 0; i < count; i++) dates.push(addDays(cairoToday(), fromOffset + i));
  if (dates.some(d => !c.map[dayKey(d)])) c = await tabs(true);
  const present = dates.filter(d => c.map[dayKey(d)]);
  let ranges = [];
  if (present.length) {
    const r = await sheets().spreadsheets.values.batchGet({
      spreadsheetId: SID(), ranges: present.map(d => `${q(c.map[dayKey(d)])}!A1:M400`) });
    ranges = r.data.valueRanges.map(v => v.values || []);
  }
  const gm = {};
  (await listGuides()).forEach(g => { gm[nk(g.name)] = g.phone; });
  return dates.map(d => {
    const idx = present.indexOf(d);
    const out = {
      label: `${AR_DAY[d.getUTCDay()]} ${d.getUTCDate()} ${AR_MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      tab: dayKey(d), found: idx >= 0, rows: []
    };
    if (idx < 0) return out;
    const v = ranges[idx];
    let h = -1;
    for (let i = 0; i < Math.min(8, v.length); i++) if (clean(v[i][1]).toUpperCase() === 'FILE NO') { h = i; break; }
    if (h < 0) return out;
    const col = {};
    v[h].forEach((x, i) => { col[clean(x).toUpperCase()] = i; });
    const g = (r, k) => (r[col[k]] == null ? '' : r[col[k]]);
    for (let i = h + 1; i < v.length; i++) {
      const r = v[i];
      const file = clean(g(r, 'FILE NO'));
      if (!file) continue;
      const dir = direction(g(r, 'STATUS'));
      if (!all && !dir) continue;
      const gd = parseGuide(g(r, 'GUIDE'));
      out.rows.push({
        file, pax: clean(g(r, 'PAX')), dir: dir || '',
        dirLabel: dir === 'CAI' ? 'الغردقة ← القاهرة' : dir === 'LUX' ? 'الغردقة ← الأقصر' : '',
        hotel: String(g(r, 'HOTEL')).split(/\n+/).map(clean).filter(Boolean).join(' + '),
        guide: gd.name, phone: gd.phone || gm[nk(gd.name)] || ''
      });
    }
    out.rows.sort((a, b) => (a.dir === b.dir ? 0 : a.dir === 'CAI' ? -1 : 1));
    return out;
  });
}

/* ---------- المرشدين ---------- */
async function guideRows() {
  await ensureTab(GUIDES_TAB, ['الاسم', 'التليفون', 'الحالة']);
  const r = await sheets().spreadsheets.values.get({ spreadsheetId: SID(), range: `${GUIDES_TAB}!A2:C` });
  return (r.data.values || []).map((x, i) => ({
    row: i + 2, name: clean(x[0]), phone: clean(x[1]).replace(/[\s\-]/g, ''), archived: clean(x[2]) === 'archived' }))
    .filter(g => g.name);
}
export async function listGuides() {
  return (await guideRows()).map(({ name, phone, archived }) => ({ name, phone, archived }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export async function saveGuide(oldName, name, phone) {
  name = clean(name);
  if (!name) throw new Error('الاسم مطلوب');
  const rows = await guideRows();
  const f = rows.find(g => nk(g.name) === nk(oldName || name));
  if (f) {
    await sheets().spreadsheets.values.update({
      spreadsheetId: SID(), range: `${GUIDES_TAB}!A${f.row}:B${f.row}`, valueInputOption: 'RAW',
      requestBody: { values: [[name, clean(phone)]] } });
  } else {
    await sheets().spreadsheets.values.append({
      spreadsheetId: SID(), range: `${GUIDES_TAB}!A:C`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[name, clean(phone), 'active']] } });
  }
  return listGuides();
}
export async function setArchived(name, flag) {
  const f = (await guideRows()).find(g => nk(g.name) === nk(name));
  if (f) await sheets().spreadsheets.values.update({
    spreadsheetId: SID(), range: `${GUIDES_TAB}!C${f.row}`, valueInputOption: 'RAW',
    requestBody: { values: [[flag ? 'archived' : 'active']] } });
  return listGuides();
}
export async function importGuides() {
  const have = new Set((await guideRows()).map(g => nk(g.name)));
  const add = [];
  for (const d of await readDays(0, 31, true)) for (const r of d.rows) {
    if (r.guide && !have.has(nk(r.guide))) { have.add(nk(r.guide)); add.push([r.guide, r.phone, 'active']); }
  }
  if (add.length) await sheets().spreadsheets.values.append({
    spreadsheetId: SID(), range: `${GUIDES_TAB}!A:C`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: add } });
  return listGuides();
}

/* ---------- اشتراكات الإشعارات (تاب PushSubs) ---------- */
export async function listSubs() {
  await ensureTab(SUBS_TAB, ['endpoint', 'json']);
  const r = await sheets().spreadsheets.values.get({ spreadsheetId: SID(), range: `${SUBS_TAB}!A2:B` });
  return (r.data.values || []).map((x, i) => ({ row: i + 2, endpoint: x[0], json: x[1] })).filter(s => s.endpoint && s.json);
}
export async function addSub(sub) {
  const subs = await listSubs();
  if (subs.some(s => s.endpoint === sub.endpoint)) return;
  await sheets().spreadsheets.values.append({
    spreadsheetId: SID(), range: `${SUBS_TAB}!A:B`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[sub.endpoint, JSON.stringify(sub)]] } });
}
export async function removeSub(row) {
  await sheets().spreadsheets.values.clear({ spreadsheetId: SID(), range: `${SUBS_TAB}!A${row}:B${row}` });
}
