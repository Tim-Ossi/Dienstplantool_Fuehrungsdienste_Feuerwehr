/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/database.js
 * Version:    1.5.0
 * Build:      6
 * Datum:      2026-07-11
 *
 * Beschreibung:
 * Kapselt den kompletten Zugriff auf IndexedDB. Stellt eine promise-basierte
 * API für alle Object Stores bereit (Mitarbeiter, Dienstarten, Diensteinträge,
 * Abwesenheiten, Abteilungen, Qualifikationen, Einstellungen). Alle anderen
 * Module greifen ausschließlich über dieses Modul auf persistente Daten zu.
 *
 * Es existieren keinerlei fest codierten Mitarbeiter, Namen oder Zahlen.
 * Sämtliche Inhalte stammen zur Laufzeit aus der Datenbank.
 */

'use strict';

const FDP_DB_NAME = 'FDPDatenbank';
const FDP_DB_VERSION = 2;

/**
 * Zentrales Datenbank-Objekt. Wird von app.js initialisiert (FDP.db.open())
 * und danach global über den Namespace FDP.db angesprochen.
 */
const FDPDatabase = (() => {

    let dbInstance = null;

    // Definition aller Object Stores inkl. Indizes.
    const STORE_DEFINITIONS = [
        {
            name: 'employees',
            options: { keyPath: 'id', autoIncrement: true },
            indexes: [
                { name: 'active', keyPath: 'active' },
                { name: 'department', keyPath: 'department' },
                { name: 'shortCode', keyPath: 'shortCode', unique: false }
            ]
        },
        {
            name: 'serviceTypes',
            options: { keyPath: 'id', autoIncrement: true },
            indexes: [
                { name: 'sortOrder', keyPath: 'sortOrder' }
            ]
        },
        {
            name: 'assignments',
            options: { keyPath: 'id', autoIncrement: true },
            indexes: [
                { name: 'date', keyPath: 'date' },
                { name: 'employeeId', keyPath: 'employeeId' },
                { name: 'serviceTypeId', keyPath: 'serviceTypeId' },
                { name: 'dateServiceType', keyPath: ['date', 'serviceTypeId'] }
            ]
        },
        {
            name: 'absences',
            options: { keyPath: 'id', autoIncrement: true },
            indexes: [
                { name: 'employeeId', keyPath: 'employeeId' },
                { name: 'type', keyPath: 'type' },
                { name: 'dateFrom', keyPath: 'dateFrom' }
            ]
        },
        {
            name: 'settings',
            options: { keyPath: 'key' },
            indexes: []
        },
        {
            name: 'departments',
            options: { keyPath: 'id', autoIncrement: true },
            indexes: [
                { name: 'code', keyPath: 'code', unique: true },
                { name: 'parentCode', keyPath: 'parentCode' }
            ]
        },
        {
            name: 'qualifications',
            options: { keyPath: 'id', autoIncrement: true },
            indexes: [
                { name: 'name', keyPath: 'name', unique: true }
            ]
        }
    ];

    /**
     * Öffnet (bzw. erstellt / migriert) die Datenbank.
     * @returns {Promise<IDBDatabase>}
     */
    function open() {
        return new Promise((resolve, reject) => {
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }

            const request = indexedDB.open(FDP_DB_NAME, FDP_DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                STORE_DEFINITIONS.forEach((def) => {
                    if (!db.objectStoreNames.contains(def.name)) {
                        const store = db.createObjectStore(def.name, def.options);
                        def.indexes.forEach((idx) => {
                            store.createIndex(idx.name, idx.keyPath, { unique: !!idx.unique });
                        });
                    }
                });
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Führt eine Transaktion auf einem Store aus.
     * @param {string} storeName
     * @param {"readonly"|"readwrite"} mode
     * @param {(store: IDBObjectStore) => IDBRequest} action
     */
    function runTransaction(storeName, mode, action) {
        return new Promise((resolve, reject) => {
            if (!dbInstance) {
                reject(new Error('Datenbank ist nicht geöffnet.'));
                return;
            }
            const tx = dbInstance.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = action(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function getAll(storeName) {
        return runTransaction(storeName, 'readonly', (store) => store.getAll());
    }

    function getById(storeName, id) {
        return runTransaction(storeName, 'readonly', (store) => store.get(id));
    }

    function getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = dbInstance.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function put(storeName, record) {
        const result = await runTransaction(storeName, 'readwrite', (store) => store.put(record));
        FDPEvents.emit('change', { store: storeName });
        return result;
    }

    async function bulkPut(storeName, records) {
        return new Promise((resolve, reject) => {
            const tx = dbInstance.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            records.forEach((r) => store.put(r));
            tx.oncomplete = () => {
                FDPEvents.emit('change', { store: storeName });
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    async function remove(storeName, id) {
        const result = await runTransaction(storeName, 'readwrite', (store) => store.delete(id));
        FDPEvents.emit('change', { store: storeName });
        return result;
    }

    async function clear(storeName) {
        const result = await runTransaction(storeName, 'readwrite', (store) => store.clear());
        FDPEvents.emit('change', { store: storeName });
        return result;
    }

    async function getSetting(key, defaultValue = null) {
        const record = await getById('settings', key);
        return record ? record.value : defaultValue;
    }

    async function setSetting(key, value) {
        return put('settings', { key, value });
    }

    /**
     * Exportiert die komplette Datenbank als serialisierbares Objekt (für JSON-Export).
     */
    async function exportAll() {
        const data = {};
        for (const def of STORE_DEFINITIONS) {
            data[def.name] = await getAll(def.name);
        }
        data.exportedAt = new Date().toISOString();
        data.formatVersion = 1;
        return data;
    }

    /**
     * Importiert ein zuvor exportiertes Datenobjekt. Überschreibt bestehende Stores vollständig.
     */
    async function importAll(data) {
        for (const def of STORE_DEFINITIONS) {
            if (Array.isArray(data[def.name])) {
                await clear(def.name);
                await bulkPut(def.name, data[def.name]);
            }
        }
    }

    return {
        open,
        getAll,
        getById,
        getByIndex,
        put,
        bulkPut,
        remove,
        clear,
        getSetting,
        setSetting,
        exportAll,
        importAll
    };
})();

/**
 * Einfacher Event-Bus, damit sich Oberflächen-Module automatisch aktualisieren,
 * sobald sich Datenbestände ändern (Grundprinzip: Alle Oberflächen aktualisieren
 * sich automatisch).
 */
const FDPEvents = (() => {
    const target = new EventTarget();

    function emit(name, detail) {
        target.dispatchEvent(new CustomEvent(name, { detail }));
    }

    function on(name, handler) {
        target.addEventListener(name, handler);
    }

    function off(name, handler) {
        target.removeEventListener(name, handler);
    }

    return { emit, on, off };
})();
