/* app.js — اپ مدیریت مشتری (CRM)
   بدون فریم‌ورک، مبتنی بر IndexedDB (idb.js) + مسیریابی هش + تقویم جلالی داخلی */

/* ========================================================================
   1) توابع تقویم جلالی (الگوریتم استاندارد تبدیل میلادی <-> جلالی)
   ======================================================================== */
const J = (() => {
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

  function jalCal(jy) {
    const bl = breaks.length;
    let gy = jy + 621, leapJ = -14, jp = breaks[0], jump = 0, jm;
    if (jy < jp || jy >= breaks[bl - 1]) jy = 1404;
    for (let i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap: leap === 0, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }
  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f, jm, jd;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy, jm, jd }; }
      k -= 186;
    } else { jy -= 1; k += 179; if (r.leap) k += 1; }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }
  function toJalaali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
  function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
  function isLeapJYear(jy) { return jalCal(jy).leap; }
  function daysInJMonth(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJYear(jy) ? 30 : 29;
  }
  return { toJalaali, toGregorian, isLeapJYear, daysInJMonth };
})();

const MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const DOW_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoToJalali(iso) {
  if (!iso) return null;
  const [gy, gm, gd] = iso.split('-').map(Number);
  return J.toJalaali(gy, gm, gd);
}
function jalaliToISO(jy, jm, jd) {
  const g = J.toGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}
function faDigits(v) {
  const map = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' };
  return String(v).replace(/[0-9]/g, (d) => map[d]);
}
function formatJalaliDisplay(iso, withWeekday) {
  if (!iso) return '';
  const j = isoToJalali(iso);
  const base = `${faDigits(j.jd)} ${MONTHS_FA[j.jm - 1]} ${faDigits(j.jy)}`;
  return base;
}
function isoAddDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function weekRangeISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 1) % 7; // فاصله از شنبه
  const start = isoAddDays(iso, -offset);
  const end = isoAddDays(start, 6);
  return { start, end };
}
function monthRangeISO(iso) {
  const j = isoToJalali(iso);
  const start = jalaliToISO(j.jy, j.jm, 1);
  const end = jalaliToISO(j.jy, j.jm, J.daysInJMonth(j.jy, j.jm));
  return { start, end };
}

/* ========================================================================
   2) آیکن‌ها (SVG سبک خطی)
   ======================================================================== */
const ICONS = {
  home: '<path d="M3 11.5l9-8 9 8"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/><circle cx="17.5" cy="9" r="2.4"/><path d="M15.3 14c2.7.4 4.7 2.7 4.7 6"/>',
  cart: '<circle cx="9.5" cy="20.2" r="1.3"/><circle cx="17" cy="20.2" r="1.3"/><path d="M2.2 3h2.3l2.3 12.2a2 2 0 002 1.6h8.6a2 2 0 002-1.6L21 7.2H6.2"/>',
  chat: '<path d="M4 4.5h16v11.2H8.3L4.5 19V4.5z"/>',
  box: '<path d="M3 7.2l9-4 9 4-9 4-9-4z"/><path d="M3 7.2v9.8l9 4 9-4V7.2"/><path d="M12 11.2v9.8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 000-3l1.8-1.5-2-3.4-2.2.7a7.6 7.6 0 00-2.6-1.5L14 2.5h-4l-.4 2.3a7.6 7.6 0 00-2.6 1.5l-2.2-.7-2 3.4L4.6 10.5a7.6 7.6 0 000 3L2.8 15l2 3.4 2.2-.7c.8.7 1.7 1.2 2.6 1.5l.4 2.3h4l.4-2.3a7.6 7.6 0 002.6-1.5l2.2.7 2-3.4z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M3.5 5h17M6.5 12h11M10 19h4"/>',
  dots: '<circle cx="12" cy="5.2" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.8" r="1.4"/>',
  edit: '<path d="M11.5 20.5h9"/><path d="M16 3.5a2.1 2.1 0 013 3L7.5 18l-4 1 1-4L16 3.5z"/>',
  trash: '<path d="M3.5 6.5h17"/><path d="M8.5 6.5V4h7v2.5"/><path d="M18.5 6.5L17.6 20H6.4L5.5 6.5"/><path d="M10 11v6M14 11v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  phone: '<path d="M5 4.2l3.6-.9 1.7 4.3-1.9 1.9c.9 2.7 2.6 4.4 5.3 5.3l1.9-1.9 4.3 1.7-.9 3.6c-7 .9-13.9-6-13-13z"/>',
  pin: '<path d="M12 21s7-6.6 7-11.2A7 7 0 105 9.8C5 14.4 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.3v5l3.3 3"/>',
  download: '<path d="M12 3v12M7.2 10.2L12 15l4.8-4.8"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9M7.2 13.8L12 9l4.8 4.8"/><path d="M5 3h14"/>',
  wipe: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.9 18a2 2 0 001.7 3h17a2 2 0 001.7-3L12.9 3.9a2 2 0 00-2.6 0z"/>',
  star: '<path d="M12 2.5l3 6.4 6.9.7-5.1 4.8 1.4 6.9-6.2-3.5-6.2 3.5 1.4-6.9-5.1-4.8 6.9-.7z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  package: '<path d="M3 7.2l9-4 9 4-9 4-9-4z"/><path d="M3 7.2v9.8l9 4 9-4V7.2"/>',
  bell: '<path d="M12 3.5a5.5 5.5 0 00-5.5 5.5v3.5L4.5 16h15L17.5 12.5V9A5.5 5.5 0 0012 3.5z"/><path d="M9.7 19a2.4 2.4 0 004.6 0"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2.3"/><circle cx="8.3" cy="9.3" r="1.6"/><path d="M21 15.5l-5.5-5-9 8.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8.5h6M7 12h10M7 15.5h10"/>',
  chevDown: '<path d="M6 9l6 6 6-6"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 016.5 5H17a1 1 0 011 1v2"/><rect x="3" y="7.5" width="18" height="12" rx="2.3"/><circle cx="16.3" cy="13.5" r="1.3"/>',
};
function ic(name, cls) { return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`; }

/* ========================================================================
   3) وضعیت برنامه
   ======================================================================== */
const STATUS_LIST = ['جدید', 'تماس گرفته شده', 'نیاز به پیگیری', 'خرید کرده', 'منصرف شده'];
const STATUS_BADGE = { 'جدید': 'st-new', 'تماس گرفته شده': 'st-called', 'نیاز به پیگیری': 'st-followup', 'خرید کرده': 'st-bought', 'منصرف شده': 'st-lost' };
const RESULT_LIST = ['رضایت بخش', 'ناامید کننده', 'قابل پیگیری', 'منجر به خرید'];
const SALE_TYPE_LIST = ['قسطی', 'نقدی', 'سایر'];

const state = {
  customers: [], products: [], sales: [], conversations: [], payments: [], media: [],
  filters: {
    customers: { status: '', q: '', due: '', sort: '', created: '' },
    products: { sort: 'name', q: '' },
    sales: { type: '', q: '', when: '' },
    conversations: { result: '', q: '', when: '' },
    paymentsHistory: { sort: 'newest', q: '' },
  },
};

/* --- تنظیمات ظاهری/اعلان (ذخیره در localStorage دستگاه) --- */
const THEME_KEY = 'crm-theme';
const NOTIFY_KEY = 'crm-notify-enabled';
const NOTIFY_LAST_KEY = 'crm-notify-last-shown';

let _themeMem = 'light';
let _notifyMem = '0';
function safeGet(key, fallback) { try { return localStorage.getItem(key); } catch (e) { return key === THEME_KEY ? _themeMem : _notifyMem; } finally { /* noop */ } }
function safeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { if (key === THEME_KEY) _themeMem = val; if (key === NOTIFY_KEY) _notifyMem = val; } }
function getTheme() { return safeGet(THEME_KEY) || 'light'; }
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); safeSet(THEME_KEY, t); }
function isNotifyEnabled() { return safeGet(NOTIFY_KEY) === '1'; }

function byId(list, id) { return list.find((x) => x.id === id); }
function fmtId(prefix, id) { return `${prefix}-${faDigits(String(id).padStart(4, '0'))}`; }
function fmtPrice(n) { return `${faDigits(Number(n || 0).toLocaleString('en-US'))} تومان`; }

/* --- ورودی‌های مبلغ: جداکننده‌ی هزارگان به‌صورت زنده هنگام تایپ --- */
function moneyDigitsOnly(str) { return faToEnDigits(String(str || '')).replace(/[^\d]/g, ''); }
function formatThousandsStr(digitsStr) { return digitsStr ? Number(digitsStr).toLocaleString('en-US') : ''; }
function wireMoneyInput(input, onChange) {
  if (!input) return;
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('autocomplete', 'off');
  const applyFormat = () => {
    const caretFromEnd = input.value.length - (input.selectionEnd ?? input.value.length);
    const digits = moneyDigitsOnly(input.value);
    const formatted = formatThousandsStr(digits);
    input.value = formatted;
    const pos = Math.max(0, formatted.length - caretFromEnd);
    if (document.activeElement === input) input.setSelectionRange(pos, pos);
    if (onChange) onChange(digits ? Number(digits) : 0);
  };
  input.addEventListener('input', applyFormat);
  if (input.value) applyFormat();
}
function getMoneyValue(input) { return Number(moneyDigitsOnly(input ? input.value : '')) || 0; }

function productPrices(p) {
  if (Array.isArray(p.prices) && p.prices.length) return p.prices;
  if (p.price) return [{ label: 'پیش‌فرض', amount: Number(p.price) || 0 }];
  return [];
}
function productMinPrice(p) {
  const prices = productPrices(p);
  if (!prices.length) return 0;
  return Math.min(...prices.map((x) => Number(x.amount) || 0));
}
function fmtProductPrice(p) {
  const prices = productPrices(p);
  if (!prices.length) return fmtPrice(0);
  if (prices.length === 1) return fmtPrice(prices[0].amount);
  return `از ${fmtPrice(productMinPrice(p))}`;
}
function slug(s) { return String(s).replace(/ /g, '_'); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* --- ابزار تصویر/ویدیوی محصول --- */
function compressImageFile(file, maxDim = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* --- ابزار قیمت‌های چندگانه‌ی محصول --- */
function productBasePrice(p) { const prices = productPrices(p); return prices.length ? prices[0].amount : 0; }

let mediaUrlCache = new Map();
function clearMediaUrlCache() {
  mediaUrlCache.forEach((url) => { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } });
  mediaUrlCache.clear();
}
function mediaUrl(m) {
  if (!mediaUrlCache.has(m.id)) mediaUrlCache.set(m.id, URL.createObjectURL(m.blob));
  return mediaUrlCache.get(m.id);
}
function productMedia(productId) { return state.media.filter((m) => m.productId === productId); }
function productImages(productId) { return productMedia(productId).filter((m) => m.kind === 'image'); }
function productVideos(productId) { return productMedia(productId).filter((m) => m.kind === 'video'); }
function productThumbUrl(productId) {
  const imgs = productImages(productId);
  return imgs.length ? mediaUrl(imgs[0]) : null;
}

async function loadAll() {
  clearMediaUrlCache();
  const [customers, products, sales, conversations, media, payments] = await Promise.all([
    idb.getAll('customers'), idb.getAll('products'), idb.getAll('sales'), idb.getAll('conversations'), idb.getAll('media'), idb.getAll('payments'),
  ]);
  state.customers = customers.sort((a, b) => b.id - a.id);
  state.products = products.sort((a, b) => b.id - a.id);
  state.sales = sales.sort((a, b) => b.id - a.id);
  state.conversations = conversations.sort((a, b) => b.id - a.id);
  state.media = media;
  state.payments = payments.sort((a, b) => b.id - a.id);
}

/* ========================================================================
   4) توست، مودال، منوی کشویی
   ======================================================================== */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function openModal(html) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.id = 'modalWrap';
  wrap.innerHTML = `<div class="scrim" data-close-modal></div><div class="modal">${html}</div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close-modal')) closeModal(); });
  return wrap;
}
function closeModal() {
  const el = document.getElementById('modalWrap');
  if (el) el.remove();
  Object.keys(JCalState).forEach((k) => delete JCalState[k]);
}

function openMenu(anchorEl, items) {
  closeMenu();
  const rect = anchorEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.id = 'dropMenu';
  menu.innerHTML = items.map((it) => (it.sep ? '<hr/>' : `<button data-act="${it.key}" class="${it.danger ? 'danger' : ''}">${ic(it.icon)}<span>${it.label}</span></button>`)).join('');
  document.body.appendChild(menu);
  const top = Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 90);
  const menuW = 178;
  let left = rect.left - menuW + rect.width;
  if (left < 8) left = 8;
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.id = 'menuScrim';
  scrim.style.background = 'transparent';
  scrim.style.backdropFilter = 'none';
  scrim.addEventListener('click', closeMenu);
  document.body.appendChild(scrim);
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const item = items.find((i) => i.key === btn.dataset.act);
    closeMenu();
    if (item && item.onClick) item.onClick();
  });
}
function closeMenu() {
  const m = document.getElementById('dropMenu'); if (m) m.remove();
  const s = document.getElementById('menuScrim'); if (s) s.remove();
}
document.addEventListener('scroll', closeMenu, true);

