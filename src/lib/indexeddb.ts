export const openPDFDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PdfStorageDB', 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('pdfs')) {
        db.createObjectStore('pdfs', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const savePdfToLocal = async (id: string, file: File): Promise<void> => {
  try {
    const db = await openPDFDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pdfs'], 'readwrite');
      const store = transaction.objectStore('pdfs');
      
      const request = store.put({ id, file });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to save PDF locally', err);
  }
};

export const getPdfFromLocal = async (id: string): Promise<File | null> => {
  try {
    const db = await openPDFDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pdfs'], 'readonly');
      const store = transaction.objectStore('pdfs');
      
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.file);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get PDF from local storage', err);
    return null;
  }
};

export const deletePdfFromLocal = async (id: string): Promise<void> => {
  try {
    const db = await openPDFDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pdfs'], 'readwrite');
      const store = transaction.objectStore('pdfs');
      
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to delete PDF from local storage', err);
  }
};
