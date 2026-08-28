/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/import.js
 * Version:    1.2.0
 * Build:      16
 * Datum:      2026-07-09
 *
 * Beschreibung:
 * Importiert Mitarbeiterdaten aus CSV- oder Excel-Dateien (.xlsx). Da die
 * Anwendung ohne Internetzugriff und ohne externe Bibliotheken auskommen
 * muss, wird das .xlsx-Format (ein ZIP-Container mit XML-Inhalten) mit
 * ausschließlich im Browser eingebauten Bordmitteln gelesen:
 *   - ZIP-Struktur: manuelles Parsen von Central-Directory- und
 *     Local-File-Headern (kein externes ZIP-Modul nötig)
 *   - Dekomprimierung: die native Web-API DecompressionStream('deflate-raw')
 *   - XML-Auswertung: der im Browser eingebaute DOMParser
 *
 * Voraussetzung für den .xlsx-Import ist ein aktueller Browser mit
 * Unterstützung für DecompressionStream (alle gängigen Browser ab 2023).
 * Ist die API nicht verfügbar, wird der Anwender gebeten, die Datei
 * stattdessen als CSV zu speichern und erneut zu importieren - das
 * funktioniert ausnahmslos in jedem Browser.
 */

'use strict';

const FDPImport = (() => {

    // Erkannte Spaltennamen (klein geschrieben, ohne Sonderzeichen) je Mitarbeiterfeld.
    const FIELD_ALIASES = {
        name: ['name', 'mitarbeiter', 'nachname vorname', 'vollständiger name'],
        shortCode: ['kürzel', 'kuerzel', 'kurzzeichen', 'abk', 'abkürzung'],
        department: ['abteilung', 'bereich', 'zug'],
        qualifications: ['qualifikationen', 'qualifikation', 'lehrgänge', 'lehrgaenge'],
        active: ['aktiv', 'status'],
        vacationEntitlement: ['urlaubsanspruch', 'urlaubstage', 'anspruch'],
        vacationRemaining: ['resturlaub', 'rest'],
        partTimePercent: ['beschäftigungsumfang %', 'beschaeftigungsumfang %', 'teilzeit %', 'beschäftigungsumfang', 'teilzeit'],
        notes: ['bemerkungen', 'notizen', 'anmerkung']
    };

    // Erkannte Spaltennamen für den Abwesenheiten-Import.
    const ABSENCE_FIELD_ALIASES = {
        employeeRef: ['mitarbeiter', 'name', 'kürzel', 'kuerzel'],
        type: ['art', 'typ', 'abwesenheitsart'],
        dateFrom: ['von', 'datum von', 'beginn', 'start'],
        dateTo: ['bis', 'datum bis', 'ende'],
        note: ['bemerkung', 'notiz', 'anmerkung']
    };

    // Erkannte Bezeichnungen je Abwesenheitsart (für die Spalte "Art").
    const ABSENCE_TYPE_ALIASES = {
        urlaub: ['urlaub', 'u'],
        krank: ['krank', 'krankheit', 'k'],
        fortbildung: ['fortbildung', 'lehrgang', 'f'],
        wunschfrei: ['wunschfrei', 'wunsch', 'w']
    };

    function normalizeHeader(h) {
        return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function detectFieldMap(headers) {
        const map = {}; // columnIndex -> fieldKey
        headers.forEach((h, idx) => {
            const norm = normalizeHeader(h);
            for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
                if (aliases.includes(norm)) {
                    map[idx] = field;
                    return;
                }
            }
        });
        return map;
    }

    // ---------------------------------------------------------------
    // Abwesenheiten-Import
    // ---------------------------------------------------------------

    function openAbsenceImportDialog() {
        const bodyHtml = `
            <p class="text-muted">
                Unterstützt werden Excel-Dateien (.xlsx) und CSV-Dateien. Die erste Zeile muss die
                Spaltenüberschriften enthalten: „Mitarbeiter" (Name oder Kürzel), „Art"
                (Urlaub/Krank/Fortbildung/Wunschfrei), „Von", „Bis" und optional „Bemerkung".
                Daten können als Datum (TT.MM.JJJJ oder JJJJ-MM-TT) hinterlegt sein.
            </p>
            <div class="button-row" style="margin-top:0;">
                <button class="btn btn-secondary btn-sm" id="downloadAbsenceTemplateBtn">Excel-Vorlage herunterladen</button>
            </div>
            <div class="form-field" style="margin-top:14px;">
                <label for="absenceImportFileInput">Datei auswählen</label>
                <input type="file" id="absenceImportFileInput" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
            </div>
            <div id="absenceImportPreviewArea"></div>
        `;
        const overlay = FDPUI.showModal({
            title: 'Abwesenheiten aus Datei importieren',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="absenceImportCancelBtn">Abbrechen</button>
                <button class="btn btn-primary" id="absenceImportConfirmBtn" disabled>Importieren</button>
            `,
            size: 'large'
        });

        let parsedRows = null;

        overlay.querySelector('#absenceImportCancelBtn').addEventListener('click', FDPUI.closeModal);
        overlay.querySelector('#downloadAbsenceTemplateBtn').addEventListener('click', downloadAbsenceTemplate);

        overlay.querySelector('#absenceImportFileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const previewArea = overlay.querySelector('#absenceImportPreviewArea');
            const confirmBtn = overlay.querySelector('#absenceImportConfirmBtn');
            confirmBtn.disabled = true;
            parsedRows = null;
            if (!file) return;

            previewArea.innerHTML = '<p class="text-muted">Datei wird gelesen…</p>';

            try {
                const table = await readTableFromFile(file);
                if (!table) {
                    previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Nicht unterstütztes Dateiformat oder Browser ohne .xlsx-Unterstützung. Bitte .xlsx oder .csv verwenden.</div></div>`;
                    return;
                }
                if (table.length === 0) {
                    previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Es konnten keine Daten gelesen werden.</div></div>`;
                    return;
                }

                const headers = table[0];
                const fieldMap = detectFieldMapGeneric(headers, ABSENCE_FIELD_ALIASES);
                const hasRef = Object.values(fieldMap).includes('employeeRef');
                const hasFrom = Object.values(fieldMap).includes('dateFrom');
                const hasTo = Object.values(fieldMap).includes('dateTo');

                if (!hasRef || !hasFrom || !hasTo) {
                    previewArea.innerHTML = `
                        <div class="alert alert-warning">
                            ${FDPUI.icon('warning')}
                            <div>Es müssen mindestens die Spalten „Mitarbeiter", „Von" und „Bis" vorhanden sein.
                            Gefundene Spalten: ${headers.map(h => FDPUI.escapeHtml(h)).join(', ') || '-'}.</div>
                        </div>`;
                    return;
                }

                const employees = await FDP.db.getAll('employees');
                const byName = new Map(employees.map(e => [e.name.trim().toLowerCase(), e]));
                const byShortCode = new Map(employees.filter(e => e.shortCode).map(e => [e.shortCode.trim().toLowerCase(), e]));
                const existingAbsences = await FDP.db.getAll('absences');

                const dataRows = table.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
                const results = dataRows.map(row => rowToAbsence(row, fieldMap, byName, byShortCode));

                const parsedOk = results.filter(r => !r.error);
                const invalid = results.filter(r => r.error);

                // Duplikate erkennen: gleicher Mitarbeiter, gleiche Abwesenheitsart und
                // überschneidender Zeitraum - sowohl gegen bereits gespeicherte
                // Abwesenheiten als auch gegen andere Zeilen derselben Importdatei
                // (verhindert doppelten Import bei erneutem Einlesen derselben Datei
                // oder bei Dateien mit versehentlich mehrfach enthaltenen Zeilen).
                function isDuplicate(record, othersAlreadyAccepted) {
                    const overlapsWith = (a) => a.employeeId === record.employeeId
                        && a.type === record.type
                        && FDPUI.dateRangeOverlaps(record.dateFrom, record.dateTo, a.dateFrom, a.dateTo);
                    return existingAbsences.some(overlapsWith) || othersAlreadyAccepted.some(overlapsWith);
                }

                const valid = [];
                const duplicates = [];
                parsedOk.forEach((r) => {
                    if (isDuplicate(r.record, valid.map(v => v.record))) {
                        duplicates.push(r);
                    } else {
                        valid.push(r);
                    }
                });

                previewArea.innerHTML = `
                    <div class="alert alert-warning" style="background:var(--color-success-bg); color: var(--color-success);">
                        <div>${valid.length} von ${dataRows.length} Zeilen können importiert werden.</div>
                    </div>
                    ${invalid.length > 0 ? `
                        <div class="alert alert-warning">
                            ${FDPUI.icon('warning')}
                            <div>${invalid.length} Zeile(n) übersprungen: ${invalid.slice(0, 5).map(r => FDPUI.escapeHtml(r.error)).join('; ')}${invalid.length > 5 ? ' …' : ''}</div>
                        </div>` : ''}
                    ${duplicates.length > 0 ? `
                        <div class="alert alert-warning">
                            ${FDPUI.icon('warning')}
                            <div>${duplicates.length} Zeile(n) als Duplikat übersprungen (gleicher Mitarbeiter, gleiche Art, überschneidender Zeitraum bereits vorhanden): ${duplicates.slice(0, 5).map(r => `${FDPUI.escapeHtml(r.employee.name)} ${FDPUI.formatDateDisplay(r.record.dateFrom)}–${FDPUI.formatDateDisplay(r.record.dateTo)}`).join('; ')}${duplicates.length > 5 ? ' …' : ''}</div>
                        </div>` : ''}
                    <div class="table-scroll">
                    <table class="data-table">
                        <thead><tr><th>Mitarbeiter</th><th>Art</th><th>Von</th><th>Bis</th><th>Bemerkung</th></tr></thead>
                        <tbody>
                            ${valid.slice(0, 20).map(r => `
                                <tr>
                                    <td class="cell-strong">${FDPUI.escapeHtml(r.employee.name)}</td>
                                    <td>${FDPVacation.TYPE_LABELS[r.record.type]}</td>
                                    <td>${FDPUI.formatDateDisplay(r.record.dateFrom)}</td>
                                    <td>${FDPUI.formatDateDisplay(r.record.dateTo)}</td>
                                    <td>${FDPUI.escapeHtml(r.record.note || '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>
                    ${valid.length > 20 ? `<p class="text-muted">… und ${valid.length - 20} weitere Zeilen.</p>` : ''}
                `;
                parsedRows = valid.map(r => r.record);
                confirmBtn.disabled = parsedRows.length === 0;
            } catch (err) {
                console.error(err);
                previewArea.innerHTML = `
                    <div class="alert alert-warning">
                        ${FDPUI.icon('warning')}
                        <div>Die Datei konnte nicht gelesen werden (${FDPUI.escapeHtml(err.message || String(err))}).</div>
                    </div>`;
            }
        });

        overlay.querySelector('#absenceImportConfirmBtn').addEventListener('click', async () => {
            if (!parsedRows || parsedRows.length === 0) return;
            await FDP.db.bulkPut('absences', parsedRows);
            FDPUI.showToast(`${parsedRows.length} Abwesenheiten importiert`, 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    function detectFieldMapGeneric(headers, aliasTable) {
        const map = {};
        headers.forEach((h, idx) => {
            const norm = normalizeHeader(h);
            for (const [field, aliases] of Object.entries(aliasTable)) {
                if (aliases.includes(norm)) { map[idx] = field; return; }
            }
        });
        return map;
    }

    function rowToAbsence(row, fieldMap, byName, byShortCode) {
        const get = (field) => {
            const idx = Object.entries(fieldMap).find(([, f]) => f === field)?.[0];
            return idx !== undefined ? row[idx] : undefined;
        };
        const refRaw = String(get('employeeRef') ?? '').trim();
        const employee = byName.get(refRaw.toLowerCase()) || byShortCode.get(refRaw.toLowerCase());
        if (!employee) return { error: `Mitarbeiter „${refRaw}" nicht gefunden` };

        const typeRaw = normalizeHeader(get('type') ?? 'urlaub');
        let type = 'urlaub';
        for (const [key, aliases] of Object.entries(ABSENCE_TYPE_ALIASES)) {
            if (aliases.includes(typeRaw)) { type = key; break; }
        }

        const dateFrom = parseFlexibleDate(get('dateFrom'));
        const dateTo = parseFlexibleDate(get('dateTo')) || dateFrom;
        if (!dateFrom) return { error: `Ungültiges Datum bei „${refRaw}"` };
        if (dateTo < dateFrom) return { error: `„Bis" liegt vor „Von" bei „${refRaw}"` };

        return {
            employee,
            record: { employeeId: employee.id, type, dateFrom, dateTo, note: String(get('note') ?? '').trim() }
        };
    }

    /**
     * Erkennt Datumsangaben in den Formaten JJJJ-MM-TT, TT.MM.JJJJ sowie als
     * Excel-Datumsseriennummer (Zellen mit Zahlenformat "Datum") und liefert
     * das Ergebnis als ISO-Datum (JJJJ-MM-TT).
     */
    function parseFlexibleDate(value) {
        if (value === undefined || value === null || value === '') return null;
        const str = String(value).trim();

        let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;

        m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;

        if (/^\d+(\.\d+)?$/.test(str)) {
            const serial = parseFloat(str);
            if (serial > 0 && serial < 200000) {
                const msPerDay = 86400000;
                const excelEpoch = Date.UTC(1899, 11, 30);
                const date = new Date(excelEpoch + Math.round(serial) * msPerDay);
                return FDPUI.formatDateISO(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
            }
        }
        return null;
    }

    /**
     * Liest eine hochgeladene CSV- oder XLSX-Datei in eine zweidimensionale
     * Tabelle ein. Gibt null zurück, wenn das Format nicht unterstützt wird.
     */
    async function readTableFromFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        if (extension === 'csv') return parseCsv(await file.text());
        if (extension === 'xlsx') {
            if (typeof DecompressionStream === 'undefined') return null;
            return parseXlsx(await file.arrayBuffer());
        }
        return null;
    }

    async function downloadAbsenceTemplate() {
        const headers = ['Mitarbeiter', 'Art', 'Von', 'Bis', 'Bemerkung'];
        const example = ['Max Mustermann', 'Urlaub', '2026-08-01', '2026-08-14', 'Sommerurlaub'];
        const bytes = buildMinimalXlsx('Abwesenheiten', [headers, example]);
        downloadBytes('FDP-Abwesenheiten-Vorlage.xlsx', bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        FDPUI.showToast('Vorlage heruntergeladen', 'success');
    }

    function downloadBytes(filename, bytes, mimeType) {
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // ---------------------------------------------------------------
    // Minimaler .xlsx-Writer (ausschließlich Browser-Bordmittel, ZIP ohne
    // Kompression). Wird für Import-Vorlagen genutzt.
    // ---------------------------------------------------------------

    const CRC_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function xmlEscape(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function columnIndexToLetters(index) {
        let n = index + 1;
        let letters = '';
        while (n > 0) {
            const rem = (n - 1) % 26;
            letters = String.fromCharCode(65 + rem) + letters;
            n = Math.floor((n - 1) / 26);
        }
        return letters;
    }

    /**
     * Erstellt ein minimales, gültiges .xlsx (ein Arbeitsblatt, Zellen als
     * "inlineStr", keine sharedStrings/Formatierung nötig) rein aus Bordmitteln.
     * @param {string} sheetName
     * @param {Array<Array<string>>} rows Zeilen als Arrays von Zellwerten
     */
    function buildMinimalXlsx(sheetName, rows) {
        const sheetRowsXml = rows.map((row, rIdx) => {
            const cells = row.map((val, cIdx) => {
                const ref = `${columnIndexToLetters(cIdx)}${rIdx + 1}`;
                return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(val)}</t></is></c>`;
            }).join('');
            return `<row r="${rIdx + 1}">${cells}</row>`;
        }).join('');

        const files = [
            { name: '[Content_Types].xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>` },
            { name: '_rels/.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
            { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>` },
            { name: 'xl/_rels/workbook.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>` },
            { name: 'xl/worksheets/sheet1.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRowsXml}</sheetData></worksheet>` }
        ].map(f => ({ name: f.name, data: new TextEncoder().encode(f.text) }));

        return buildZipStored(files);
    }

    /**
     * Baut ein gültiges ZIP-Archiv (Kompressionsverfahren "stored", d. h.
     * unkomprimiert) aus einer Liste von Dateien - ausreichend für kleine
     * Vorlagen-Dateien und ohne jede Kompressions-Bibliothek auskommend.
     */
    function buildZipStored(files) {
        const localParts = [];
        const centralParts = [];
        let offset = 0;

        for (const file of files) {
            const nameBytes = new TextEncoder().encode(file.name);
            const crc = crc32(file.data);
            const size = file.data.length;

            const localHeader = new DataView(new ArrayBuffer(30));
            localHeader.setUint32(0, 0x04034b50, true);
            localHeader.setUint16(4, 20, true);
            localHeader.setUint16(6, 0, true);
            localHeader.setUint16(8, 0, true); // Kompression: 0 = stored
            localHeader.setUint16(10, 0, true);
            localHeader.setUint16(12, 0, true);
            localHeader.setUint32(14, crc, true);
            localHeader.setUint32(18, size, true);
            localHeader.setUint32(22, size, true);
            localHeader.setUint16(26, nameBytes.length, true);
            localHeader.setUint16(28, 0, true);

            localParts.push(new Uint8Array(localHeader.buffer), nameBytes, file.data);

            const centralHeader = new DataView(new ArrayBuffer(46));
            centralHeader.setUint32(0, 0x02014b50, true);
            centralHeader.setUint16(4, 20, true);
            centralHeader.setUint16(6, 20, true);
            centralHeader.setUint16(8, 0, true);
            centralHeader.setUint16(10, 0, true);
            centralHeader.setUint16(12, 0, true);
            centralHeader.setUint16(14, 0, true);
            centralHeader.setUint32(16, crc, true);
            centralHeader.setUint32(20, size, true);
            centralHeader.setUint32(24, size, true);
            centralHeader.setUint16(28, nameBytes.length, true);
            centralHeader.setUint16(30, 0, true);
            centralHeader.setUint16(32, 0, true);
            centralHeader.setUint16(34, 0, true);
            centralHeader.setUint16(36, 0, true);
            centralHeader.setUint32(38, 0, true);
            centralHeader.setUint32(42, offset, true);

            centralParts.push(new Uint8Array(centralHeader.buffer), nameBytes);

            offset += 30 + nameBytes.length + size;
        }

        const centralDirStart = offset;
        let centralDirSize = 0;
        centralParts.forEach(p => { centralDirSize += p.length; });

        const eocd = new DataView(new ArrayBuffer(22));
        eocd.setUint32(0, 0x06054b50, true);
        eocd.setUint16(4, 0, true);
        eocd.setUint16(6, 0, true);
        eocd.setUint16(8, files.length, true);
        eocd.setUint16(10, files.length, true);
        eocd.setUint32(12, centralDirSize, true);
        eocd.setUint32(16, centralDirStart, true);
        eocd.setUint16(20, 0, true);

        const totalSize = offset + centralDirSize + 22;
        const result = new Uint8Array(totalSize);
        let pos = 0;
        for (const part of [...localParts, ...centralParts, new Uint8Array(eocd.buffer)]) {
            result.set(part, pos);
            pos += part.length;
        }
        return result;
    }

    // ---------------------------------------------------------------
    // Dialog / Ablaufsteuerung (Mitarbeiterimport)
    // ---------------------------------------------------------------

    function openImportDialog() {
        const bodyHtml = `
            <p class="text-muted">
                Unterstützt werden Excel-Dateien (.xlsx) und CSV-Dateien. Die erste Zeile muss die
                Spaltenüberschriften enthalten (z. B. „Name“, „Kürzel“, „Abteilung“, „Qualifikationen“,
                „Urlaubsanspruch“, „Resturlaub“). Nur die Spalte „Name“ ist zwingend erforderlich.
                Ist bereits ein Mitarbeiter mit demselben Namen vorhanden, wird dessen Datensatz
                aktualisiert statt dupliziert.
            </p>
            <div class="form-field">
                <label for="importFileInput">Datei auswählen</label>
                <input type="file" id="importFileInput" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
            </div>
            <div id="importPreviewArea"></div>
        `;
        const overlay = FDPUI.showModal({
            title: 'Mitarbeiter aus Datei importieren',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="importCancelBtn">Abbrechen</button>
                <button class="btn btn-primary" id="importConfirmBtn" disabled>Importieren</button>
            `,
            size: 'large'
        });

        let parsedRows = null; // Array von Mitarbeiter-Objekten nach erfolgreichem Parsen

        overlay.querySelector('#importCancelBtn').addEventListener('click', FDPUI.closeModal);

        overlay.querySelector('#importFileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const previewArea = overlay.querySelector('#importPreviewArea');
            const confirmBtn = overlay.querySelector('#importConfirmBtn');
            confirmBtn.disabled = true;
            parsedRows = null;
            if (!file) return;

            previewArea.innerHTML = '<p class="text-muted">Datei wird gelesen…</p>';

            try {
                const extension = file.name.split('.').pop().toLowerCase();
                let table; // Array von Arrays (Zeilen/Spalten als Rohtext)

                if (extension === 'csv') {
                    table = parseCsv(await file.text());
                } else if (extension === 'xlsx') {
                    if (typeof DecompressionStream === 'undefined') {
                        previewArea.innerHTML = `
                            <div class="alert alert-warning">
                                ${FDPUI.icon('warning')}
                                <div>Dieser Browser unterstützt das direkte Lesen von .xlsx-Dateien nicht.
                                Bitte die Datei in Excel über „Speichern unter“ als CSV (Trennzeichen-getrennt)
                                speichern und diese CSV-Datei erneut auswählen.</div>
                            </div>`;
                        return;
                    }
                    table = await parseXlsx(await file.arrayBuffer());
                } else {
                    previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Nicht unterstütztes Dateiformat. Bitte .xlsx oder .csv verwenden.</div></div>`;
                    return;
                }

                if (!table || table.length === 0) {
                    previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Es konnten keine Daten gelesen werden.</div></div>`;
                    return;
                }

                const headers = table[0];
                const fieldMap = detectFieldMap(headers);
                const nameColumnIndex = Object.entries(fieldMap).find(([, field]) => field === 'name')?.[0];

                if (nameColumnIndex === undefined) {
                    previewArea.innerHTML = `
                        <div class="alert alert-warning">
                            ${FDPUI.icon('warning')}
                            <div>Es konnte keine Spalte „Name“ gefunden werden. Gefundene Spalten: ${headers.map(h => FDPUI.escapeHtml(h)).join(', ') || '-'}.
                            Bitte die erste Zeile mit Spaltenüberschriften versehen.</div>
                        </div>`;
                    return;
                }

                const dataRows = table.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
                parsedRows = dataRows.map(row => rowToEmployee(row, fieldMap));

                const existingEmployees = await FDP.db.getAll('employees');
                const existingByName = new Map(existingEmployees.map(e => [e.name.trim().toLowerCase(), e]));
                let newCount = 0, updateCount = 0;
                parsedRows.forEach((r) => {
                    if (existingByName.has(r.name.trim().toLowerCase())) updateCount++;
                    else newCount++;
                });

                previewArea.innerHTML = `
                    <div class="alert alert-warning" style="background:var(--color-success-bg); color: var(--color-success);">
                        <div>${dataRows.length} Zeilen erkannt: ${newCount} neue Mitarbeiter, ${updateCount} werden aktualisiert.</div>
                    </div>
                    <table class="data-table">
                        <thead><tr><th>Name</th><th>Kürzel</th><th>Abteilung</th><th>Urlaubsanspruch</th><th>Aktiv</th></tr></thead>
                        <tbody>
                            ${parsedRows.slice(0, 20).map(r => `
                                <tr>
                                    <td class="cell-strong">${FDPUI.escapeHtml(r.name)}</td>
                                    <td>${FDPUI.escapeHtml(r.shortCode || '-')}</td>
                                    <td>${FDPUI.escapeHtml(r.department || '-')}</td>
                                    <td>${r.vacationEntitlement}</td>
                                    <td>${r.active ? 'Ja' : 'Nein'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${parsedRows.length > 20 ? `<p class="text-muted">… und ${parsedRows.length - 20} weitere Zeilen.</p>` : ''}
                `;
                confirmBtn.disabled = parsedRows.length === 0;
            } catch (err) {
                console.error(err);
                previewArea.innerHTML = `
                    <div class="alert alert-warning">
                        ${FDPUI.icon('warning')}
                        <div>Die Datei konnte nicht gelesen werden (${FDPUI.escapeHtml(err.message || String(err))}).
                        Bitte prüfen, ob es sich um eine gültige .xlsx- oder CSV-Datei handelt.</div>
                    </div>`;
            }
        });

        overlay.querySelector('#importConfirmBtn').addEventListener('click', async () => {
            if (!parsedRows || parsedRows.length === 0) return;
            const existingEmployees = await FDP.db.getAll('employees');
            const existingByName = new Map(existingEmployees.map(e => [e.name.trim().toLowerCase(), e]));

            const toSave = parsedRows.map((r) => {
                const existing = existingByName.get(r.name.trim().toLowerCase());
                return existing ? { ...existing, ...r, id: existing.id } : r;
            });

            await FDP.db.bulkPut('employees', toSave);
            FDPUI.showToast(`${toSave.length} Mitarbeiter importiert`, 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    /**
     * Wandelt eine Rohdatenzeile anhand der erkannten Spaltenzuordnung in ein
     * Mitarbeiter-Objekt um. Nicht erkannte Spalten werden ignoriert.
     */
    function rowToEmployee(row, fieldMap) {
        const get = (field) => {
            const idx = Object.entries(fieldMap).find(([, f]) => f === field)?.[0];
            return idx !== undefined ? row[idx] : undefined;
        };
        const toBool = (v) => {
            if (v === undefined || v === null || v === '') return true;
            const s = String(v).trim().toLowerCase();
            return !['nein', 'false', '0', 'inaktiv', 'nicht aktiv'].includes(s);
        };
        const toNumber = (v, fallback = 0) => {
            const n = parseFloat(String(v ?? '').replace(',', '.'));
            return Number.isFinite(n) ? n : fallback;
        };

        const vacationEntitlement = toNumber(get('vacationEntitlement'), 30);
        return {
            name: String(get('name') ?? '').trim(),
            shortCode: String(get('shortCode') ?? '').trim(),
            department: String(get('department') ?? '').trim(),
            qualifications: String(get('qualifications') ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean),
            active: toBool(get('active')),
            vacationEntitlement,
            vacationRemaining: toNumber(get('vacationRemaining'), vacationEntitlement),
            partTimePercent: toNumber(get('partTimePercent'), 100),
            notes: String(get('notes') ?? '').trim()
        };
    }

    // ---------------------------------------------------------------
    // CSV-Parser
    // ---------------------------------------------------------------

    /**
     * Robuster CSV-Parser mit automatischer Trennzeichenerkennung (Semikolon
     * oder Komma) sowie Unterstützung für Anführungszeichen und BOM.
     */
    function parseCsv(text) {
        text = text.replace(/^\uFEFF/, ''); // BOM entfernen
        const firstLine = text.split(/\r?\n/, 1)[0] || '';
        const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';

        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i + 1];

            if (inQuotes) {
                if (ch === '"' && next === '"') { field += '"'; i++; }
                else if (ch === '"') { inQuotes = false; }
                else { field += ch; }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                row.push(field); field = '';
            } else if (ch === '\n') {
                row.push(field); field = '';
                rows.push(row); row = [];
            } else if (ch === '\r') {
                // ignorieren, \n folgt
            } else {
                field += ch;
            }
        }
        if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
        return rows.filter(r => r.length > 0 && !(r.length === 1 && r[0] === ''));
    }

    // ---------------------------------------------------------------
    // XLSX-Parser (ZIP + XML, ausschließlich mit Browser-Bordmitteln)
    // ---------------------------------------------------------------

    async function parseXlsx(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const entries = readZipCentralDirectory(bytes);

        const sharedStringsEntry = entries.find(e => e.fileName === 'xl/sharedStrings.xml');
        const sheetEntry = entries
            .filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.fileName))
            .sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }))[0];

        if (!sheetEntry) {
            throw new Error('In der Datei wurde kein Arbeitsblatt gefunden.');
        }

        const sharedStrings = sharedStringsEntry
            ? parseSharedStrings(await extractEntryAsText(bytes, sharedStringsEntry))
            : [];
        const sheetXml = await extractEntryAsText(bytes, sheetEntry);
        return parseSheetXmlToTable(sheetXml, sharedStrings);
    }

    /**
     * Sucht das ZIP-End-of-Central-Directory-Signal und liest darüber alle
     * Einträge des Central Directory (Dateiname, Kompressionsverfahren,
     * Größen, Offset des Local File Headers).
     */
    function readZipCentralDirectory(bytes) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const EOCD_SIG = 0x06054b50;
        let eocdOffset = -1;
        const minOffset = Math.max(0, bytes.length - 65557);
        for (let i = bytes.length - 22; i >= minOffset; i--) {
            if (view.getUint32(i, true) === EOCD_SIG) { eocdOffset = i; break; }
        }
        if (eocdOffset === -1) throw new Error('Ungültiges .xlsx-Dateiformat (ZIP-Endekennung nicht gefunden).');

        const totalEntries = view.getUint16(eocdOffset + 10, true);
        const centralDirOffset = view.getUint32(eocdOffset + 16, true);

        const entries = [];
        let offset = centralDirOffset;
        const CD_SIG = 0x02014b50;
        for (let i = 0; i < totalEntries; i++) {
            if (view.getUint32(offset, true) !== CD_SIG) break;
            const compressionMethod = view.getUint16(offset + 10, true);
            const compressedSize = view.getUint32(offset + 20, true);
            const uncompressedSize = view.getUint32(offset + 24, true);
            const fileNameLength = view.getUint16(offset + 28, true);
            const extraLength = view.getUint16(offset + 30, true);
            const commentLength = view.getUint16(offset + 32, true);
            const localHeaderOffset = view.getUint32(offset + 42, true);
            const fileNameBytes = bytes.subarray(offset + 46, offset + 46 + fileNameLength);
            const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

            entries.push({ fileName, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
            offset += 46 + fileNameLength + extraLength + commentLength;
        }
        return entries;
    }

    /**
     * Liest die komprimierten Rohdaten eines ZIP-Eintrags anhand seines Local
     * File Headers, dekomprimiert sie bei Bedarf und liefert den Text als UTF-8.
     */
    async function extractEntryAsText(bytes, entry) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const LFH_SIG = 0x04034b50;
        if (view.getUint32(entry.localHeaderOffset, true) !== LFH_SIG) {
            throw new Error('Ungültiger ZIP-Eintrag: ' + entry.fileName);
        }
        const fileNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
        const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
        const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
        const compressedData = bytes.subarray(dataStart, dataStart + entry.compressedSize);

        let outputBytes;
        if (entry.compressionMethod === 0) {
            outputBytes = compressedData;
        } else if (entry.compressionMethod === 8) {
            outputBytes = await inflateRawDeflate(compressedData);
        } else {
            throw new Error('Nicht unterstütztes Kompressionsverfahren in .xlsx-Datei.');
        }
        return new TextDecoder('utf-8').decode(outputBytes);
    }

    async function inflateRawDeflate(compressedBytes) {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compressedBytes);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks = [];
        let totalLength = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
        }
        const result = new Uint8Array(totalLength);
        let pos = 0;
        for (const chunk of chunks) { result.set(chunk, pos); pos += chunk.length; }
        return result;
    }

    /**
     * Extrahiert alle Textbausteine aus der sharedStrings.xml (inkl. mehrteiliger
     * "rich text runs") in der Reihenfolge ihres Index.
     */
    function parseSharedStrings(xmlText) {
        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        const siElements = Array.from(doc.getElementsByTagName('si'));
        const result = [];
        for (const si of siElements) {
            const tElements = Array.from(si.getElementsByTagName('t'));
            let text = '';
            for (const t of tElements) text += t.textContent;
            result.push(text);
        }
        return result;
    }

    function columnLettersToIndex(letters) {
        let col = 0;
        for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
        return col - 1;
    }

    /**
     * Wandelt das XML eines Arbeitsblatts (sheetN.xml) in eine zweidimensionale
     * Tabelle (Array von Zeilen-Arrays) um, unter Auflösung geteilter Zeichenketten.
     */
    function parseSheetXmlToTable(xmlText, sharedStrings) {
        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        const rowElements = Array.from(doc.getElementsByTagName('row'));
        const table = [];

        for (const rowEl of rowElements) {
            const cellElements = Array.from(rowEl.getElementsByTagName('c'));
            const rowArray = [];
            let autoIndex = 0;
            for (const c of cellElements) {
                const ref = c.getAttribute('r') || '';
                const letters = (ref.match(/^[A-Z]+/) || [null])[0];
                const colIndex = letters ? columnLettersToIndex(letters) : autoIndex;
                autoIndex = colIndex + 1;

                const type = c.getAttribute('t');
                let value = '';
                if (type === 'inlineStr') {
                    const isEl = c.getElementsByTagName('is')[0];
                    value = isEl ? isEl.textContent : '';
                } else {
                    const vEl = c.getElementsByTagName('v')[0];
                    const raw = vEl ? vEl.textContent : '';
                    if (type === 's') {
                        const idx = parseInt(raw, 10);
                        value = sharedStrings[idx] ?? '';
                    } else if (type === 'b') {
                        value = raw === '1' ? 'Ja' : 'Nein';
                    } else {
                        value = raw;
                    }
                }
                rowArray[colIndex] = value;
            }
            for (let i = 0; i < rowArray.length; i++) if (rowArray[i] === undefined) rowArray[i] = '';
            table.push(rowArray);
        }
        return table;
    }

    return { openImportDialog, openAbsenceImportDialog, downloadAbsenceTemplate, parseCsv, buildMinimalXlsx, downloadBytes, parseXlsx, parseFlexibleDate };
})();