function confirmDialog(title, desc, onYes) {
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${esc(title)}</h3>
    <p style="font-size:13px;color:var(--ink-soft);line-height:1.8;margin-bottom:6px;">${esc(desc)}</p>
    <div class="modal__actions">
      <button class="btn secondary block" data-close-modal>انصراف</button>
      <button class="btn danger block" id="confirmYesBtn">${ic('trash')}تایید حذف</button>
    </div>`;
  const wrap = openModal(html);
  wrap.querySelector('#confirmYesBtn').addEventListener('click', () => { closeModal(); onYes(); });
}

/* ========================================================================
   5) تقویم جلالی برای فرم‌ها (متنی قابل‌تایپ + جدولی با ماه/سال قابل‌انتخاب)
   ======================================================================== */
const JCalState = {};
function faToEnDigits(s) {
  const map = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
  return String(s).replace(/[۰-۹]/g, (d) => map[d]);
}
function parseJalaliText(text) {
  const t = faToEnDigits(text).trim().replace(/[.\\]/g, '/').replace(/-/g, '/').replace(/\s+/g, '/');
  const m = t.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const jy = Number(m[1]), jm = Number(m[2]), jd = Number(m[3]);
  if (jm < 1 || jm > 12) return null;
  if (jd < 1 || jd > J.daysInJMonth(jy, jm)) return null;
  return jalaliToISO(jy, jm, jd);
}
function dateFieldHTML(fieldKey, isoValue, label, required) {
  return `
    <div class="field date-field" data-field="${fieldKey}">
      <label>${esc(label)}${required ? ' *' : ''}</label>
      <div class="date-input">
        <input type="text" id="disp-${fieldKey}" placeholder="۱۴۰۴/۰۶/۰۱" inputmode="numeric" value="${esc(formatJalaliDisplay(isoValue))}" data-field="${fieldKey}">
        <button type="button" class="date-input__cal" data-role="date-toggle" data-field="${fieldKey}">${ic('calendar')}</button>
      </div>
      <div class="field__hint">می‌توانید تاریخ را مستقیم تایپ کنید (مثل ۱۴۰۴/۰۶/۰۱) یا از تقویم انتخاب کنید</div>
      <div class="jcal-slot" id="jcal-${fieldKey}"></div>
    </div>`;
}
function buildJCalHTML(fieldKey, jy, jm, selectedIso) {
  const gStart = J.toGregorian(jy, jm, 1);
  const startDow = (new Date(gStart.gy, gStart.gm - 1, gStart.gd).getDay() + 1) % 7;
  const daysCount = J.daysInJMonth(jy, jm);
  const today = todayISO();
  let cells = '';
  for (let i = 0; i < startDow; i += 1) cells += '<button class="jcal__day" disabled></button>';
  for (let d = 1; d <= daysCount; d += 1) {
    const iso = jalaliToISO(jy, jm, d);
    const cls = ['jcal__day'];
    if (iso === today) cls.push('today');
    if (iso === selectedIso) cls.push('selected');
    cells += `<button type="button" class="${cls.join(' ')}" onclick="pickJCal('${fieldKey}','${iso}')">${faDigits(d)}</button>`;
  }
  const monthOptions = MONTHS_FA.map((mName, idx) => `<option value="${idx + 1}" ${idx + 1 === jm ? 'selected' : ''}>${mName}</option>`).join('');
  return `
    <div class="jcal__head">
      <button type="button" class="jcal__navbtn" onclick="navJCal('${fieldKey}',1)">${ic('chevR')}</button>
      <div class="jcal__headctrls">
        <select class="jcal__monthsel" onchange="jcalMonthChange('${fieldKey}', this.value)">${monthOptions}</select>
        <input type="number" class="jcal__yearinput" value="${jy}" onchange="jcalYearChange('${fieldKey}', this.value)">
      </div>
      <button type="button" class="jcal__navbtn" onclick="navJCal('${fieldKey}',-1)">${ic('chevL')}</button>
    </div>
    <div class="jcal__grid">
      ${DOW_FA.map((d) => `<div class="jcal__dow">${d}</div>`).join('')}
      ${cells}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button type="button" class="btn secondary block" style="padding:8px;font-size:12px;" onclick="pickJCal('${fieldKey}','${today}')">امروز</button>
      <button type="button" class="btn secondary block" style="padding:8px;font-size:12px;" onclick="clearJCal('${fieldKey}')">پاک کردن</button>
    </div>`;
}
window.pickJCal = function (fieldKey, iso) {
  const st = JCalState[fieldKey]; if (!st) return;
  st.formData[fieldKey] = iso;
  const disp = document.getElementById(`disp-${fieldKey}`);
  if (disp) disp.value = formatJalaliDisplay(iso);
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) { slot.classList.remove('open'); slot.innerHTML = ''; }
  if (st.onChange) st.onChange(fieldKey);
};
window.clearJCal = function (fieldKey) {
  const st = JCalState[fieldKey]; if (!st) return;
  st.formData[fieldKey] = null;
  const disp = document.getElementById(`disp-${fieldKey}`);
  if (disp) disp.value = '';
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) { slot.classList.remove('open'); slot.innerHTML = ''; }
  if (st.onChange) st.onChange(fieldKey);
};
window.navJCal = function (fieldKey, dir) {
  const st = JCalState[fieldKey]; if (!st) return;
  st.jm += dir;
  if (st.jm < 1) { st.jm = 12; st.jy -= 1; }
  if (st.jm > 12) { st.jm = 1; st.jy += 1; }
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) slot.innerHTML = buildJCalHTML(fieldKey, st.jy, st.jm, st.formData[fieldKey]);
};
window.jcalMonthChange = function (fieldKey, val) {
  const st = JCalState[fieldKey]; if (!st) return;
  st.jm = Number(val);
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) slot.innerHTML = buildJCalHTML(fieldKey, st.jy, st.jm, st.formData[fieldKey]);
};
window.jcalYearChange = function (fieldKey, val) {
  const st = JCalState[fieldKey]; if (!st) return;
  const y = Number(val);
  if (!y || y < 1200 || y > 1600) return;
  st.jy = y;
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) slot.innerHTML = buildJCalHTML(fieldKey, st.jy, st.jm, st.formData[fieldKey]);
};
function initDateFields(container, formData, onChange) {
  container.querySelectorAll('[data-role="date-toggle"]').forEach((elm) => {
    elm.addEventListener('click', () => {
      const fieldKey = elm.dataset.field;
      const slot = document.getElementById(`jcal-${fieldKey}`);
      const isOpen = slot.classList.contains('open');
      container.querySelectorAll('.jcal-slot.open').forEach((s) => { s.classList.remove('open'); s.innerHTML = ''; });
      if (isOpen) return;
      const base = formData[fieldKey] ? isoToJalali(formData[fieldKey]) : isoToJalali(todayISO());
      JCalState[fieldKey] = { jy: base.jy, jm: base.jm, formData, onChange };
      slot.classList.add('open');
      slot.innerHTML = buildJCalHTML(fieldKey, base.jy, base.jm, formData[fieldKey]);
    });
  });
  container.querySelectorAll('.date-field input[type="text"]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const fieldKey = inp.dataset.field;
      const val = inp.value.trim();
      if (!val) { formData[fieldKey] = null; if (onChange) onChange(fieldKey); return; }
      const iso = parseJalaliText(val);
      if (!iso) { toast('تاریخ نامعتبر است — مثال: ۱۴۰۴/۰۶/۰۱'); inp.value = formatJalaliDisplay(formData[fieldKey]); return; }
      formData[fieldKey] = iso;
      inp.value = formatJalaliDisplay(iso);
      const slot = document.getElementById(`jcal-${fieldKey}`);
      if (slot) { slot.classList.remove('open'); slot.innerHTML = ''; }
      if (onChange) onChange(fieldKey);
    });
  });
}

/* ========================================================================
   6) مسیریابی
   ======================================================================== */
const NAV_ITEMS = [
  { key: 'dashboard', label: 'داشبرد', icon: 'home' },
  { key: 'customers', label: 'مشتریان', icon: 'users' },
  { key: 'sales', label: 'فروش‌ها', icon: 'cart' },
  { key: 'conversations', label: 'گفتگوها', icon: 'chat' },
  { key: 'products', label: 'محصولات', icon: 'box' },
  { key: 'settings', label: 'تنظیمات', icon: 'gear' },
];

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'dashboard' };
  if (parts[0] === 'customer-detail') return { name: 'customer-detail', id: Number(parts[1]), tab: parts[2] || 'conversations' };
  if (parts[0] === 'product-detail') return { name: 'product-detail', id: Number(parts[1]) };
  return { name: parts[0] };
}

function computeCustomersNavDot() {
  let anyBlink = false;
  let anyStatic = false;
  state.customers.forEach((c) => {
    const d = computeFollowUpDot(c.nextFollowUp, c.nextFollowUpTime);
    if (d === 'blink') anyBlink = true;
    else if (d === 'static') anyStatic = true;
  });
  return anyBlink ? 'blink' : anyStatic ? 'static' : 'none';
}
function renderNav(active) {
  const nav = document.getElementById('bottomNav');
  const custDot = computeCustomersNavDot();
  nav.innerHTML = NAV_ITEMS.map((it) => `
    <button class="nav-item ${active === it.key ? 'active' : ''}" data-nav="${it.key}">
      <span class="nav-item__icon">
        ${ic(it.icon)}
        ${it.key === 'customers' && custDot !== 'none' ? `<span class="nav-dot${custDot === 'blink' ? ' nav-dot--blink' : ''}"></span>` : ''}
      </span>
      <span>${it.label}</span>
    </button>`).join('');
  nav.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => { location.hash = `#/${btn.dataset.nav}`; });
  });
}

async function router() {
  closeMenu();
  const route = parseRoute();
  const topActive = route.name === 'customer-detail' ? 'customers' : route.name === 'product-detail' ? 'products' : (route.name === 'payments-history' || route.name === 'followups') ? 'dashboard' : route.name === 'burned-leads' ? 'settings' : route.name;
  renderNav(topActive);
  const view = document.getElementById('view');
  view.scrollTop = 0;
  if (route.name === 'dashboard') return renderDashboard(view);
  if (route.name === 'customers') return renderCustomers(view);
  if (route.name === 'products') return renderProducts(view);
  if (route.name === 'sales') return renderSales(view);
  if (route.name === 'conversations') return renderConversations(view);
  if (route.name === 'settings') return renderSettings(view);
  if (route.name === 'payments-history') return renderPaymentsHistory(view);
  if (route.name === 'followups') return renderFollowUps(view);
  if (route.name === 'burned-leads') return renderBurnedLeads(view);
  if (route.name === 'customer-detail') return renderCustomerDetail(view, route.id, route.tab);
  if (route.name === 'product-detail') return renderProductDetail(view, route.id);
  return renderDashboard(view);
}
window.addEventListener('hashchange', router);

/* ========================================================================
   7) داشبرد
   ======================================================================== */
function last7DaysISO() {
  const today = todayISO();
  const out = [];
  for (let i = 6; i >= 0; i -= 1) out.push(isoAddDays(today, -i));
  return out;
}
function weekdayShortFa(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const names = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];
  return names[new Date(y, m - 1, d).getDay()];
}
function smoothPathD(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function salesChartSVG() {
  const days = last7DaysISO();
  const counts = days.map((iso) => state.sales.filter((s) => s.date === iso).length);
  const max = Math.max(1, ...counts);
  const w = 300, h = 110, padT = 20, padB = 20, barGap = 8;
  const barW = (w - barGap * (days.length - 1)) / days.length;
  const chartH = h - padT - padB;

  const points = days.map((iso, i) => {
    const x = i * (barW + barGap) + barW / 2;
    const y = padT + (chartH - (counts[i] / max) * chartH);
    return { x, y };
  });
  const lineD = smoothPathD(points);
  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${h - padB} L ${points[0].x.toFixed(1)} ${h - padB} Z`;

  let bars = '';
  days.forEach((iso, i) => {
    const x = i * (barW + barGap);
    const barH = counts[i] === 0 ? 2 : Math.max(4, (counts[i] / max) * (chartH - 6));
    const y = h - padB - barH;
    const isToday = iso === todayISO();
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${isToday ? 'var(--accent)' : 'var(--primary)'}" opacity="${isToday ? 0.9 : 0.45}"/>`;
    bars += `<text x="${x + barW / 2}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--ink-faint)">${weekdayShortFa(iso)}</text>`;
  });

  let dots = '';
  points.forEach((p, i) => {
    if (counts[i] > 0) dots += `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink-soft)">${faDigits(counts[i])}</text>`;
    dots += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>`;
  });

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:112px;">
    <defs>
      <linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${bars}
    <path d="${areaD}" fill="url(#areaFade)"/>
    <path d="${lineD}" fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}

function featuredProductHTML(top) {
  if (!top) return `<div class="hero-product hero-product--empty">هنوز فروشی برای انتخاب محصول منتخب ثبت نشده است</div>`;
  const p = top.product;
  const vids = productVideos(p.id);
  const imgs = productImages(p.id);
  let mediaTag = '';
  if (vids.length) mediaTag = `<video class="hero-product__media" src="${mediaUrl(vids[0])}" muted autoplay loop playsinline></video>`;
  else if (imgs.length) mediaTag = `<img class="hero-product__media" src="${mediaUrl(imgs[0])}" alt="">`;
  return `
    <button class="hero-product" data-product="${p.id}" style="border:none;padding:0;cursor:pointer;">
      ${mediaTag}
      <div class="hero-product__fade"></div>
      <div class="hero-product__body">
        <span class="hero-product__tag">${ic('star')} پرفروش‌ترین</span>
        <div class="hero-product__name">${esc(p.name)}</div>
        <div class="hero-product__meta">${faDigits(top.count)} فروش · ${fmtProductPrice(p)}</div>
      </div>
    </button>`;
}

function todayNoteKey() { return `crm-daily-note-${todayISO()}`; }
function getTodayNote() { try { return localStorage.getItem(todayNoteKey()) || ''; } catch (err) { return ''; } }
function setTodayNote(text) {
  try {
    if (text) localStorage.setItem(todayNoteKey(), text);
    else localStorage.removeItem(todayNoteKey());
  } catch (err) { /* ذخیره‌سازی محلی در دسترس نیست */ }
}
function openTodayNoteForm() {
  const current = getTodayNote();
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">یادداشت امروز</h3>
    <form id="todayNoteForm">
      <div class="field"><textarea name="note" rows="5" placeholder="هر یادداشتی برای امروز اینجا بنویسید...">${esc(current)}</textarea></div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ذخیره</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  wrap.querySelector('#todayNoteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setTodayNote(fd.get('note').trim());
    closeModal();
    toast('یادداشت ذخیره شد');
    router();
  });
}

function todayRemindersHTML() {
  const today = todayISO();
  const custRows = state.customers.filter((c) => c.nextFollowUp === today);
  const convRows = state.conversations.filter((c) => c.nextFollowUp === today);

  if (!custRows.length && !convRows.length) {
    const note = getTodayNote();
    if (note) {
      return `<div class="today-panel"><button type="button" class="today-note" id="todayNoteBtn">${esc(note)}</button></div>`;
    }
    return `<div class="today-panel"><button type="button" class="today-empty" id="todayNoteBtn">${ic('check')} امروز هیچ پیگیری‌ای ثبت نشده — برای نوشتن یادداشت بزنید</button></div>`;
  }

  const custHTML = custRows.map((c) => `
    <button class="today-row" data-cust="${c.id}">
      <div class="today-row__icon tp-cust">${ic('users')}</div>
      <div class="today-row__body">
        <div class="today-row__title">${esc(customerFullName(c))}</div>
        <div class="today-row__sub">پیگیری مشتری ${c.phone ? '· ' + esc(c.phone) : ''}</div>
      </div>
      <div class="today-row__chev">${ic('chevL')}</div>
    </button>`).join('');

  const convHTML = convRows.map((cv) => {
    const cu = byId(state.customers, cv.customerId);
    return `
    <button class="today-row" data-conv="${cv.id}">
      <div class="today-row__icon tp-conv">${ic('chat')}</div>
      <div class="today-row__body">
        <div class="today-row__title">${cu ? esc(customerFullName(cu)) : 'گفتگو'}</div>
        <div class="today-row__sub">پیگیری گفتگو ${cv.result ? '· ' + esc(cv.result) : ''}</div>
      </div>
      <div class="today-row__chev">${ic('chevL')}</div>
    </button>`;
  }).join('');

  return `<div class="today-panel">${custHTML}${convHTML}</div>`;
}

function renderDashboard(view) {
  const today = todayISO();
  const week = weekRangeISO(today);
  const month = monthRangeISO(today);

  const followupCustomersToday = state.customers.filter((c) => c.nextFollowUp === today);
  const followupsToday = followupCustomersToday.length;
  const followupsTodayBlink = followupCustomersToday.some((c) => computeFollowUpDot(c.nextFollowUp, c.nextFollowUpTime) === 'blink');
  const followupsWeek = state.customers.filter((c) => c.nextFollowUp && c.nextFollowUp >= week.start && c.nextFollowUp <= week.end).length;
  const newCustomersMonth = state.customers.filter((c) => c.createdAt && c.createdAt >= month.start && c.createdAt <= month.end).length;
  const convToday = state.conversations.filter((c) => c.date === today).length;
  const salesWeekOk = state.sales.filter((s) => s.date >= week.start && s.date <= week.end).length;
  const last7Total = state.sales.filter((s) => last7DaysISO().includes(s.date)).length;

  const salesByProduct = {};
  state.sales.forEach((s) => { salesByProduct[s.productId] = (salesByProduct[s.productId] || 0) + 1; });
  const topProducts = Object.entries(salesByProduct)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([pid, count]) => ({ product: byId(state.products, Number(pid)), count }))
    .filter((x) => x.product);

  view.innerHTML = `
    ${paymentsTodayPanelHTML()}
    <div class="section-title">${ic('spark')} نمای کلی</div>
    <div class="dash-grid">
      <div class="dash-card c-amber" data-go="followup-today" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('clock')}${followupsToday ? `<span class="dash-card__dot${followupsTodayBlink ? ' dash-card__dot--blink' : ''}"></span>` : ''}</div>
        <div><div class="dash-card__value">${faDigits(followupsToday)}</div><div class="dash-card__label">پیگیری‌های امروز</div></div>
      </div>
      <div class="dash-card c-amber" data-go="followup-week" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('calendar')}</div>
        <div><div class="dash-card__value">${faDigits(followupsWeek)}</div><div class="dash-card__label">پیگیری‌های این هفته</div></div>
      </div>
      <div class="dash-card c-teal" data-go="new-month" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('users')}</div>
        <div><div class="dash-card__value">${faDigits(newCustomersMonth)}</div><div class="dash-card__label">مشتری جدید این ماه</div></div>
      </div>
      <div class="dash-card c-blue" data-go="conv-today" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('chat')}</div>
        <div><div class="dash-card__value">${faDigits(convToday)}</div><div class="dash-card__label">گفتگوهای امروز</div></div>
      </div>
      <div class="dash-card c-green dash-card--wide" data-go="sales-week" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('target')}</div>
        <div><div class="dash-card__value">${faDigits(salesWeekOk)}</div><div class="dash-card__label">فروش موفق این هفته</div></div>
      </div>
    </div>

    <div class="section-title">${ic('clock')} یادآوری‌های امروز<span class="cnt">${faDigits((state.customers.filter((c) => c.nextFollowUp === today).length) + (state.conversations.filter((c) => c.nextFollowUp === today).length))}</span></div>
    ${todayRemindersHTML()}

    <div class="section-title">${ic('spark')} روند فروش ۷ روز اخیر</div>
    <div class="chart-card">
      <div class="chart-card__head"><span class="chart-card__total">${faDigits(last7Total)} فروش در ۷ روز اخیر</span></div>
      ${salesChartSVG()}
    </div>

    <div class="section-title">${ic('star')} محصول منتخب</div>
    ${featuredProductHTML(topProducts[0])}

    <div class="section-title">${ic('star')} محصولات پرفروش</div>
    <div class="top-products">
      ${topProducts.length ? topProducts.map((tp, i) => `
        <button class="top-product-row" data-product="${tp.product.id}">
          <span class="top-product-row__rank">${faDigits(i + 1)}</span>
          ${productThumbUrl(tp.product.id) ? `<img class="top-product-row__thumb" src="${productThumbUrl(tp.product.id)}" alt="">` : ''}
          <span class="top-product-row__name">${esc(tp.product.name)}</span>
          <span class="top-product-row__count">${faDigits(tp.count)} فروش</span>
          ${ic('chevL', 'chev')}
        </button>`).join('') : `<div class="empty-state" style="padding:26px;"><div class="empty-state__desc">هنوز فروشی ثبت نشده است</div></div>`}
    </div>
    <div style="height:6px;"></div>
  `;

  view.querySelectorAll('[data-go]').forEach((card) => {
    card.addEventListener('click', () => goDashboardShortcut(card.dataset.go));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') goDashboardShortcut(card.dataset.go); });
  });
  view.querySelectorAll('[data-product]').forEach((row) => {
    row.addEventListener('click', () => { location.hash = `#/product-detail/${row.dataset.product}`; });
  });
  view.querySelectorAll('[data-cust]').forEach((row) => {
    row.addEventListener('click', () => openCustomerForm(Number(row.dataset.cust)));
  });
  view.querySelectorAll('[data-conv]').forEach((row) => {
    row.addEventListener('click', () => openConversationForm(Number(row.dataset.conv)));
  });
  const noteBtn = document.getElementById('todayNoteBtn');
  if (noteBtn) noteBtn.addEventListener('click', () => openTodayNoteForm());
  wirePaymentsTodayPanel(view);
}

