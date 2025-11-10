// indexedDb.ts
const DB_NAME = 'FieldDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'fields';


type FieldData = {
  label: string;
  keywords: string[];
};

let db: IDBDatabase | null = null;

// Membuka atau membuat IndexedDB
function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'label' });
      }
    };

    request.onsuccess = (event: Event) => {
      db = (event.target as IDBRequest).result;
      resolve(db);
    };

    request.onerror = (event: Event) => {
      reject('Database error: ' + (event.target as IDBRequest).error);
    };
  });
}

// Menyimpan data ke IndexedDB
async function saveFieldToDb(field: FieldData) {
  try {
    if (!db) {
      db = await openDb(); // buka DB jika belum terbuka
    }

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put(field); // Menyimpan data
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = (event: Event) => reject('Save failed: ' + (event.target as IDBRequest).error);
    });
  } catch (error) {
    console.error('Failed to save field:', error);
    throw new Error('Failed to save field to IndexedDB');
  }
}

// Mendapatkan semua data dari IndexedDB
async function getAllFieldsFromDb() {
  try {
    if (!db) {
      db = await openDb(); // buka DB jika belum terbuka
    }

    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll(); // Mengambil semua data

    return new Promise<FieldData[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event: Event) => reject('Get failed: ' + (event.target as IDBRequest).error);
    });
  } catch (error) {
    console.error('Failed to get fields:', error);
    throw new Error('Failed to retrieve fields from IndexedDB');
  }
}

export { saveFieldToDb, getAllFieldsFromDb };
