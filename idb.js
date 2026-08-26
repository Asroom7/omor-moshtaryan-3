/* idb.js — لایه‌ی دسترسی به دیتابیس IndexedDB برای اپ مدیریت مشتری
   چهار جدول: customers, products, sales, conversations
   هر رکورد دارای کلید خودکار عددی id است؛ شناسه‌ی نمایشی (C-0001 و ...) در app.js ساخته می‌شود. */

const DB_NAME = 'crm-db';
const DB_VERSION = 2;
const STORES = ['customers', 'products', 'sales', 'conversations'];
const ALL_STORES = ['customers', 'products', 'sales', 'conversations', 'media'];

let _dbPromise = null;

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
async function dataURLToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('customers')) {
        const s = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
        s.createIndex('status', 'status');
        s.createIndex('nextFollowUp', 'nextFollowUp');
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('sales')) {
        const s = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        s.createIndex('customerId', 'customerId');
        s.createIndex('productId', 'productId');
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('conversations')) {
        const s = db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
        s.createIndex('customerId', 'customerId');
        s.createIndex('productId', 'productId');
        s.createIndex('date', 'date');
        s.createIndex('nextFollowUp', 'nextFollowUp');
      }
      if (!db.objectStoreNames.contains('media')) {
        const s = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
        s.createIndex('productId', 'productId');
      }
      // ارتقا از نسخه‌ی ۱: افزودن ایندکس پیگیری به گفتگوها اگر از قبل نبود
      if (e.oldVersion < 2 && db.objectStoreNames.contains('conversations')) {
        const tx2 = e.target.transaction;
        const cs = tx2.objectStore('conversations');
        if (!cs.indexNames.contains('nextFollowUp')) cs.createIndex('nextFollowUp', 'nextFollowUp');
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const idb = {
  async add(storeName, record) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, record) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, id) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const idx = store.index(indexName);
      const req = idx.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async count(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async exportAll() {
    const out = {};
    for (const s of STORES) {
      out[s] = await idb.getAll(s);
    }
    const mediaList = await idb.getAll('media');
    out.media = await Promise.all(mediaList.map(async (m) => ({ ...m, blob: await blobToDataURL(m.blob) })));
    out._exportedAt = new Date().toISOString();
    out._version = DB_VERSION;
    return out;
  },

  async importAll(data, mode = 'replace') {
    for (const s of STORES) {
      if (!Array.isArray(data[s])) continue;
      if (mode === 'replace') await idb.clear(s);
      const store = await tx(s, 'readwrite');
      await new Promise((resolve, reject) => {
        let remaining = data[s].length;
        if (remaining === 0) return resolve();
        data[s].forEach((rec) => {
          const req = store.put(rec);
          req.onsuccess = () => { remaining -= 1; if (remaining === 0) resolve(); };
          req.onerror = () => reject(req.error);
        });
      });
    }
    if (Array.isArray(data.media)) {
      if (mode === 'replace') await idb.clear('media');
      const records = await Promise.all(data.media.map(async (rec) => {
        const blob = typeof rec.blob === 'string' ? await dataURLToBlob(rec.blob) : rec.blob;
        return { ...rec, blob };
      }));
      const store = await tx('media', 'readwrite');
      await new Promise((resolve, reject) => {
        let remaining = records.length;
        if (remaining === 0) return resolve();
        records.forEach((rec) => {
          const req = store.put(rec);
          req.onsuccess = () => { remaining -= 1; if (remaining === 0) resolve(); };
          req.onerror = () => reject(req.error);
        });
      });
    }
    return true;
  },

  async wipeAll() {
    for (const s of ALL_STORES) await idb.clear(s);
    return true;
  },

  /* --- رسانه (عکس/ویدیوی محصول) — به‌صورت Blob ذخیره می‌شود --- */
  async addMedia(productId, kind, blob, name) {
    const store = await tx('media', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add({ productId, kind, blob, name: name || '', createdAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getMediaForProduct(productId) {
    return idb.getByIndex('media', 'productId', productId);
  },
  async deleteMediaForProduct(productId) {
    const list = await idb.getMediaForProduct(productId);
    await Promise.all(list.map((m) => idb.delete('media', m.id)));
    return true;
  },

  STORES,
  ALL_STORES,
};

window.idb = idb;