function goDashboardShortcut(key) {
  if (key === 'followup-today') { Object.assign(state.filters.customers, { status: '', q: '', due: 'today', sort: 'followup' }); location.hash = '#/customers'; }
  if (key === 'followup-week') { Object.assign(state.filters.customers, { status: '', q: '', due: 'week', sort: 'followup' }); location.hash = '#/customers'; }
  if (key === 'new-month') { Object.assign(state.filters.customers, { status: '', q: '', due: '', sort: '', created: 'month' }); location.hash = '#/customers'; }
  if (key === 'conv-today') { Object.assign(state.filters.conversations, { result: '', q: '', when: 'today' }); location.hash = '#/conversations'; }
  if (key === 'sales-week') { Object.assign(state.filters.sales, { type: '', q: '', when: 'week' }); location.hash = '#/sales'; }
}

/* ========================================================================
   8) مشتریان
   ======================================================================== */
function customerFullName(c) { return `${c.firstName || ''} ${c.lastName || ''}`.trim(); }
function customerLastPurchaseDate(customerId) {
  const sales = state.sales.filter((s) => s.customerId === customerId);
  if (!sales.length) return null;
  return sales.reduce((max, s) => (s.date > max ? s.date : max), sales[0].date);
}

function computeCustomerList() {
  const f = state.filters.customers;
  let list = state.customers.slice();
  if (f.status) list = list.filter((c) => c.status === f.status);
  if (f.due === 'today') { const t = todayISO(); list = list.filter((c) => c.nextFollowUp === t); }
  if (f.due === 'week') { const w = weekRangeISO(todayISO()); list = list.filter((c) => c.nextFollowUp && c.nextFollowUp >= w.start && c.nextFollowUp <= w.end); }
  if (f.created === 'month') { const m = monthRangeISO(todayISO()); list = list.filter((c) => c.createdAt && c.createdAt >= m.start && c.createdAt <= m.end); }
  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    list = list.filter((c) => customerFullName(c).includes(q) || (c.phone || '').includes(q));
  }
  if (f.sort === 'followup') {
    list.sort((a, b) => {
      if (!a.nextFollowUp && !b.nextFollowUp) return 0;
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return a.nextFollowUp.localeCompare(b.nextFollowUp);
    });
  } else if (f.sort === 'name') {
    list.sort((a, b) => customerFullName(a).localeCompare(customerFullName(b), 'fa'));
  }
  return list;
}

function renderCustomers(view) {
  const f = state.filters.customers;
  const activeFilterCount = (f.status ? 1 : 0) + (f.due ? 1 : 0) + (f.sort ? 1 : 0) + (f.created ? 1 : 0);
  view.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${ic('search')}<input id="custSearch" placeholder="جستجوی نام یا شماره تماس" value="${esc(f.q)}"></div>
      <button class="tbtn tbtn-filter" id="custFilterBtn">${ic('filter')}<span>فیلتر</span>${activeFilterCount ? '<span class="tbtn__dot"></span>' : ''}</button>
      <button class="tbtn tbtn-add" id="custAddBtn">${ic('plus')}<span>افزودن</span></button>
    </div>
    ${f.created === 'month' ? `<div class="quick-banner"><span>${ic('filter')}مشتری‌های جدید این ماه</span><button id="clearCreatedBtn">${ic('x')}پاک کردن</button></div>` : ''}
    <div class="list" id="custList"></div>
  `;
  renderCustomerList(computeCustomerList());
  document.getElementById('custSearch').addEventListener('input', (e) => { f.q = e.target.value; renderCustomerList(computeCustomerList()); });
  document.getElementById('custAddBtn').addEventListener('click', () => openCustomerForm());
  document.getElementById('custFilterBtn').addEventListener('click', (e) => openCustomerFilterSheet(view));
  const clearBtn = document.getElementById('clearCreatedBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => { f.created = ''; renderCustomers(view); });
}

function renderCustomerList(list) {
  const el = document.getElementById('custList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">${ic('users')}<div class="empty-state__title">مشتری‌ای یافت نشد</div><div class="empty-state__desc">با دکمه + یک مشتری جدید اضافه کنید</div></div>`;
    return;
  }
  el.innerHTML = list.map((c) => {
    const dot = computeFollowUpDot(c.nextFollowUp, c.nextFollowUpTime);
    const lastPurchase = customerLastPurchaseDate(c.id);
    return `
    <div class="rec-card status-${slug(c.status)}" data-id="${c.id}">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${esc(customerFullName(c)) || 'بدون‌نام'}</span>
          <span class="badge ${STATUS_BADGE[c.status] || 'st-new'}">${esc(c.status || 'جدید')}</span>
          ${dot !== 'none' ? `<span class="due-glow ${dot === 'blink' ? 'due-glow--blink' : ''}">${ic('bell')}پیگیری${dot === 'blink' ? ' — الان' : ''}</span>` : ''}
        </div>
        <div class="rec-card__id">${fmtId('C', c.id)}</div>
        <div class="rec-card__meta">
          ${c.phone ? `<a class="tel-link" href="tel:${esc(c.phone)}" onclick="event.stopPropagation()">${ic('phone')}${esc(c.phone)}</a>` : ''}
          ${lastPurchase ? `<span>${ic('cart')}تاریخ خرید: ${formatJalaliDisplay(lastPurchase)}</span>` : ''}
          ${c.nextFollowUp ? `<span>${ic('calendar')}پیگیری: ${formatJalaliDisplay(c.nextFollowUp)}${c.nextFollowUpTime ? ` · ${formatFollowUpTime(c.nextFollowUpTime)}` : ''}</span>` : ''}
        </div>
        ${c.description ? `<div class="rec-card__desc">${esc(c.description)}</div>` : ''}
      </div>
      <button class="menu-btn" data-menu="${c.id}">${ic('dots')}</button>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      openMenu(btn, [
        { key: 'edit', label: 'ویرایش', icon: 'edit', onClick: () => openCustomerForm(id) },
        { key: 'conv', label: 'لیست گفتگوها', icon: 'chat', onClick: () => { location.hash = `#/customer-detail/${id}/conversations`; } },
        { key: 'sales', label: 'لیست خریدها', icon: 'cart', onClick: () => { location.hash = `#/customer-detail/${id}/sales`; } },
        { sep: true },
        { key: 'del', label: 'حذف مشتری', icon: 'trash', danger: true, onClick: () => deleteCustomer(id) },
      ]);
    });
  });
}

function openCustomerFilterSheet(view) {
  const f = state.filters.customers;
  const dueOpts = [['', 'همه'], ['today', 'پیگیری امروز'], ['week', 'پیگیری این هفته']];
  const sortOpts = [['', 'جدیدترین'], ['followup', 'نزدیک‌ترین پیگیری'], ['name', 'الفبا']];
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">فیلتر و مرتب‌سازی مشتریان</h3>
    <div class="field"><label>وضعیت</label></div>
    <div class="filter-chips" id="statusChips">
      <button class="chip ${!f.status ? 'active' : ''}" data-v="">همه</button>
      ${STATUS_LIST.map((s) => `<button class="chip ${f.status === s ? 'active' : ''}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <div class="field" style="margin-top:14px;"><label>زمان پیگیری</label></div>
    <div class="filter-chips" id="dueChips">
      ${dueOpts.map(([v, l]) => `<button class="chip ${f.due === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}
    </div>
    <div class="field" style="margin-top:14px;"><label>مرتب‌سازی</label></div>
    <div class="filter-chips" id="sortChips2">
      ${sortOpts.map(([v, l]) => `<button class="chip ${f.sort === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}
    </div>
    <div class="modal__actions"><button class="btn primary block" data-close-modal>اعمال</button></div>`;
  const wrap = openModal(html);
  wrap.querySelectorAll('#statusChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.status = chip.dataset.v; renderCustomers(view); openCustomerFilterSheet(view); }));
  wrap.querySelectorAll('#dueChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.due = chip.dataset.v; renderCustomers(view); openCustomerFilterSheet(view); }));
  wrap.querySelectorAll('#sortChips2 .chip').forEach((chip) => chip.addEventListener('click', () => { f.sort = chip.dataset.v; renderCustomers(view); openCustomerFilterSheet(view); }));
}

function openCustomerForm(id, prefillOverride) {
  const rec = id ? byId(state.customers, id) : null;
  const formData = rec ? { ...rec } : { firstName: '', lastName: '', phone: '', address: '', lastContact: null, nextFollowUp: null, nextFollowUpTime: null, status: 'جدید', description: '' };
  if (prefillOverride) Object.assign(formData, prefillOverride);
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${rec ? 'ویرایش مشتری' : 'مشتری جدید'}</h3>
    <form id="custForm">
      <div class="field-row">
        <div class="field"><label>نام *</label><input name="firstName" required value="${esc(formData.firstName)}"></div>
        <div class="field"><label>نام خانوادگی *</label><input name="lastName" required value="${esc(formData.lastName)}"></div>
      </div>
      <div class="field"><label>شماره تماس</label><input name="phone" inputmode="tel" value="${esc(formData.phone)}"></div>
      <div class="field"><label>آدرس</label><textarea name="address">${esc(formData.address)}</textarea></div>
      <div class="field-row">
        ${dateFieldHTML('lastContact', formData.lastContact, 'آخرین تماس')}
        ${dateFieldHTML('nextFollowUp', formData.nextFollowUp, 'پیگیری بعدی')}
      </div>
      <div class="field"><label>زمان پیگیری (اختیاری)</label><input name="nextFollowUpTime" type="time" value="${esc(formData.nextFollowUpTime || '')}"></div>
      <div class="field"><label>وضعیت</label>
        <select name="status">${STATUS_LIST.map((s) => `<option value="${esc(s)}" ${formData.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>توضیحات</label><textarea name="description">${esc(formData.description)}</textarea></div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ذخیره</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  const form = wrap.querySelector('#custForm');
  initDateFields(wrap, formData);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const phoneRaw = fd.get('phone').trim();
    if (phoneRaw && !isValidIranPhone(phoneRaw)) { toast('شماره تماس معتبر نیست — باید با ۰۹ شروع شود و ۱۱ رقم باشد'); return; }
    const phone = phoneRaw ? normalizePhoneForMatch(phoneRaw) : '';
    const nextFollowUpTime = normalizeTimeHHMM(fd.get('nextFollowUpTime')) || null;
    const payload = {
      firstName: fd.get('firstName').trim(), lastName: fd.get('lastName').trim(),
      phone, address: fd.get('address').trim(),
      status: fd.get('status'), description: fd.get('description').trim(),
      lastContact: formData.lastContact || null, nextFollowUp: formData.nextFollowUp || null,
      nextFollowUpTime: formData.nextFollowUp ? nextFollowUpTime : null,
      createdAt: rec ? rec.createdAt : todayISO(),
    };
    const doSave = async () => {
      let customerId = rec ? rec.id : null;
      if (rec) { payload.id = rec.id; await idb.put('customers', payload); toast('مشتری ویرایش شد'); }
      else { customerId = await idb.add('customers', payload); toast('مشتری اضافه شد'); }
      /* هم‌گام‌سازی با پیگیری واریزی متصل (منبع واحد پیگیری) */
      if (customerId) {
        const linkedFollowup = state.payments.find((p) => p.customerId === customerId && p.status === 'followup');
        if (linkedFollowup && payload.nextFollowUp && linkedFollowup.date !== payload.nextFollowUp) {
          await idb.put('payments', { ...linkedFollowup, date: payload.nextFollowUp, updatedAt: Date.now() });
        }
      }
      await loadAll();
      closeModal();
      router();
    };
    if (payload.phone) {
      const dup = state.customers.find((c) => c.phone === payload.phone && (!rec || c.id !== rec.id));
      if (dup) {
        closeModal();
        confirmDialogGeneric(
          'شماره تماس تکراری است',
          `این شماره قبلاً برای «${customerFullName(dup)}» ثبت شده. آیا مطمئنید می‌خواهید ادامه دهید؟`,
          'ثبت با همین شماره',
          async () => { await doSave(); },
          () => { openCustomerForm(id, payload); },
        );
        return;
      }
    }
    await doSave();
  });
}

function confirmDialogGeneric(title, desc, yesLabel, onYes, onCancel) {
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${esc(title)}</h3>
    <p style="font-size:13px;color:var(--ink-soft);line-height:1.8;margin-bottom:6px;">${esc(desc)}</p>
    <div class="modal__actions">
      <button class="btn secondary block" id="genCancelBtn">بازگشت و اصلاح</button>
      <button class="btn primary block" id="genYesBtn">${ic('check')}${esc(yesLabel)}</button>
    </div>`;
  const wrap = openModal(html);
  wrap.querySelector('#genYesBtn').addEventListener('click', () => { closeModal(); onYes(); });
  wrap.querySelector('#genCancelBtn').addEventListener('click', () => { closeModal(); if (onCancel) onCancel(); });
}

async function deleteCustomer(id) {
  const c = byId(state.customers, id);
  confirmDialog('حذف مشتری', `«${customerFullName(c)}» و تمام گفتگوها/فروش‌های مرتبط حذف خواهد شد. واریزی‌های ثبت‌شده‌ی این مشتری حذف نمی‌شوند اما دیگر به او متصل نخواهند بود.`, async () => {
    const convs = await idb.getByIndex('conversations', 'customerId', id);
    const sales = await idb.getByIndex('sales', 'customerId', id);
    const payments = await idb.getByIndex('payments', 'customerId', id);
    await Promise.all([
      ...convs.map((x) => idb.delete('conversations', x.id)),
      ...sales.map((x) => idb.delete('sales', x.id)),
      ...payments.map((x) => idb.put('payments', { ...x, customerId: null })),
    ]);
    await idb.delete('customers', id);
    await loadAll();
    toast('مشتری حذف شد');
    router();
  });
}

function renderCustomerDetail(view, id, tab) {
  const c = byId(state.customers, id);
  if (!c) { location.hash = '#/customers'; return; }
  const convs = state.conversations.filter((x) => x.customerId === id);
  const sales = state.sales.filter((x) => x.customerId === id);
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">${ic('chevR')}</button>
      <div>
        <h3 style="font-size:15.5px;">${esc(customerFullName(c))}</h3>
        <div style="font-size:11.5px;color:var(--ink-soft);">${fmtId('C', c.id)} · ${esc(c.phone || 'بدون شماره')}</div>
      </div>
    </div>
    <div class="tabs">
      <button data-tab="conversations" class="${tab === 'conversations' ? 'active' : ''}">گفتگوها (${faDigits(convs.length)})</button>
      <button data-tab="sales" class="${tab === 'sales' ? 'active' : ''}">خریدها (${faDigits(sales.length)})</button>
    </div>
    <div id="detailList"></div>
  `;
  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/customers'; });
  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/customer-detail/${id}/${b.dataset.tab}`; }));

  const listEl = document.createElement('div');
  listEl.className = 'list';
  listEl.id = 'detailListInner';
  document.getElementById('detailList').appendChild(listEl);

  if (tab === 'sales') {
    renderSaleCards(listEl, sales, { hideCustomer: true });
    const fab = addFab(() => openSaleForm(null, { customerId: id }));
    view.appendChild(fab);
  } else {
    renderConversationCards(listEl, convs, { hideCustomer: true });
    const fab = addFab(() => openConversationForm(null, { customerId: id }));
    view.appendChild(fab);
  }
}

function addFab(onClick) {
  const btn = document.createElement('button');
  btn.className = 'fab';
  btn.innerHTML = ic('plus');
  btn.addEventListener('click', onClick);
  return btn;
}

/* ========================================================================
   9) محصولات
   ======================================================================== */
function computeProductList() {
  const f = state.filters.products;
  let list = state.products.slice();
  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    list = list.filter((p) => p.name.includes(q) || (p.specs || '').includes(q));
  }
  if (f.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  if (f.sort === 'price-asc') list.sort((a, b) => productMinPrice(a) - productMinPrice(b));
  if (f.sort === 'price-desc') list.sort((a, b) => productMinPrice(b) - productMinPrice(a));
  return list;
}

function renderProducts(view) {
  const f = state.filters.products;
  view.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${ic('search')}<input id="prodSearch" placeholder="جستجوی نام یا مشخصات محصول" value="${esc(f.q)}"></div>
      <button class="tbtn tbtn-filter" id="prodFilterBtn">${ic('filter')}<span>فیلتر</span>${f.sort !== 'name' ? '<span class="tbtn__dot"></span>' : ''}</button>
      <button class="tbtn tbtn-add" id="prodAddBtn">${ic('plus')}<span>افزودن</span></button>
    </div>
    <div class="list" id="prodList"></div>`;
  renderProductList(computeProductList());
  document.getElementById('prodSearch').addEventListener('input', (e) => { f.q = e.target.value; renderProductList(computeProductList()); });
  document.getElementById('prodAddBtn').addEventListener('click', () => openProductForm());
  document.getElementById('prodFilterBtn').addEventListener('click', () => openProductFilterSheet(view));
}

function renderProductList(list) {
  const el = document.getElementById('prodList');
  if (!list.length) { el.innerHTML = `<div class="empty-state">${ic('box')}<div class="empty-state__title">محصولی یافت نشد</div><div class="empty-state__desc">با دکمه‌ی افزودن یک محصول جدید اضافه کنید</div></div>`; return; }
  el.innerHTML = list.map((p) => {
    const thumb = productThumbUrl(p.id);
    return `
    <div class="rec-card" style="border-right-color:var(--primary);" data-id="${p.id}">
      ${thumb ? `<div class="rec-card__thumb-wrap"><img src="${thumb}" alt=""></div>` : ''}
      <div class="rec-card__body">
        <div class="rec-card__top"><span class="rec-card__title">${esc(p.name)}</span></div>
        <div class="rec-card__id">${fmtId('P', p.id)}</div>
        <div class="rec-card__meta"><span>${fmtProductPrice(p)}</span></div>
        ${p.specs ? `<div class="rec-card__desc">${esc(p.specs)}</div>` : ''}
      </div>
      <button class="menu-btn" data-menu="${p.id}">${ic('dots')}</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      openMenu(btn, [
        { key: 'edit', label: 'ویرایش', icon: 'edit', onClick: () => openProductForm(id) },
        { key: 'sales', label: 'لیست فروش‌ها', icon: 'cart', onClick: () => { location.hash = `#/product-detail/${id}`; } },
        { sep: true },
        { key: 'del', label: 'حذف محصول', icon: 'trash', danger: true, onClick: () => deleteProduct(id) },
      ]);
    });
  });
}

function openProductFilterSheet(view) {
  const f = state.filters.products;
  const opts = [['name', 'نام (الفبا)'], ['price-asc', 'قیمت: کم به زیاد'], ['price-desc', 'قیمت: زیاد به کم']];
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">مرتب‌سازی محصولات</h3>
    <div class="filter-chips" id="sortChips">${opts.map(([v, l]) => `<button class="chip ${f.sort === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="modal__actions"><button class="btn primary block" data-close-modal>اعمال</button></div>`;
  const wrap = openModal(html);
  wrap.querySelectorAll('#sortChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.sort = chip.dataset.v; renderProducts(view); openProductFilterSheet(view); }));
}

function openProductForm(id) {
  const rec = id ? byId(state.products, id) : null;
  const existingMedia = id ? productMedia(id).slice() : [];
  const removedMediaIds = new Set();
  const pendingFiles = []; // { tempId, kind, file, url }
  let tempSeq = 1;

  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${rec ? 'ویرایش محصول' : 'محصول جدید'}</h3>
    <form id="prodForm">
      <div class="field"><label>نام محصول *</label><input name="name" required value="${esc(rec ? rec.name : '')}"></div>
      <div class="field"><label>مشخصات محصول</label><textarea name="specs">${esc(rec ? rec.specs : '')}</textarea></div>
      <div class="field">
        <label>قیمت‌ها *</label>
        <div class="price-rows" id="priceRows"></div>
        <button type="button" class="btn ghost-add block" id="addPriceRowBtn" style="margin-top:8px;">${ic('plus')}افزودن ردیف قیمت</button>
      </div>
      <div class="field"><label>توضیحات</label><textarea name="description">${esc(rec ? rec.description : '')}</textarea></div>
      <div class="field">
        <label>عکس و ویدیوی محصول</label>
        <div class="media-upload" id="mediaGrid"></div>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ذخیره</button>
      </div>
    </form>`;
  const wrap = openModal(html);

  const priceRows = (rec ? productPrices(rec) : []).map((pr) => ({ label: pr.label || '', amount: pr.amount != null ? pr.amount : '' }));
  if (!priceRows.length) priceRows.push({ label: 'پیش‌فرض', amount: '' });

  function renderPriceRows() {
    const el = wrap.querySelector('#priceRows');
    el.innerHTML = priceRows.map((pr, i) => `
      <div class="price-row" data-idx="${i}">
        <input type="text" class="lbl" placeholder="عنوان (مثلاً عمده)" value="${esc(pr.label)}">
        <input type="text" class="amt" placeholder="مبلغ (تومان)" value="${pr.amount ? formatThousandsStr(String(pr.amount)) : ''}">
        ${priceRows.length > 1 ? `<button type="button" class="rm-btn" data-rm="${i}">${ic('x')}</button>` : ''}
      </div>`).join('');
    el.querySelectorAll('.price-row').forEach((rowEl) => {
      const idx = Number(rowEl.dataset.idx);
      rowEl.querySelector('.lbl').addEventListener('input', (e) => { priceRows[idx].label = e.target.value; });
      wireMoneyInput(rowEl.querySelector('.amt'), (val) => { priceRows[idx].amount = val; });
    });
    el.querySelectorAll('[data-rm]').forEach((btn) => {
      btn.addEventListener('click', () => { priceRows.splice(Number(btn.dataset.rm), 1); renderPriceRows(); });
    });
  }
  renderPriceRows();
  wrap.querySelector('#addPriceRowBtn').addEventListener('click', () => {
    priceRows.push({ label: '', amount: '' });
    renderPriceRows();
  });

  function renderMediaGrid() {
    const grid = wrap.querySelector('#mediaGrid');
    const existingTiles = existingMedia
      .filter((m) => !removedMediaIds.has(m.id))
      .map((m) => `
        <div class="media-thumb" data-existing="${m.id}">
          ${m.kind === 'video' ? `<video src="${mediaUrl(m)}" muted preload="metadata"></video><div class="media-thumb__play">${ic('spark')}</div>` : `<img src="${mediaUrl(m)}" alt="">`}
          <button type="button" class="media-thumb__rm" data-rm-existing="${m.id}">${ic('x')}</button>
        </div>`).join('');
    const pendingTiles = pendingFiles.map((pf) => `
        <div class="media-thumb" data-pending="${pf.tempId}">
          ${pf.kind === 'video' ? `<video src="${pf.url}" muted preload="metadata"></video><div class="media-thumb__play">${ic('spark')}</div>` : `<img src="${pf.url}" alt="">`}
          <button type="button" class="media-thumb__rm" data-rm-pending="${pf.tempId}">${ic('x')}</button>
        </div>`).join('');
    grid.innerHTML = `
      ${existingTiles}${pendingTiles}
      <label class="media-add-btn">${ic('plus')}عکس<input type="file" accept="image/*" multiple id="imgInput"></label>
      <label class="media-add-btn">${ic('plus')}ویدیو<input type="file" accept="video/*" id="vidInput"></label>`;

    grid.querySelectorAll('[data-rm-existing]').forEach((btn) => {
      btn.addEventListener('click', () => { removedMediaIds.add(Number(btn.dataset.rmExisting)); renderMediaGrid(); });
    });
    grid.querySelectorAll('[data-rm-pending]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = Number(btn.dataset.rmPending);
        const idx = pendingFiles.findIndex((p) => p.tempId === tid);
        if (idx > -1) { URL.revokeObjectURL(pendingFiles[idx].url); pendingFiles.splice(idx, 1); }
        renderMediaGrid();
      });
    });
    const imgInput = grid.querySelector('#imgInput');
    const vidInput = grid.querySelector('#vidInput');
    imgInput.addEventListener('change', () => {
      const files = Array.from(imgInput.files || []);
      files.forEach((file) => {
        const pf = { tempId: tempSeq++, kind: 'image', file, url: URL.createObjectURL(file) };
        pendingFiles.push(pf);
        compressImageFile(file)
          .then((dataUrl) => idb.dataURLToBlob(dataUrl))
          .then((blob) => {
            const compressed = new File([blob], `${(file.name || 'image').replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
            const oldUrl = pf.url;
            pf.file = compressed;
            pf.url = URL.createObjectURL(compressed);
            try { URL.revokeObjectURL(oldUrl); } catch (err) { /* noop */ }
            renderMediaGrid();
          })
          .catch(() => { /* در صورت خطا در فشرده‌سازی، فایل اصلی حفظ می‌شود */ });
      });
      renderMediaGrid();
      imgInput.value = '';
    });
    vidInput.addEventListener('change', () => {
      Array.from(vidInput.files || []).forEach((file) => {
        pendingFiles.push({ tempId: tempSeq++, kind: 'video', file, url: URL.createObjectURL(file) });
      });
      renderMediaGrid();
      vidInput.value = '';
    });
  }
  renderMediaGrid();

  wrap.querySelector('#prodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const prices = priceRows
      .map((pr) => ({ label: (pr.label || '').trim() || 'قیمت', amount: Number(pr.amount) || 0 }))
      .filter((pr) => pr.amount > 0);
    if (!prices.length) { toast('حداقل یک قیمت معتبر وارد کنید'); return; }
    const payload = { name: fd.get('name').trim(), specs: fd.get('specs').trim(), prices, description: fd.get('description').trim() };
    let productId = rec ? rec.id : null;
    if (rec) { payload.id = rec.id; await idb.put('products', payload); toast('محصول ویرایش شد'); }
    else { productId = await idb.add('products', payload); toast('محصول اضافه شد'); }

    await Promise.all(Array.from(removedMediaIds).map((mid) => idb.delete('media', mid)));
    for (const pf of pendingFiles) {
      await idb.addMedia(productId, pf.kind, pf.file, pf.file.name);
    }
    pendingFiles.forEach((pf) => { try { URL.revokeObjectURL(pf.url); } catch (err) { /* noop */ } });

    await loadAll(); closeModal(); router();
  });
}

async function deleteProduct(id) {
  const p = byId(state.products, id);
  confirmDialog('حذف محصول', `«${p.name}» حذف خواهد شد. فروش‌های ثبت‌شده برای این محصول حذف نمی‌شوند اما دیگر به محصولی متصل نخواهند بود.`, async () => {
    await idb.delete('products', id);
    await idb.deleteMediaForProduct(id);
    await loadAll(); toast('محصول حذف شد'); router();
  });
}

function renderProductDetail(view, id) {
  const p = byId(state.products, id);
  if (!p) { location.hash = '#/products'; return; }
  const sales = state.sales.filter((s) => s.productId === id);
  const media = productMedia(id);
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">${ic('chevR')}</button>
      <div><h3 style="font-size:15.5px;">${esc(p.name)}</h3><div style="font-size:11.5px;color:var(--ink-soft);">${fmtId('P', p.id)} · ${fmtProductPrice(p)}</div></div>
    </div>
    ${media.length ? `<div class="media-upload" style="margin-bottom:8px;">${media.map((m) => `
      <div class="media-thumb" style="width:88px;height:88px;">
        ${m.kind === 'video' ? `<video src="${mediaUrl(m)}" controls preload="metadata"></video>` : `<img src="${mediaUrl(m)}" alt="">`}
      </div>`).join('')}</div>` : ''}
    <div class="section-title">${ic('cart')} فروش‌های این محصول (${faDigits(sales.length)})</div>
    <div class="list" id="detailListInner"></div>`;
  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/products'; });
  renderSaleCards(document.getElementById('detailListInner'), sales, { hideProduct: true });
  view.appendChild(addFab(() => openSaleForm(null, { productId: id })));
}

/* ========================================================================
   10) فروش‌ها
   ======================================================================== */
function computeSaleList() {
  const f = state.filters.sales;
  let list = state.sales.slice();
  if (f.type) list = list.filter((s) => s.saleType === f.type);
  if (f.when === 'today') { const t = todayISO(); list = list.filter((s) => s.date === t); }
  if (f.when === 'week') { const w = weekRangeISO(todayISO()); list = list.filter((s) => s.date >= w.start && s.date <= w.end); }
  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    list = list.filter((s) => {
      const c = byId(state.customers, s.customerId); const p = byId(state.products, s.productId);
      return (c && customerFullName(c).includes(q)) || (p && p.name.includes(q));
    });
  }
  return list;
}

function renderSales(view) {
  const f = state.filters.sales;
  const activeCount = (f.type ? 1 : 0) + (f.when ? 1 : 0);
  view.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${ic('search')}<input id="saleSearch" placeholder="جستجوی مشتری یا محصول" value="${esc(f.q)}"></div>
      <button class="tbtn tbtn-filter" id="saleFilterBtn">${ic('filter')}<span>فیلتر</span>${activeCount ? '<span class="tbtn__dot"></span>' : ''}</button>
      <button class="tbtn tbtn-add" id="saleAddBtn">${ic('plus')}<span>افزودن</span></button>
    </div>
    ${f.when ? `<div class="quick-banner"><span>${ic('filter')}${f.when === 'today' ? 'فروش‌های امروز' : 'فروش‌های این هفته'}</span><button id="clearWhenBtn">${ic('x')}پاک کردن</button></div>` : ''}
    <div class="list" id="saleList"></div>`;
  renderSaleCards(document.getElementById('saleList'), computeSaleList());
  document.getElementById('saleSearch').addEventListener('input', (e) => { f.q = e.target.value; renderSaleCards(document.getElementById('saleList'), computeSaleList()); });
  document.getElementById('saleAddBtn').addEventListener('click', () => openSaleForm());
  document.getElementById('saleFilterBtn').addEventListener('click', () => openSaleFilterSheet(view));
  const clearBtn = document.getElementById('clearWhenBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => { f.when = ''; renderSales(view); });
}

function openSaleFilterSheet(view) {
  const f = state.filters.sales;
  const whenOpts = [['', 'همه'], ['today', 'امروز'], ['week', 'این هفته']];
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">فیلتر فروش‌ها</h3>
    <div class="field"><label>بازه‌ی زمانی</label></div>
    <div class="filter-chips" id="whenChips">${whenOpts.map(([v, l]) => `<button class="chip ${f.when === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="field" style="margin-top:14px;"><label>نوع فروش</label></div>
    <div class="filter-chips" id="typeChips">
      <button class="chip ${!f.type ? 'active' : ''}" data-v="">همه</button>
      ${SALE_TYPE_LIST.map((s) => `<button class="chip ${f.type === s ? 'active' : ''}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <div class="modal__actions"><button class="btn primary block" data-close-modal>اعمال</button></div>`;
  const wrap = openModal(html);
  wrap.querySelectorAll('#whenChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.when = chip.dataset.v; renderSales(view); openSaleFilterSheet(view); }));
  wrap.querySelectorAll('#typeChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.type = chip.dataset.v; renderSales(view); openSaleFilterSheet(view); }));
}

function renderSaleCards(el, list, opts = {}) {
  if (!list.length) { el.innerHTML = `<div class="empty-state">${ic('cart')}<div class="empty-state__title">فروشی ثبت نشده</div></div>`; return; }
  el.innerHTML = list.map((s) => {
    const c = byId(state.customers, s.customerId); const p = byId(state.products, s.productId);
    return `
    <div class="rec-card${s.shipped ? ' has-shipped-badge' : ''}" style="border-right-color:var(--success);" data-id="${s.id}">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${!opts.hideProduct && p ? esc(p.name) : (!opts.hideCustomer && c ? esc(customerFullName(c)) : fmtId('S', s.id))}</span>
          <span class="badge st-bought">${esc(s.saleType || 'نقدی')}</span>
        </div>
        <div class="rec-card__id">${fmtId('S', s.id)} · ${formatJalaliDisplay(s.date)}</div>
        <div class="rec-card__meta">
          ${!opts.hideCustomer && c ? `<span>${ic('users')}${esc(customerFullName(c))}</span>` : ''}
          ${!opts.hideCustomer && c && c.phone ? `<a class="tel-link" href="tel:${esc(c.phone)}" onclick="event.stopPropagation()">${ic('phone')}${esc(c.phone)}</a>` : ''}
          ${!opts.hideProduct && p ? `<span>${ic('box')}${esc(p.name)}</span>` : ''}
          <span>${fmtPrice(s.price)}</span>
          <span>${ic('calendar')}تاریخ خرید: ${formatJalaliDisplay(s.date)}</span>
        </div>
        ${s.description ? `<div class="rec-card__desc">${esc(s.description)}</div>` : ''}
        ${s.shipped ? `<div class="sale-shipped-badge">${ic('check')}ارسال شد</div>` : ''}
      </div>
      <button class="menu-btn" data-menu="${s.id}">${ic('dots')}</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      const s = byId(state.sales, id);
      openMenu(btn, [
        { key: 'edit', label: 'ویرایش', icon: 'edit', onClick: () => openSaleForm(id) },
        { key: 'ship', label: s && s.shipped ? 'لغو ارسال شد' : 'ارسال شد', icon: 'check', onClick: () => toggleSaleShipped(id) },
        { sep: true },
        { key: 'del', label: 'حذف فروش', icon: 'trash', danger: true, onClick: () => deleteSale(id) },
      ]);
    });
  });
}

async function toggleSaleShipped(id) {
  const s = byId(state.sales, id);
  if (!s) return;
  await idb.put('sales', { ...s, shipped: !s.shipped });
  await loadAll();
  toast(!s.shipped ? 'به‌عنوان ارسال‌شده علامت خورد' : 'علامت ارسال‌شده برداشته شد');
  router();
}

function customerProductSelectOptions(selectedCustomerId, selectedProductId) {
  const custOpts = state.customers.map((c) => `<option value="${c.id}" ${selectedCustomerId === c.id ? 'selected' : ''}>${esc(customerFullName(c))}</option>`).join('');
  const prodOpts = state.products.map((p) => `<option value="${p.id}" ${selectedProductId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  return { custOpts, prodOpts };
}

/* --- کامبوباکس جستجوپذیر (انتخاب مشتری/محصول و مشابه) --- */
function comboFieldHTML(fieldKey, label, required, placeholder) {
  return `
    <div class="field">
      <label>${esc(label)}${required ? ' *' : ''}</label>
      <div class="combo" data-combo-name="${fieldKey}">
        <input type="text" class="combo-input" placeholder="${esc(placeholder || 'جستجو و انتخاب...')}" autocomplete="off">
        <input type="hidden" name="${fieldKey}">
        <div class="combo-list"></div>
      </div>
    </div>`;
}
function initComboField(wrap, fieldKey, items, selectedId, opts = {}) {
  const getLabel = opts.getLabel || ((x) => String(x));
  const getSub = opts.getSub || (() => '');
  const emptyText = opts.emptyText || 'موردی یافت نشد';
  const root = wrap.querySelector(`[data-combo-name="${fieldKey}"]`);
  if (!root) return null;
  const input = root.querySelector('.combo-input');
  const hidden = root.querySelector('input[type="hidden"]');
  const listEl = root.querySelector('.combo-list');
  let selected = selectedId != null ? items.find((it) => it.id === selectedId) : null;

  function closeList() { listEl.classList.remove('open'); }
  function renderSelected() {
    const old = root.querySelector('.combo-selected');
    if (old) old.remove();
    if (selected) {
      input.style.display = 'none';
      closeList();
      const chip = document.createElement('div');
      chip.className = 'combo-selected';
      chip.innerHTML = `<span>${esc(getLabel(selected))}</span><button type="button">${ic('x')}</button>`;
      chip.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        selected = null;
        input.value = '';
        renderSelected();
        input.style.display = '';
        input.focus();
        if (opts.onSelect) opts.onSelect(null);
      });
      root.appendChild(chip);
    } else {
      input.style.display = '';
    }
    hidden.value = selected ? selected.id : '';
  }
  function renderList() {
    const q = input.value.trim();
    const filtered = q ? items.filter((it) => getLabel(it).includes(q) || (getSub(it) || '').includes(q)) : items;
    listEl.innerHTML = filtered.length
      ? filtered.map((it) => `
        <div class="combo-item" data-id="${it.id}">
          <span class="combo-item__name">${esc(getLabel(it))}</span>
          ${getSub(it) ? `<span class="combo-item__sub">${esc(getSub(it))}</span>` : ''}
        </div>`).join('')
      : `<div class="combo-empty">${esc(emptyText)}</div>`;
    listEl.querySelectorAll('.combo-item').forEach((el) => {
      el.addEventListener('click', () => {
        selected = items.find((it) => it.id === Number(el.dataset.id));
        renderSelected();
        if (opts.onSelect) opts.onSelect(selected);
      });
    });
  }
  input.addEventListener('input', () => { renderList(); listEl.classList.add('open'); });
  input.addEventListener('focus', () => { renderList(); listEl.classList.add('open'); });
  wrap.addEventListener('click', (e) => { if (!root.contains(e.target)) closeList(); });

  renderSelected();
  return { getSelected: () => selected, setSelected: (item) => { selected = item; renderSelected(); } };
}

function openSaleForm(id, presets = {}) {
  const rec = id ? byId(state.sales, id) : null;
  const formData = rec ? { ...rec } : { date: todayISO(), customerId: presets.customerId || null, productId: presets.productId || null, price: '', saleType: 'نقدی', description: '' };
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${rec ? 'ویرایش فروش' : 'ثبت فروش جدید'}</h3>
    <form id="saleForm">
      ${dateFieldHTML('date', formData.date, 'تاریخ فروش', true)}
      ${comboFieldHTML('customerId', 'مشتری', true, 'جستجوی نام یا شماره مشتری...')}
      ${comboFieldHTML('productId', 'محصول', true, 'جستجوی نام محصول...')}
      <div class="field-row">
        <div class="field"><label>قیمت فروش (تومان) *</label><input name="price" type="text" required value="${formData.price ? formatThousandsStr(String(formData.price)) : ''}"></div>
        <div class="field"><label>نوع فروش</label><select name="saleType">${SALE_TYPE_LIST.map((s) => `<option ${formData.saleType === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>
      <div class="price-suggest" id="priceSuggest"></div>
      <div class="field"><label>توضیحات</label><textarea name="description">${esc(formData.description)}</textarea></div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ذخیره</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  initDateFields(wrap, formData);
  initComboField(wrap, 'customerId', state.customers, formData.customerId, {
    getLabel: (c) => customerFullName(c),
    getSub: (c) => c.phone || '',
  });
  const priceInput = wrap.querySelector('#saleForm input[name="price"]');
  wireMoneyInput(priceInput);
  const priceSuggestEl = wrap.querySelector('#priceSuggest');
  function renderPriceSuggest(product) {
    const prices = product ? productPrices(product) : [];
    if (prices.length < 2) { priceSuggestEl.innerHTML = ''; return; }
    priceSuggestEl.innerHTML = prices.map((pr) => `<button type="button" data-amt="${pr.amount}">${esc(pr.label)} · ${fmtPrice(pr.amount)}</button>`).join('');
    priceSuggestEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => { priceInput.value = formatThousandsStr(btn.dataset.amt); });
    });
  }
  initComboField(wrap, 'productId', state.products, formData.productId, {
    getLabel: (p) => p.name,
    getSub: (p) => fmtProductPrice(p),
    onSelect: (p) => renderPriceSuggest(p),
  });
  renderPriceSuggest(formData.productId ? byId(state.products, formData.productId) : null);
  wrap.querySelector('#saleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const customerId = Number(fd.get('customerId'));
    const productId = Number(fd.get('productId'));
    if (!customerId) { toast('لطفاً مشتری را انتخاب کنید'); return; }
    if (!productId) { toast('لطفاً محصول را انتخاب کنید'); return; }
    const payload = {
      date: formData.date || todayISO(), customerId, productId,
      price: getMoneyValue(priceInput), saleType: fd.get('saleType'), description: fd.get('description').trim(),
    };
    if (rec) { payload.id = rec.id; await idb.put('sales', payload); toast('فروش ویرایش شد'); }
    else { await idb.add('sales', payload); toast('فروش ثبت شد'); }
    await loadAll(); closeModal(); router();
  });
}

async function deleteSale(id) {
  confirmDialog('حذف فروش', 'این رکورد فروش برای همیشه حذف خواهد شد.', async () => {
    await idb.delete('sales', id); await loadAll(); toast('فروش حذف شد'); router();
  });
}

/* ========================================================================
   11) گفتگوها
   ======================================================================== */
function computeConversationList() {
  const f = state.filters.conversations;
  let list = state.conversations.slice();
  if (f.result) list = list.filter((c) => c.result === f.result);
  if (f.when === 'today') { const t = todayISO(); list = list.filter((c) => c.date === t); }
  if (f.when === 'week') { const w = weekRangeISO(todayISO()); list = list.filter((c) => c.date >= w.start && c.date <= w.end); }
  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    list = list.filter((c) => {
      const cu = byId(state.customers, c.customerId);
      return (cu && customerFullName(cu).includes(q)) || (c.text || '').includes(q);
    });
  }
  return list;
}

function renderConversations(view) {
  const f = state.filters.conversations;
  const activeCount = (f.result ? 1 : 0) + (f.when ? 1 : 0);
  view.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${ic('search')}<input id="convSearch" placeholder="جستجوی مشتری یا متن گفتگو" value="${esc(f.q)}"></div>
      <button class="tbtn tbtn-filter" id="convFilterBtn">${ic('filter')}<span>فیلتر</span>${activeCount ? '<span class="tbtn__dot"></span>' : ''}</button>
      <button class="tbtn tbtn-add" id="convAddBtn">${ic('plus')}<span>افزودن</span></button>
    </div>
    ${f.when ? `<div class="quick-banner"><span>${ic('filter')}${f.when === 'today' ? 'گفتگوهای امروز' : 'گفتگوهای این هفته'}</span><button id="clearWhenBtn">${ic('x')}پاک کردن</button></div>` : ''}
    <div class="list" id="convList"></div>`;
  renderConversationCards(document.getElementById('convList'), computeConversationList());
  document.getElementById('convSearch').addEventListener('input', (e) => { f.q = e.target.value; renderConversationCards(document.getElementById('convList'), computeConversationList()); });
  document.getElementById('convAddBtn').addEventListener('click', () => openConversationForm());
  document.getElementById('convFilterBtn').addEventListener('click', () => openConvFilterSheet(view));
  const clearBtn = document.getElementById('clearWhenBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => { f.when = ''; renderConversations(view); });
}

function openConvFilterSheet(view) {
  const f = state.filters.conversations;
  const whenOpts = [['', 'همه'], ['today', 'امروز'], ['week', 'این هفته']];
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">فیلتر گفتگوها</h3>
    <div class="field"><label>بازه‌ی زمانی</label></div>
    <div class="filter-chips" id="whenChips">${whenOpts.map(([v, l]) => `<button class="chip ${f.when === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="field" style="margin-top:14px;"><label>نتیجه گفتگو</label></div>
    <div class="filter-chips" id="resChips">
      <button class="chip ${!f.result ? 'active' : ''}" data-v="">همه</button>
      ${RESULT_LIST.map((s) => `<button class="chip ${f.result === s ? 'active' : ''}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <div class="modal__actions"><button class="btn primary block" data-close-modal>اعمال</button></div>`;
  const wrap = openModal(html);
  wrap.querySelectorAll('#whenChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.when = chip.dataset.v; renderConversations(view); openConvFilterSheet(view); }));
  wrap.querySelectorAll('#resChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.result = chip.dataset.v; renderConversations(view); openConvFilterSheet(view); }));
}

const RESULT_BADGE = { 'رضایت بخش': 'st-bought', 'ناامید کننده': 'st-lost', 'قابل پیگیری': 'st-followup', 'منجر به خرید': 'st-called' };

function renderConversationCards(el, list, opts = {}) {
  if (!list.length) { el.innerHTML = `<div class="empty-state">${ic('chat')}<div class="empty-state__title">گفتگویی ثبت نشده</div></div>`; return; }
  const today = todayISO();
  el.innerHTML = list.map((c) => {
    const cu = byId(state.customers, c.customerId); const p = byId(state.products, c.productId);
    const dueToday = c.nextFollowUp === today;
    return `
    <div class="rec-card" style="border-right-color:var(--info);" data-id="${c.id}">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${!opts.hideCustomer && cu ? esc(customerFullName(cu)) : fmtId('G', c.id)}</span>
          <span class="badge ${RESULT_BADGE[c.result] || 'st-new'}">${esc(c.result || '—')}</span>
          ${dueToday ? `<span class="due-glow">${ic('bell')}پیگیری امروز</span>` : ''}
        </div>
        <div class="rec-card__id">${fmtId('G', c.id)} · ${formatJalaliDisplay(c.date)}</div>
        <div class="rec-card__meta">
          ${p ? `<span>${ic('box')}${esc(p.name)}</span>` : ''}
          ${c.nextFollowUp ? `<span>${ic('calendar')}پیگیری: ${formatJalaliDisplay(c.nextFollowUp)}</span>` : ''}
        </div>
        ${c.text ? `<div class="rec-card__desc">${esc(c.text)}</div>` : ''}
      </div>
      <button class="menu-btn" data-menu="${c.id}">${ic('dots')}</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      openMenu(btn, [
        { key: 'edit', label: 'ویرایش', icon: 'edit', onClick: () => openConversationForm(id) },
        { sep: true },
        { key: 'del', label: 'حذف گفتگو', icon: 'trash', danger: true, onClick: () => deleteConversation(id) },
      ]);
    });
  });
}

function openConversationForm(id, presets = {}) {
  const rec = id ? byId(state.conversations, id) : null;
  const formData = rec ? { ...rec } : { date: todayISO(), customerId: presets.customerId || null, productId: presets.productId || null, text: '', result: 'قابل پیگیری', description: '', nextFollowUp: null };
  const { custOpts, prodOpts } = customerProductSelectOptions(formData.customerId, formData.productId);
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${rec ? 'ویرایش گفتگو' : 'ثبت گفتگوی جدید'}</h3>
    <form id="convForm">
      ${dateFieldHTML('date', formData.date, 'تاریخ گفتگو', true)}
      <div class="field"><label>مشتری *</label><select name="customerId" required>${!formData.customerId ? '<option value="">انتخاب کنید</option>' : ''}${custOpts}</select></div>
      <div class="field"><label>محصول</label><select name="productId"><option value="">— بدون محصول —</option>${prodOpts}</select></div>
      <div class="field"><label>متن گفتگو</label><textarea name="text">${esc(formData.text)}</textarea></div>
      <div class="field"><label>نتیجه</label><select name="result">${RESULT_LIST.map((s) => `<option ${formData.result === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      ${dateFieldHTML('nextFollowUp', formData.nextFollowUp, 'پیگیری بعدی')}
      <div class="field"><label>توضیحات</label><textarea name="description">${esc(formData.description)}</textarea></div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ذخیره</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  initDateFields(wrap, formData);
  wrap.querySelector('#convForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const productId = fd.get('productId') ? Number(fd.get('productId')) : null;
    const payload = {
      date: formData.date || todayISO(), customerId: Number(fd.get('customerId')), productId,
      text: fd.get('text').trim(), result: fd.get('result'), description: fd.get('description').trim(),
      nextFollowUp: formData.nextFollowUp || null,
    };
    if (rec) { payload.id = rec.id; await idb.put('conversations', payload); toast('گفتگو ویرایش شد'); }
    else { await idb.add('conversations', payload); toast('گفتگو ثبت شد'); }
    await loadAll(); closeModal(); router();
  });
}

async function deleteConversation(id) {
  confirmDialog('حذف گفتگو', 'این گفتگو برای همیشه حذف خواهد شد.', async () => {
    await idb.delete('conversations', id); await loadAll(); toast('گفتگو حذف شد'); router();
  });
}

/* ========================================================================
   12) واریزی‌ها
   ======================================================================== */
function normalizeNameForMatch(name) {
  return String(name || '')
    .replace(/[\u200c\u200f\u200e]/g, '')
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function normalizePhoneForMatch(phone) {
  return faToEnDigits(String(phone || '')).replace(/[^\d]/g, '');
}
/* اعتبارسنجی شماره موبایل ایران: باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد */
function isValidIranPhone(phone) {
  const digits = normalizePhoneForMatch(phone);
  return /^09\d{9}$/.test(digits);
}

/* تشخیص مشتری تکراری و ثبت نهایی خرید: اول شماره تماس، سپس نام و نام خانوادگی؛ در صورت نبود تطابق، مشتری جدید ساخته می‌شود.
   این تابع فقط در لحظه‌ی «تکمیل و ثبت نهایی» یک واریزی صدا زده می‌شود، پس همیشه یعنی مشتری «خرید کرده» است. */
/* یافتن مشتری تطابق‌دار: اول شماره تماس، سپس نام و نام‌خانوادگی (normalize‌شده) */
function findMatchingCustomer(phone, firstName, lastName) {
  const normPhone = normalizePhoneForMatch(phone);
  const fullName = `${firstName} ${lastName}`.trim();
  const normName = normalizeNameForMatch(fullName);
  let customer = null;
  if (normPhone) customer = state.customers.find((c) => normalizePhoneForMatch(c.phone) === normPhone);
  if (!customer && normName) customer = state.customers.find((c) => normalizeNameForMatch(customerFullName(c)) === normName);
  return customer;
}

/* تشخیص مشتری تکراری و ثبت نهایی خرید: این تابع فقط در لحظه‌ی «تکمیل و ثبت نهایی» یک واریزی صدا زده می‌شود،
   پس همیشه یعنی مشتری «خرید کرده» است و هر پیگیری فعال آن بسته می‌شود. */
async function matchOrCreateCustomer(phone, firstName, lastName, address) {
  const customer = findMatchingCustomer(phone, firstName, lastName);
  if (customer) {
    const patch = { status: 'خرید کرده', nextFollowUp: null, nextFollowUpTime: null };
    if (phone && phone.trim() && customer.phone !== phone.trim()) patch.phone = phone.trim();
    if (address && address.trim() && customer.address !== address.trim()) patch.address = address.trim();
    await idb.put('customers', { ...customer, ...patch, id: customer.id });
    return customer.id;
  }
  return idb.add('customers', {
    firstName, lastName, phone: phone || '', address: address || '',
    lastContact: null, nextFollowUp: null, nextFollowUpTime: null, status: 'خرید کرده', description: '', createdAt: todayISO(),
  });
}

/* اتصال/ایجاد مشتری برای یک «لید» با واریزی آینده — منبع واحد پیگیری همان رکورد مشتری است */
async function linkLeadCustomer(phone, firstName, lastName, followUpDate, followUpTime) {
  const customer = findMatchingCustomer(phone, firstName, lastName);
  if (customer) {
    const patch = { status: 'نیاز به پیگیری', nextFollowUp: followUpDate, nextFollowUpTime: followUpTime || null };
    if (phone && phone.trim() && customer.phone !== phone.trim()) patch.phone = phone.trim();
    await idb.put('customers', { ...customer, ...patch, id: customer.id });
    return customer.id;
  }
  return idb.add('customers', {
    firstName, lastName, phone: phone || '', address: '',
    lastContact: null, nextFollowUp: followUpDate, nextFollowUpTime: followUpTime || null,
    status: 'نیاز به پیگیری', description: '', createdAt: todayISO(),
  });
}

function paymentRowHTML(p) {
  const isDone = p.status === 'completed';
  const color = isDone ? 'var(--success)' : 'var(--danger)';
  const name = (p.customerName || '').trim();
  const product = p.productId ? byId(state.products, p.productId) : null;
  const isPastPending = p.status === 'pending' && p.date < todayISO();
  return `
    <div class="rec-card" style="border-right-color:${color};" data-id="${p.id}">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${name ? esc(name) : fmtId('P', p.id)}</span>
          <span class="badge ${isDone ? 'pay-completed' : 'pay-pending'}">${isDone ? 'ثبت شده' : 'ثبت نشده'}</span>
        </div>
        <div class="rec-card__id"${isPastPending ? ' style="color:var(--accent);font-weight:700;"' : ''}>${formatJalaliDisplay(p.date)} · ${fmtId('P', p.id)}</div>
        <div class="rec-card__meta">
          <span>${ic('wallet')}${fmtPrice(p.amount)}</span>
          ${product ? `<span>${ic('box')}${esc(product.name)}</span>` : ''}
          ${p.phone ? `<a class="tel-link" href="tel:${esc(p.phone)}" onclick="event.stopPropagation()">${ic('phone')}${esc(p.phone)}</a>` : ''}
          ${p.address ? `<span>${ic('pin')}${esc(p.address)}</span>` : ''}
        </div>
        ${p.description ? `<div class="rec-card__desc">${esc(p.description)}</div>` : ''}
        ${!isDone ? `<button type="button" class="btn primary" data-complete="${p.id}" style="margin-top:10px;padding:9px 14px;font-size:12.5px;">${ic('check')}تکمیل و ثبت</button>` : ''}
      </div>
      <button class="menu-btn" data-menu="${p.id}">${ic('dots')}</button>
    </div>`;
}

function wirePaymentRows(container) {
  container.querySelectorAll('[data-complete]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openPaymentCompleteForm(Number(btn.dataset.complete)); });
  });
  container.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      const p = byId(state.payments, id);
      if (!p) return;
      openMenu(btn, [
        { key: 'edit', label: p.status === 'completed' ? 'ویرایش' : 'تکمیل و ثبت', icon: 'edit', onClick: () => openPaymentCompleteForm(id) },
        { sep: true },
        { key: 'del', label: 'حذف واریزی', icon: 'trash', danger: true, onClick: () => deletePayment(id) },
      ]);
    });
  });
}

/* --- پنل «واریزی‌های امروز» در داشبرد --- */
function paymentsTodayPanelHTML() {
  const today = todayISO();
  const list = state.payments.filter((p) => (p.status === 'pending' && p.date <= today) || (p.status === 'completed' && p.date === today));
  const pendingCount = list.filter((p) => p.status !== 'completed').length;
  const followupCount = state.payments.filter((p) => p.status === 'followup').length;
  let hint = 'هنوز واریزی‌ای برای امروز ثبت نشده';
  if (list.length) hint = pendingCount ? `${faDigits(pendingCount)} واریزی نیاز به تکمیل دارد` : 'همه‌ی واریزی‌های امروز ثبت شده‌اند';
  return `
    <div class="section-title">${ic('wallet')} واریزی‌های امروز<span class="cnt">${faDigits(list.length)}</span></div>
    <div class="payments-today-panel">
      <div class="payments-today-panel__head">
        <div class="payments-today-panel__hint">${esc(hint)}</div>
        <div class="payments-today-panel__actions">
          <button type="button" class="btn secondary" id="followupsBtn" style="padding:8px 12px;font-size:12px;">${ic('clock')}پیگیری‌ها${followupCount ? `<span class="cnt" style="margin-right:0;">${faDigits(followupCount)}</span>` : ''}</button>
          <button type="button" class="btn secondary" id="paymentsHistoryBtn" style="padding:8px 12px;font-size:12px;">${ic('clock')}تاریخچه</button>
          <button type="button" class="btn primary" id="paymentAddBtn" style="padding:8px 12px;font-size:12px;">${ic('plus')}افزودن واریزی</button>
        </div>
      </div>
      <div class="payments-today-list${list.length ? '' : ' is-empty'}">
        ${list.length ? list.map((p) => paymentRowHTML(p)).join('') : `<div class="empty-state" style="padding:22px;">${ic('wallet')}<div class="empty-state__desc">واریزی‌ای برای امروز ثبت نشده است</div></div>`}
      </div>
    </div>`;
}
function wirePaymentsTodayPanel(view) {
  const addBtn = document.getElementById('paymentAddBtn');
  if (addBtn) addBtn.addEventListener('click', () => openPaymentAddForm());
  const histBtn = document.getElementById('paymentsHistoryBtn');
  if (histBtn) histBtn.addEventListener('click', () => { location.hash = '#/payments-history'; });
  const fuBtn = document.getElementById('followupsBtn');
  if (fuBtn) fuBtn.addEventListener('click', () => { location.hash = '#/followups'; });
  const listEl = view.querySelector('.payments-today-list');
  if (listEl) wirePaymentRows(listEl);
}

/* --- ثبت دستیِ واریزی جدید؛ اگر لحظه‌ی هدف (تاریخ + زمان پیگیری) در آینده باشد = پیگیری --- */
function normalizeTimeHHMM(t) {
  const m = String(t || '').match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}
function isFutureLeadMoment(dateStr, timeStr) {
  if (!dateStr) return false;
  const today = todayISO();
  if (dateStr > today) return true;
  const hhmm = normalizeTimeHHMM(timeStr);
  if (dateStr === today && hhmm) {
    const dt = new Date(`${dateStr}T${hhmm}:00`);
    return !Number.isNaN(dt.getTime()) && dt > new Date();
  }
  return false;
}
function openPaymentAddForm() {
  const formData = { date: todayISO() };
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">افزودن واریزی</h3>
    <form id="paymentAddForm">
      <div class="field"><label>مبلغ (تومان) *</label><input name="amount" type="text" required placeholder="مثلاً ۱,۰۰۰,۰۰۰"></div>
      ${dateFieldHTML('date', formData.date, 'تاریخ واریزی', true)}
      <div class="field"><label>زمان پیگیری (اختیاری)</label><input name="fuTime" type="time"></div>
      <div class="field__hint" id="addHint" style="margin:-4px 2px 4px;">اطلاعات مشتری (نام، شماره تماس، آدرس) را می‌توانید در مرحله‌ی «تکمیل و ثبت» وارد کنید.</div>
      <div id="futureFuFields" style="display:none;">
        <div class="field__hint" style="margin:0 2px 10px;color:var(--accent);">این مورد به «پیگیری‌ها» اضافه می‌شود.</div>
        <div class="field-row">
          <div class="field"><label>نام</label><input name="fuFirstName"></div>
          <div class="field"><label>نام خانوادگی</label><input name="fuLastName"></div>
        </div>
        <div class="field"><label>شماره تماس</label><input name="fuPhone" inputmode="tel"></div>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ثبت واریزی</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  const futureBox = wrap.querySelector('#futureFuFields');
  const hintBox = wrap.querySelector('#addHint');
  const timeInput = wrap.querySelector('#paymentAddForm input[name="fuTime"]');
  function syncFutureVisibility() {
    const isFuture = isFutureLeadMoment(formData.date, timeInput.value);
    futureBox.style.display = isFuture ? '' : 'none';
    hintBox.style.display = isFuture ? 'none' : '';
  }
  initDateFields(wrap, formData, syncFutureVisibility);
  timeInput.addEventListener('input', syncFutureVisibility);
  timeInput.addEventListener('change', syncFutureVisibility);
  syncFutureVisibility();
  const amountInput = wrap.querySelector('#paymentAddForm input[name="amount"]');
  wireMoneyInput(amountInput);
  wrap.querySelector('#paymentAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = getMoneyValue(amountInput);
    if (!amount || amount <= 0) { toast('مبلغ معتبر وارد کنید'); return; }
    const fd = new FormData(e.target);
    const now = Date.now();
    const time = normalizeTimeHHMM(fd.get('fuTime'));
    const isFuture = isFutureLeadMoment(formData.date, time);
    if (isFuture) {
      const fName = fd.get('fuFirstName').trim();
      const lName = fd.get('fuLastName').trim();
      if (!fName || !lName) { toast('برای پیگیری، نام و نام خانوادگی الزامی است'); return; }
      const phoneRaw = fd.get('fuPhone').trim();
      if (phoneRaw && !isValidIranPhone(phoneRaw)) { toast('شماره تماس معتبر نیست — باید با ۰۹ شروع شود و ۱۱ رقم باشد'); return; }
      const phone = phoneRaw ? normalizePhoneForMatch(phoneRaw) : '';
      const customerId = await linkLeadCustomer(phone, fName, lName, formData.date, time || null);
      await idb.add('payments', {
        amount, date: formData.date,
        customerId, customerName: `${fName} ${lName}`.trim(), phone, address: '', description: '',
        status: 'followup', source: 'manual', bank: 'meli',
        createdAt: now, completedAt: null, updatedAt: now,
      });
      toast('به پیگیری‌ها اضافه شد');
    } else {
      await idb.add('payments', {
        amount, date: formData.date || todayISO(),
        customerId: null, customerName: '', phone: '', address: '', description: '',
        status: 'pending', source: 'manual', bank: 'meli',
        createdAt: now, completedAt: null, updatedAt: now,
      });
      toast('واریزی ثبت شد');
    }
    await loadAll(); closeModal(); router();
  });
}

/* --- تکمیل/ویرایش واریزی: اتصال یا ایجاد مشتری، ثبت فروش مرتبط و تغییر وضعیت به ثبت‌شده --- */
function openPaymentCompleteForm(id) {
  const rec = byId(state.payments, id);
  if (!rec) return;
  const isDone = rec.status === 'completed';
  let firstName = ''; let lastName = '';
  if (rec.customerId) {
    const cust = byId(state.customers, rec.customerId);
    if (cust) { firstName = cust.firstName || ''; lastName = cust.lastName || ''; }
  }
  if (!firstName && !lastName && rec.customerName) {
    const parts = rec.customerName.trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }
  const formData = { date: rec.date };
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${isDone ? 'ویرایش واریزی' : 'تکمیل و ثبت واریزی'}</h3>
    <form id="paymentCompleteForm">
      <div class="field"><label>مبلغ (تومان) *</label><input name="amount" type="text" required value="${formatThousandsStr(String(rec.amount))}"></div>
      ${dateFieldHTML('date', formData.date, 'تاریخ واریزی', true)}
      <div class="field-row">
        <div class="field"><label>نام *</label><input name="firstName" required value="${esc(firstName)}"></div>
        <div class="field"><label>نام خانوادگی *</label><input name="lastName" required value="${esc(lastName)}"></div>
      </div>
      <div class="field"><label>شماره تماس</label><input name="phone" inputmode="tel" value="${esc(rec.phone || '')}"></div>
      <div class="field"><label>آدرس</label><textarea name="address">${esc(rec.address || '')}</textarea></div>
      ${comboFieldHTML('productId', 'نوع محصول', true, 'جستجوی نام محصول...')}
      <div class="price-suggest" id="paymentPriceSuggest"></div>
      <div class="field"><label>توضیحات</label><textarea name="description">${esc(rec.description || '')}</textarea></div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}${isDone ? 'ذخیره تغییرات' : 'تأیید و ثبت'}</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  initDateFields(wrap, formData);
  const amountInput = wrap.querySelector('#paymentCompleteForm input[name="amount"]');
  wireMoneyInput(amountInput);
  const priceSuggestEl = wrap.querySelector('#paymentPriceSuggest');
  function renderPaymentPriceSuggest(product) {
    const prices = product ? productPrices(product) : [];
    if (prices.length < 2) { priceSuggestEl.innerHTML = ''; return; }
    priceSuggestEl.innerHTML = prices.map((pr) => `<button type="button" data-amt="${pr.amount}">${esc(pr.label)} · ${fmtPrice(pr.amount)}</button>`).join('');
    priceSuggestEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => { amountInput.value = formatThousandsStr(btn.dataset.amt); });
    });
  }
  initComboField(wrap, 'productId', state.products, rec.productId || null, {
    getLabel: (p) => p.name,
    getSub: (p) => fmtProductPrice(p),
    emptyText: 'محصولی پیدا نشد',
    onSelect: (p) => renderPaymentPriceSuggest(p),
  });
  renderPaymentPriceSuggest(rec.productId ? byId(state.products, rec.productId) : null);
  wrap.querySelector('#paymentCompleteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    const fd = new FormData(e.target);
    const amount = getMoneyValue(amountInput);
    if (!amount || amount <= 0) { toast('مبلغ معتبر وارد کنید'); return; }
    const fName = fd.get('firstName').trim();
    const lName = fd.get('lastName').trim();
    if (!fName || !lName) { toast('نام و نام خانوادگی مشتری الزامی است'); return; }
    const productId = Number(fd.get('productId'));
    if (!productId) { toast('لطفاً نوع محصول را انتخاب کنید'); return; }
    const phoneRaw = fd.get('phone').trim();
    if (phoneRaw && !isValidIranPhone(phoneRaw)) { toast('شماره تماس معتبر نیست — باید با ۰۹ شروع شود و ۱۱ رقم باشد'); return; }
    const phone = phoneRaw ? normalizePhoneForMatch(phoneRaw) : '';
    const address = fd.get('address').trim();
    const description = fd.get('description').trim();

    submitBtn.disabled = true;
    try {
      const customerId = await matchOrCreateCustomer(phone, fName, lName, address);
      const now = Date.now();
      const paymentPayload = {
        id: rec.id, amount, date: formData.date || rec.date,
        customerId, customerName: `${fName} ${lName}`.trim(), phone, address, description, productId,
        status: 'completed', source: rec.source || 'manual', bank: rec.bank || 'meli',
        createdAt: rec.createdAt, completedAt: rec.completedAt || now, updatedAt: now,
      };
      await idb.put('payments', paymentPayload);
      await upsertSaleForPayment(paymentPayload, customerId, productId);
      await loadAll();
      closeModal();
      toast(isDone ? 'واریزی ویرایش شد' : 'واریزی و فروش ثبت شد');
      router();
    } catch (err) {
      submitBtn.disabled = false;
      toast('خطا در ثبت اطلاعات — دوباره تلاش کنید');
    }
  });
}

/* هر واریزی حداکثر یک فروش مرتبط دارد؛ در صورت وجود، به‌جای ایجاد رکورد جدید همان فروش به‌روزرسانی می‌شود */
async function upsertSaleForPayment(payment, customerId, productId) {
  const allSales = await idb.getAll('sales');
  const existing = allSales.find((s) => s.paymentId === payment.id);
  const payload = {
    date: payment.date, customerId, productId, price: payment.amount, saleType: 'نقدی',
    description: payment.description ? `ثبت خودکار از واریزی — ${payment.description}` : 'ثبت خودکار از واریزی',
    paymentId: payment.id,
  };
  if (existing) return idb.put('sales', { ...existing, ...payload, id: existing.id });
  return idb.add('sales', payload);
}

async function deletePayment(id) {
  confirmDialog('حذف واریزی', 'این رکورد واریزی برای همیشه حذف خواهد شد (مشتری متصل‌شده حذف نمی‌شود).', async () => {
    await idb.delete('payments', id); await loadAll(); toast('واریزی حذف شد'); router();
  });
}

/* --- تاریخچه‌ی واریزی‌های ثبت‌شده --- */
function computePaymentsHistoryList() {
  const f = state.filters.paymentsHistory;
  let list = state.payments.filter((p) => p.status === 'completed');
  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    const qDigits = faToEnDigits(q);
    list = list.filter((p) => {
      const nameHit = (p.customerName || '').includes(q);
      const phoneHit = (p.phone || '').includes(q) || faToEnDigits(p.phone || '').includes(qDigits);
      const dateHit = formatJalaliDisplay(p.date).includes(q) || p.date.includes(qDigits);
      const amountHit = String(p.amount).includes(qDigits) || faDigits(String(p.amount)).includes(q);
      return nameHit || phoneHit || dateHit || amountHit;
    });
  }
  if (f.sort === 'oldest') list.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  else if (f.sort === 'amount-desc') list.sort((a, b) => b.amount - a.amount);
  else if (f.sort === 'amount-asc') list.sort((a, b) => a.amount - b.amount);
  else list.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return list;
}

function renderPaymentHistoryList() {
  const list = computePaymentsHistoryList();
  const totalAmount = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const summaryEl = document.getElementById('paymentsHistorySummary');
  if (summaryEl) summaryEl.textContent = `${faDigits(list.length)} واریزی · مجموع ${fmtPrice(totalAmount)}`;
  const el = document.getElementById('payHistList');
  if (!el) return;
  if (!list.length) { el.innerHTML = `<div class="empty-state">${ic('wallet')}<div class="empty-state__title">واریزی‌ای یافت نشد</div></div>`; return; }
  el.innerHTML = list.map((p) => paymentRowHTML(p)).join('');
  wirePaymentRows(el);
}

function renderPaymentsHistory(view) {
  const f = state.filters.paymentsHistory;
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">${ic('chevR')}</button>
      <div>
        <h3 style="font-size:15.5px;">تاریخچه واریزی‌ها</h3>
        <div style="font-size:11.5px;color:var(--ink-soft);" id="paymentsHistorySummary"></div>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-box">${ic('search')}<input id="paySearch" placeholder="جستجوی نام، شماره، تاریخ یا مبلغ" value="${esc(f.q)}"></div>
      <button class="tbtn tbtn-filter" id="payFilterBtn">${ic('filter')}<span>مرتب‌سازی</span>${f.sort !== 'newest' ? '<span class="tbtn__dot"></span>' : ''}</button>
    </div>
    <div class="list" id="payHistList"></div>`;
  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/dashboard'; });
  document.getElementById('paySearch').addEventListener('input', (e) => { f.q = e.target.value; renderPaymentHistoryList(); });
  document.getElementById('payFilterBtn').addEventListener('click', () => openPaymentsHistoryFilterSheet(view));
  renderPaymentHistoryList();
}

function openPaymentsHistoryFilterSheet(view) {
  const f = state.filters.paymentsHistory;
  const sortOpts = [['newest', 'جدیدترین'], ['oldest', 'قدیمی‌ترین'], ['amount-desc', 'بیشترین مبلغ'], ['amount-asc', 'کمترین مبلغ']];
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">مرتب‌سازی تاریخچه</h3>
    <div class="filter-chips" id="paySortChips">
      ${sortOpts.map(([v, l]) => `<button class="chip ${f.sort === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}
    </div>
    <div class="modal__actions"><button class="btn primary block" data-close-modal>اعمال</button></div>`;
  const wrap = openModal(html);
  wrap.querySelectorAll('#paySortChips .chip').forEach((chip) => chip.addEventListener('click', () => {
    f.sort = chip.dataset.v;
    renderPaymentsHistory(view);
    openPaymentsHistoryFilterSheet(view);
  }));
}

/* --- پیگیری‌ها: منبع واحد اطلاعات = رکورد مشتری (nextFollowUp + nextFollowUpTime)
   واریزی‌های در انتظار پیگیری فقط به customerId وصل می‌شوند و تاریخ/زمان را از همان مشتری می‌خوانند
   تا از دوگانگی Reminder جلوگیری شود. --- */
function formatFollowUpTime(timeStr) {
  if (!timeStr) return '';
  return `ساعت ${faDigits(timeStr)}`;
}
function computeFollowUpDot(dateStr, timeStr) {
  if (!dateStr) return 'none';
  const today = todayISO();
  if (dateStr > today) return 'none';
  const hhmm = normalizeTimeHHMM(timeStr);
  if (hhmm) {
    const dt = new Date(`${dateStr}T${hhmm}:00`);
    if (!Number.isNaN(dt.getTime()) && dt <= new Date()) return 'blink';
  }
  return 'static';
}
function followUpDotState(p) {
  const cust = p.customerId ? byId(state.customers, p.customerId) : null;
  const dateStr = cust ? cust.nextFollowUp : p.date;
  const timeStr = cust ? cust.nextFollowUpTime : null;
  return computeFollowUpDot(dateStr, timeStr);
}
function followUpRowHTML(p) {
  const cust = p.customerId ? byId(state.customers, p.customerId) : null;
  const dot = followUpDotState(p);
  const dateStr = cust ? cust.nextFollowUp : p.date;
  const timeStr = cust ? cust.nextFollowUpTime : null;
  const name = (cust ? customerFullName(cust) : (p.customerName || '')).trim();
  return `
    <div class="rec-card" style="border-right-color:var(--accent);" data-id="${p.id}">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${name ? esc(name) : fmtId('P', p.id)}</span>
          ${dot !== 'none' ? `<span class="followup-dot ${dot === 'blink' ? 'blink' : ''}"></span>` : ''}
        </div>
        <div class="rec-card__id">${fmtId('P', p.id)} · موعد: ${formatJalaliDisplay(dateStr)}${timeStr ? ` · ${formatFollowUpTime(timeStr)}` : ''}</div>
        <div class="rec-card__meta">
          <span>${ic('wallet')}${fmtPrice(p.amount)}</span>
          ${p.phone ? `<a class="tel-link" href="tel:${esc(p.phone)}" onclick="event.stopPropagation()">${ic('phone')}${esc(p.phone)}</a>` : ''}
        </div>
        ${p.description ? `<div class="rec-card__desc">${esc(p.description)}</div>` : ''}
        <button type="button" class="btn followup-go-btn" data-followup-action="${p.id}" style="margin-top:10px;padding:9px 14px;font-size:12.5px;">${ic('check')}ثبت پیگیری</button>
      </div>
      <button class="menu-btn" data-menu="${p.id}">${ic('dots')}</button>
    </div>`;
}
function computeFollowUpList() {
  const keyOf = (p) => {
    const cust = p.customerId ? byId(state.customers, p.customerId) : null;
    const d = cust ? cust.nextFollowUp : p.date;
    const t = (cust && cust.nextFollowUpTime) || '00:00';
    return `${d || ''}T${t}`;
  };
  return state.payments.filter((p) => p.status === 'followup').sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}
function renderFollowUpListInner() {
  const list = computeFollowUpList();
  const summaryEl = document.getElementById('followupSummary');
  if (summaryEl) summaryEl.textContent = `${faDigits(list.length)} مورد در انتظار پیگیری`;
  const el = document.getElementById('followupList');
  if (!el) return;
  if (!list.length) { el.innerHTML = `<div class="empty-state">${ic('clock')}<div class="empty-state__title">فعلاً پیگیری‌ای ثبت نشده</div></div>`; return; }
  el.innerHTML = list.map((p) => followUpRowHTML(p)).join('');
  el.querySelectorAll('[data-followup-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openFollowUpActionSheet(Number(btn.dataset.followupAction)); });
  });
  el.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      const p = byId(state.payments, id);
      const customerId = p ? p.customerId : null;
      openMenu(btn, [
        { key: 'edit', label: 'ویرایش', icon: 'edit', onClick: () => { if (customerId) openCustomerForm(customerId); else toast('اطلاعات مشتری یافت نشد'); } },
        { key: 'act', label: 'ثبت پیگیری', icon: 'check', onClick: () => openFollowUpActionSheet(id) },
        { sep: true },
        { key: 'del', label: 'حذف', icon: 'trash', danger: true, onClick: () => deletePayment(id) },
      ]);
    });
  });
}
function renderFollowUps(view) {
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">${ic('chevR')}</button>
      <div>
        <h3 style="font-size:15.5px;">پیگیری‌ها</h3>
        <div style="font-size:11.5px;color:var(--ink-soft);" id="followupSummary"></div>
      </div>
    </div>
    <div class="list" id="followupList"></div>`;
  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/dashboard'; });
  renderFollowUpListInner();
}

/* گزینه‌های «ثبت پیگیری»: خرید کرده / نیاز به پیگیری مجدد / منصرف شده */
function openFollowUpActionSheet(id) {
  const rec = byId(state.payments, id);
  if (!rec) return;
  const cust = rec.customerId ? byId(state.customers, rec.customerId) : null;
  const name = (cust ? customerFullName(cust) : (rec.customerName || '')).trim() || fmtId('P', rec.id);
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">ثبت پیگیری — ${esc(name)}</h3>
    <div class="followup-actions">
      <button type="button" class="btn block followup-opt-bought" id="fuBought">${ic('check')}خرید کرده</button>
      <button type="button" class="btn secondary block" id="fuAgain">${ic('clock')}نیاز به پیگیری مجدد</button>
      <button type="button" class="btn secondary block followup-opt-lost" id="fuLost">${ic('x')}منصرف شده</button>
    </div>
    <div class="modal__actions"><button type="button" class="btn secondary block" data-close-modal>انصراف</button></div>`;
  const wrap = openModal(html);
  wrap.querySelector('#fuBought').addEventListener('click', async () => {
    const now = Date.now();
    await idb.put('payments', { ...rec, status: 'pending', date: todayISO(), updatedAt: now });
    /* Reminder فوراً بسته می‌شود؛ وضعیت نهایی «خرید کرده» در لحظه‌ی «تکمیل و ثبت» واریزی ثبت خواهد شد */
    if (cust) await idb.put('customers', { ...cust, nextFollowUp: null, nextFollowUpTime: null });
    await loadAll(); closeModal(); toast('به واریزی‌ها منتقل شد'); router();
  });
  wrap.querySelector('#fuLost').addEventListener('click', () => {
    confirmDialogGeneric(
      'ثبت انصراف',
      `«${name}» به بخش «سوخته‌ها» منتقل می‌شود. ادامه می‌دهید؟`,
      'بله، منصرف شده',
      async () => {
        const now = Date.now();
        await idb.put('payments', { ...rec, status: 'burned', updatedAt: now });
        if (cust) await idb.put('customers', { ...cust, status: 'منصرف شده', nextFollowUp: null, nextFollowUpTime: null });
        await loadAll(); toast('به سوخته‌ها منتقل شد'); router();
      },
    );
  });
  wrap.querySelector('#fuAgain').addEventListener('click', () => { openFollowUpRescheduleForm(rec); });
}

/* پیگیری مجدد: تاریخ/زمان جدید — روی همان رکورد مشتری (منبع واحد) ذخیره می‌شود تا با «مشتریان» هم‌گام بماند */
function openFollowUpRescheduleForm(rec) {
  const cust = rec.customerId ? byId(state.customers, rec.customerId) : null;
  const curDate = (cust && cust.nextFollowUp) || rec.date;
  const curTime = (cust && cust.nextFollowUpTime) || '';
  const formData = { date: curDate && curDate > todayISO() ? curDate : todayISO() };
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">پیگیری مجدد</h3>
    <form id="fuRescheduleForm">
      ${dateFieldHTML('date', formData.date, 'تاریخ پیگیری بعدی', true)}
      <div class="field"><label>زمان پیگیری</label><input name="fuTime" type="time" value="${esc(curTime)}"></div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ذخیره</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  initDateFields(wrap, formData);
  wrap.querySelector('#fuRescheduleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const time = normalizeTimeHHMM(fd.get('fuTime'));
    const date = formData.date || todayISO();
    const now = Date.now();
    await idb.put('payments', { ...rec, date, status: 'followup', updatedAt: now });
    if (cust) await idb.put('customers', { ...cust, status: 'نیاز به پیگیری', nextFollowUp: date, nextFollowUpTime: time || null });
    await loadAll(); closeModal(); toast('پیگیری مجدد ثبت شد'); router();
  });
}

/* --- سوخته‌ها: لیدهایی که «منصرف شده» ثبت شده‌اند (در تنظیمات) --- */
function renderBurnedLeads(view) {
  const list = state.payments.filter((p) => p.status === 'burned').sort((a, b) => b.id - a.id);
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">${ic('chevR')}</button>
      <div>
        <h3 style="font-size:15.5px;">سوخته‌ها</h3>
        <div style="font-size:11.5px;color:var(--ink-soft);">${faDigits(list.length)} مورد منصرف‌شده</div>
      </div>
    </div>
    <div class="list" id="burnedList">
      ${list.length ? list.map((p) => `
        <div class="rec-card" style="border-right-color:var(--ink-faint);" data-id="${p.id}">
          <div class="rec-card__body">
            <div class="rec-card__top">
              <span class="rec-card__title">${esc((p.customerName || '').trim() || fmtId('P', p.id))}</span>
              <span class="badge st-lost">منصرف شده</span>
            </div>
            <div class="rec-card__id">${formatJalaliDisplay(p.date)} · ${fmtId('P', p.id)}</div>
            <div class="rec-card__meta">
              <span>${ic('wallet')}${fmtPrice(p.amount)}</span>
              ${p.phone ? `<a class="tel-link" href="tel:${esc(p.phone)}" onclick="event.stopPropagation()">${ic('phone')}${esc(p.phone)}</a>` : ''}
            </div>
            ${p.description ? `<div class="rec-card__desc">${esc(p.description)}</div>` : ''}
          </div>
          <button class="menu-btn" data-menu="${p.id}">${ic('dots')}</button>
        </div>`).join('') : `<div class="empty-state">${ic('users')}<div class="empty-state__title">موردی در سوخته‌ها نیست</div></div>`}
    </div>`;
  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/settings'; });
  view.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      openMenu(btn, [
        { key: 'del', label: 'حذف همیشگی', icon: 'trash', danger: true, onClick: () => deletePayment(id) },
      ]);
    });
  });
}

/* ========================================================================
   13) تنظیمات
   ======================================================================== */
function renderSettings(view) {
  const theme = getTheme();
  const notifyOn = isNotifyEnabled();
  view.innerHTML = `
    <div class="settings-group">
      <div class="settings-group__title">ظاهر و اعلان‌ها</div>
      <div class="settings-row" id="themeRow">
        <div class="settings-row__icon">${ic('spark')}</div>
        <div class="settings-row__text"><div class="settings-row__title">حالت تاریک</div><div class="settings-row__desc">مناسب استفاده در شب</div></div>
        <button class="switch ${theme === 'dark' ? 'on' : ''}" id="themeSwitch" role="switch" aria-checked="${theme === 'dark'}"><span></span></button>
      </div>
      <div class="settings-row" id="notifyRow">
        <div class="settings-row__icon">${ic('clock')}</div>
        <div class="settings-row__text"><div class="settings-row__title">یادآوری روزانه‌ی پیگیری</div><div class="settings-row__desc">اعلان برای پیگیری‌های امروز، هنگام باز کردن اپ</div></div>
        <button class="switch ${notifyOn ? 'on' : ''}" id="notifySwitch" role="switch" aria-checked="${notifyOn}"><span></span></button>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group__title">مدیریت لیدها</div>
      <div class="settings-row" id="burnedRow">
        <div class="settings-row__icon">${ic('users')}</div>
        <div class="settings-row__text"><div class="settings-row__title">سوخته‌ها</div><div class="settings-row__desc">لیدهایی که از پیگیری منصرف شده‌اند</div></div>
        <div style="font-weight:800;">${faDigits(state.payments.filter((p) => p.status === 'burned').length)}</div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group__title">پشتیبان‌گیری</div>
      <div class="settings-row" id="exportRow">
        <div class="settings-row__icon">${ic('download')}</div>
        <div class="settings-row__text"><div class="settings-row__title">خروجی گرفتن از داده‌ها</div><div class="settings-row__desc">دانلود فایل پشتیبان JSON از تمام اطلاعات</div></div>
      </div>
      <div class="settings-row" id="importRow">
        <div class="settings-row__icon">${ic('upload')}</div>
        <div class="settings-row__text"><div class="settings-row__title">بازیابی از فایل پشتیبان</div><div class="settings-row__desc">جایگزینی داده‌های فعلی با فایل JSON</div></div>
        <input type="file" id="importFile" accept="application/json">
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group__title">آمار دیتابیس</div>
      <div class="settings-row"><div class="settings-row__icon">${ic('users')}</div><div class="settings-row__text"><div class="settings-row__title">مشتریان</div></div><div style="font-weight:800;">${faDigits(state.customers.length)}</div></div>
      <div class="settings-row"><div class="settings-row__icon">${ic('box')}</div><div class="settings-row__text"><div class="settings-row__title">محصولات</div></div><div style="font-weight:800;">${faDigits(state.products.length)}</div></div>
      <div class="settings-row"><div class="settings-row__icon">${ic('cart')}</div><div class="settings-row__text"><div class="settings-row__title">فروش‌ها</div></div><div style="font-weight:800;">${faDigits(state.sales.length)}</div></div>
      <div class="settings-row"><div class="settings-row__icon">${ic('chat')}</div><div class="settings-row__text"><div class="settings-row__title">گفتگوها</div></div><div style="font-weight:800;">${faDigits(state.conversations.length)}</div></div>
      <div class="settings-row"><div class="settings-row__icon">${ic('wallet')}</div><div class="settings-row__text"><div class="settings-row__title">واریزی‌ها</div></div><div style="font-weight:800;">${faDigits(state.payments.length)}</div></div>
    </div>

    <div class="settings-group">
      <div class="settings-group__title">داده‌ها</div>
      <div class="settings-row" id="wipeRow">
        <div class="settings-row__icon" style="background:var(--danger-tint);color:var(--danger);">${ic('wipe')}</div>
        <div class="settings-row__text"><div class="settings-row__title" style="color:var(--danger);">پاک‌سازی کامل داده‌ها</div><div class="settings-row__desc">حذف همیشگی تمام مشتریان، فروش‌ها، گفتگوها و محصولات</div></div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group__title">درباره برنامه</div>
      <div class="settings-row"><div class="settings-row__icon">${ic('info')}</div><div class="settings-row__text"><div class="settings-row__title">مدیریت مشتری</div><div class="settings-row__desc">اپلیکیشن آفلاین (PWA) با تقویم شمسی — تمام داده‌ها فقط روی همین دستگاه ذخیره می‌شود</div></div></div>
    </div>
  `;
  document.getElementById('exportRow').addEventListener('click', exportBackup);
  document.getElementById('burnedRow').addEventListener('click', () => { location.hash = '#/burned-leads'; });
  document.getElementById('importRow').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importBackup);
  document.getElementById('wipeRow').addEventListener('click', wipeAllData);

  document.getElementById('themeSwitch').addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    renderSettings(view);
  });
  document.getElementById('notifySwitch').addEventListener('click', async () => {
    if (isNotifyEnabled()) {
      safeSet(NOTIFY_KEY, '0');
      renderSettings(view);
      return;
    }
    if (!('Notification' in window)) { toast('مرورگر شما از اعلان پشتیبانی نمی‌کند'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      safeSet(NOTIFY_KEY, '1');
      toast('یادآوری روزانه فعال شد');
      checkFollowupNotification();
    } else {
      toast('اجازه‌ی نمایش اعلان داده نشد');
    }
    renderSettings(view);
  });
}

function checkFollowupNotification() {
  if (!isNotifyEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = todayISO();
  if (safeGet(NOTIFY_LAST_KEY) === today) return;
  const count = state.customers.filter((c) => c.nextFollowUp === today).length
    + state.conversations.filter((c) => c.nextFollowUp === today).length;
  if (count === 0) return;
  try {
    const n = new Notification('یادآوری پیگیری مشتری', {
      body: `امروز ${count} پیگیری مشتری دارید.`,
      icon: 'icon-192.png',
    });
    n.onclick = () => { window.focus(); };
  } catch (e) { /* برخی مرورگرها بدون تعامل کاربر اجازه نمی‌دهند */ }
  safeSet(NOTIFY_LAST_KEY, today);
}

async function exportBackup() {
  const data = await idb.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-backup-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('فایل پشتیبان دانلود شد');
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      confirmDialog('بازیابی داده‌ها', 'داده‌های فعلی با محتوای فایل پشتیبان جایگزین خواهد شد.', async () => {
        await idb.importAll(data, 'replace');
        await loadAll();
        toast('بازیابی با موفقیت انجام شد');
        router();
      });
    } catch (err) {
      toast('فایل پشتیبان نامعتبر است');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function wipeAllData() {
  confirmDialog('پاک‌سازی کامل', 'تمام مشتریان، فروش‌ها، گفتگوها، واریزی‌ها و محصولات برای همیشه حذف می‌شوند. این عمل غیرقابل‌بازگشت است.', async () => {
    await idb.wipeAll();
    await loadAll();
    toast('تمام داده‌ها پاک شد');
    router();
  });
}

/* ========================================================================
   14) راه‌اندازی
   ======================================================================== */
function renderTopbarDate() {
  const el = document.getElementById('topbarDate');
  if (el) el.textContent = formatJalaliDisplay(todayISO());
}

async function init() {
  applyTheme(getTheme());
  await loadAll();
  renderTopbarDate();
  await router();
  checkFollowupNotification();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
document.addEventListener('DOMContentLoaded', init);
