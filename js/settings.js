/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/settings.js
 * Version:    1.7.0
 * Build:      16
 * Datum:      2026-07-11
 *
 * Beschreibung:
 * Verwaltet globale Einstellungen (Feuerwehrname, Bundesland, Jahr,
 * Farbdesign, maximale gleichzeitige Abwesenheit), die konfigurierbaren
 * Dienstarten (Store "serviceTypes"), die hierarchische Abteilungsstruktur
 * (Store "departments") sowie den Qualifikationskatalog (Store
 * "qualifications"). Außerdem Datenexport/-import (JSON-Vollsicherung, CSV
 * für Excel, Drucken).
 */

'use strict';

const FDPSettings = (() => {

    async function render(container) {
        const [feuerwehrname, bundesland, year, colorTheme, maxSimultaneousAbsence, serviceTypes, departments, qualifications] = await Promise.all([
            FDP.db.getSetting('feuerwehrname', 'Freiwillige Feuerwehr'),
            FDP.db.getSetting('bundesland', 'NW'),
            FDP.db.getSetting('year', new Date().getFullYear()),
            FDP.db.getSetting('colorTheme', 'blue'),
            FDP.db.getSetting('maxSimultaneousAbsence', 2),
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('departments'),
            FDP.db.getAll('qualifications')
        ]);
        serviceTypes.sort((a, b) => a.sortOrder - b.sortOrder);
        qualifications.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        const flatDepartments = FDPEmployees.flattenDepartmentTree(departments);
        const stateLabels = FDPHolidays.getStateLabels();

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Einstellungen</h1>
                    <p class="view-subtitle">Stammdaten, Dienstarten und Datensicherung</p>
                </div>
            </div>

            <div class="card">
                <h2>Allgemein</h2>
                <form id="generalForm" class="form-grid">
                    <div class="form-field">
                        <label for="setFeuerwehrname">Name der Feuerwehr</label>
                        <input type="text" id="setFeuerwehrname" value="${FDPUI.escapeHtml(feuerwehrname)}">
                    </div>
                    <div class="form-field">
                        <label for="setBundesland">Bundesland (Feiertage)</label>
                        <select id="setBundesland">
                            ${Object.entries(stateLabels).map(([code, label]) => `<option value="${code}" ${bundesland === code ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-field">
                        <label for="setYear">Planungsjahr</label>
                        <input type="number" id="setYear" value="${year}" min="2000" max="2100">
                    </div>
                    <div class="form-field">
                        <label for="setMaxAbsence">Max. gleichzeitig abwesende Mitarbeiter (Urlaub)</label>
                        <input type="number" id="setMaxAbsence" value="${maxSimultaneousAbsence}" min="0">
                    </div>
                    <div class="form-field">
                        <label for="setColorTheme">Farbdesign</label>
                        <select id="setColorTheme">
                            <option value="blue" ${colorTheme === 'blue' ? 'selected' : ''}>Blau (Standard)</option>
                            <option value="red" ${colorTheme === 'red' ? 'selected' : ''}>Rot (Feuerwehr)</option>
                            <option value="green" ${colorTheme === 'green' ? 'selected' : ''}>Grün</option>
                        </select>
                    </div>
                </form>
                <div class="button-row">
                    <button class="btn btn-primary" id="saveGeneralBtn">Speichern</button>
                </div>
            </div>

            <div class="card">
                <div class="card-header-row">
                    <h2>Dienstarten</h2>
                    <button class="btn btn-secondary btn-sm" id="addServiceTypeBtn">${FDPUI.icon('plus')} Dienstart hinzufügen</button>
                </div>
                <p class="text-muted">Dienstarten sind frei konfigurierbar und können jederzeit ergänzt, umbenannt oder deaktiviert werden.</p>
                <div class="table-scroll">
                <table class="data-table">
                    <thead><tr><th></th><th>Name</th><th>Kürzel</th><th>Farbe</th><th>Status</th><th>Einsatzdienst-Statistik</th><th>Kombinierbar</th><th>Erforderliche Qualifikation</th><th></th></tr></thead>
                    <tbody>
                        ${serviceTypes.map((s, i) => `
                            <tr data-id="${s.id}">
                                <td class="cell-order">
                                    <button class="icon-btn move-up-btn" ${i === 0 ? 'disabled' : ''}>▲</button>
                                    <button class="icon-btn move-down-btn" ${i === serviceTypes.length - 1 ? 'disabled' : ''}>▼</button>
                                </td>
                                <td class="cell-strong">${FDPUI.escapeHtml(s.name)}</td>
                                <td>${FDPUI.escapeHtml(s.shortCode)}</td>
                                <td><span class="color-swatch" style="background:${s.color}"></span></td>
                                <td>${s.active !== false ? '<span class="badge badge-success">aktiv</span>' : '<span class="badge badge-muted">inaktiv</span>'}</td>
                                <td>${s.countsInStatistics !== false ? '<span class="badge badge-info">wird gewertet</span>' : '<span class="badge badge-neutral">ausgenommen</span>'}</td>
                                <td>${s.combinable === true ? '<span class="badge badge-warning">ja</span>' : '<span class="badge badge-neutral">nein</span>'}</td>
                                <td>${(s.requiredQualifications || []).length > 0 ? s.requiredQualifications.map(q => `<span class="tag">${FDPUI.escapeHtml(q)}</span>`).join(' ') : '<span class="text-muted">keine</span>'}</td>
                                <td class="cell-actions">
                                    <button class="icon-btn edit-st-btn" title="Bearbeiten">${FDPUI.icon('edit')}</button>
                                    <button class="icon-btn icon-btn-danger delete-st-btn" title="Löschen">${FDPUI.icon('trash')}</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            </div>

            <div class="card">
                <div class="card-header-row">
                    <h2>Abteilungen</h2>
                    <button class="btn btn-secondary btn-sm" id="addDepartmentBtn">${FDPUI.icon('plus')} Abteilung hinzufügen</button>
                </div>
                <p class="text-muted">Hierarchische Abteilungsstruktur der Feuerwehr (Code, Bezeichnung, übergeordnete Abteilung). Wird bei Mitarbeitern zur Zuordnung sowie für die Anwesenheits-Mindestbesetzung verwendet.</p>
                ${flatDepartments.length === 0 ? '<div class="empty-state-inline">Noch keine Abteilungen angelegt.</div>' : `
                <div class="table-scroll">
                <table class="data-table">
                    <thead><tr><th>Code</th><th>Bezeichnung</th><th>Übergeordnet</th><th>Anwesenheitsregel</th><th></th></tr></thead>
                    <tbody>
                        ${flatDepartments.map(({ dept, depth }) => `
                            <tr data-id="${dept.id}">
                                <td class="cell-strong">${'\u2007\u2007'.repeat(depth)}${FDPUI.escapeHtml(dept.code)}</td>
                                <td>${FDPUI.escapeHtml(dept.name)}</td>
                                <td>${FDPUI.escapeHtml(dept.parentCode || '-')}</td>
                                <td>${(dept.minPresence || 0) > 0
                                    ? `<span class="badge ${dept.presenceSoft ? 'badge-neutral' : (dept.presenceMustBeUnassigned ? 'badge-warning' : 'badge-info')}">min. ${dept.minPresence} anwesend${dept.presenceMustBeUnassigned ? ', unverplant' : ''}${dept.presenceSoft ? ' (weich)' : ''}</span>`
                                    : '<span class="text-muted">keine</span>'}</td>
                                <td class="cell-actions">
                                    <button class="icon-btn edit-dept-btn" title="Bearbeiten">${FDPUI.icon('edit')}</button>
                                    <button class="icon-btn icon-btn-danger delete-dept-btn" title="Löschen">${FDPUI.icon('trash')}</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
                `}
            </div>
            <p class="text-muted" style="margin-top:-10px;">Wird die Mindestbesetzung einer Abteilung unterschritten, prüft die Anwendung automatisch, ob eine anwesende (bei Bedarf unverplante) Person direkt einer übergeordneten Abteilung zugeordnet ist – dann gilt die Regel dennoch als erfüllt. Die Prüfung berücksichtigt zudem automatisch alle Unterabteilungen und gilt nur an Werktagen (Mo–Fr) ohne Feiertage.</p>

            <div class="card">
                <div class="card-header-row">
                    <h2>Qualifikationen</h2>
                    <button class="btn btn-secondary btn-sm" id="addQualificationBtn">${FDPUI.icon('plus')} Qualifikation hinzufügen</button>
                </div>
                <p class="text-muted">Zentraler Katalog der Qualifikationen. Wird bei Mitarbeitern (welche Qualifikation hat wer) und bei Dienstarten (welche Qualifikation wird benötigt) zur Auswahl angeboten.</p>
                ${qualifications.length === 0 ? '<div class="empty-state-inline">Noch keine Qualifikationen angelegt.</div>' : `
                <div class="chip-list">
                    ${qualifications.map(q => `
                        <span class="chip" data-id="${q.id}">
                            ${FDPUI.escapeHtml(q.name)}${q.maxSimultaneousAbsence !== undefined ? ` <span class="text-muted">(max. ${q.maxSimultaneousAbsence} im Urlaub)</span>` : ''}
                            <button class="chip-edit-btn" title="Bearbeiten">${FDPUI.icon('edit')}</button>
                            <button class="chip-delete-btn" title="Löschen">${FDPUI.icon('close')}</button>
                        </span>
                    `).join('')}
                </div>
                `}
            </div>

            <div class="card">
                <h2>Datensicherung &amp; Export</h2>
                <p class="text-muted">Alle Daten befinden sich ausschließlich lokal in diesem Browser (IndexedDB). Erstellen Sie regelmäßig eine JSON-Sicherung.</p>
                <div class="button-row">
                    <button class="btn btn-secondary" id="exportJsonBtn">JSON-Sicherung exportieren</button>
                    <label class="btn btn-secondary file-input-label">
                        JSON-Sicherung importieren
                        <input type="file" id="importJsonInput" accept="application/json" style="display:none;">
                    </label>
                    <button class="btn btn-secondary" id="exportCsvBtn">Mitarbeiterliste als CSV (Excel)</button>
                    <button class="btn btn-secondary" id="exportStatsCsvBtn">Statistik als CSV (Excel)</button>
                    <button class="btn btn-secondary" id="printBtn">Kalender drucken / als PDF speichern</button>
                </div>
            </div>

            <div class="card">
                <h2>Dienstplan (alle Dienstarten) als Excel</h2>
                <p class="text-muted">Exportiert alle Diensteinträge des aktuellen Planungsjahres (Datum, Dienstart, Mitarbeiter) als echte .xlsx-Datei &ndash; im Unterschied zu den CSV-Exporten oben im nativen Excel-Format. Die exportierte Datei lässt sich nach Bearbeitung über denselben Bereich wieder importieren: Bestehende Diensteinträge am selben Tag/derselben Dienstart werden dabei überschrieben, alle übrigen bleiben unverändert.</p>
                <div class="button-row">
                    <button class="btn btn-secondary" id="exportPlanXlsxBtn">Dienstplan als Excel (.xlsx) exportieren</button>
                    <button class="btn btn-secondary" id="importPlanXlsxBtn">Dienstplan aus Excel importieren</button>
                </div>
            </div>

            <div class="card">
                <h2>Testdaten zurücksetzen</h2>
                <p class="text-muted">Praktisch beim Testen: löscht ausschließlich alle erfassten Abwesenheiten (Urlaub, Krankheit, Fortbildung, Wunschfrei). Mitarbeiter, Dienstarten, Abteilungen und bereits erzeugte Diensteinträge im Kalender bleiben unangetastet.</p>
                <div class="button-row">
                    <button class="btn btn-danger" id="deleteAllAbsencesBtn">${FDPUI.icon('trash')} Alle Abwesenheiten löschen</button>
                </div>
            </div>
        `;

        container.querySelector('#saveGeneralBtn').addEventListener('click', async () => {
            await FDP.db.setSetting('feuerwehrname', container.querySelector('#setFeuerwehrname').value.trim());
            await FDP.db.setSetting('bundesland', container.querySelector('#setBundesland').value);
            await FDP.db.setSetting('year', Number(container.querySelector('#setYear').value));
            await FDP.db.setSetting('maxSimultaneousAbsence', Number(container.querySelector('#setMaxAbsence').value));
            await FDP.db.setSetting('colorTheme', container.querySelector('#setColorTheme').value);
            FDPApp.applyColorTheme(container.querySelector('#setColorTheme').value);
            FDPApp.refreshHeaderInfo();
            FDPUI.showToast('Einstellungen gespeichert', 'success');
        });

        container.querySelector('#addServiceTypeBtn').addEventListener('click', () => openServiceTypeDialog(serviceTypes));
        container.querySelectorAll('.edit-st-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                openServiceTypeDialog(serviceTypes, serviceTypes.find(s => s.id === id));
            });
        });
        container.querySelectorAll('.delete-st-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                const st = serviceTypes.find(s => s.id === id);
                const ok = await FDPUI.confirmDialog(`Dienstart "${st.name}" wirklich löschen? Bestehende Diensteinträge dieser Art bleiben als historische Daten erhalten.`);
                if (ok) {
                    await FDP.db.remove('serviceTypes', id);
                    FDPUI.showToast('Dienstart gelöscht', 'success');
                    FDPUI.refreshCurrentView();
                }
            });
        });
        container.querySelectorAll('.move-up-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => moveServiceType(serviceTypes, Number(e.target.closest('tr').dataset.id), -1));
        });
        container.querySelectorAll('.move-down-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => moveServiceType(serviceTypes, Number(e.target.closest('tr').dataset.id), 1));
        });

        container.querySelector('#exportJsonBtn').addEventListener('click', exportJson);
        container.querySelector('#importJsonInput').addEventListener('change', importJson);
        container.querySelector('#exportCsvBtn').addEventListener('click', exportEmployeesCsv);
        container.querySelector('#exportStatsCsvBtn').addEventListener('click', exportStatsCsv);
        container.querySelector('#printBtn').addEventListener('click', async () => {
            await FDPUI.navigateTo('calendar');
            setTimeout(() => window.print(), 50);
        });

        container.querySelector('#exportPlanXlsxBtn').addEventListener('click', exportPlanXlsx);
        container.querySelector('#importPlanXlsxBtn').addEventListener('click', openPlanImportDialog);

        container.querySelector('#deleteAllAbsencesBtn').addEventListener('click', async () => {
            const absences = await FDP.db.getAll('absences');
            if (absences.length === 0) {
                FDPUI.showToast('Es sind keine Abwesenheiten vorhanden.', 'info');
                return;
            }
            const ok = await FDPUI.confirmDialog(`Wirklich alle ${absences.length} erfassten Abwesenheiten unwiderruflich löschen? Mitarbeiter, Dienstarten und Diensteinträge bleiben davon unberührt.`, 'Alle löschen', true);
            if (!ok) return;
            await FDP.db.clear('absences');
            FDPUI.showToast('Alle Abwesenheiten wurden gelöscht', 'success');
            FDPUI.refreshCurrentView();
        });

        container.querySelector('#addDepartmentBtn').addEventListener('click', () => openDepartmentDialog(departments));
        container.querySelectorAll('.edit-dept-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                openDepartmentDialog(departments, departments.find(d => d.id === id));
            });
        });
        container.querySelectorAll('.delete-dept-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                const dept = departments.find(d => d.id === id);
                const hasChildren = departments.some(d => d.parentCode === dept.code);
                if (hasChildren) {
                    FDPUI.showToast('Diese Abteilung hat untergeordnete Abteilungen und kann nicht gelöscht werden. Bitte zuerst die untergeordneten Abteilungen löschen oder verschieben.', 'error');
                    return;
                }
                const ok = await FDPUI.confirmDialog(`Abteilung "${dept.code} – ${dept.name}" wirklich löschen? Mitarbeiter, die dieser Abteilung zugeordnet sind, verlieren die Zuordnung.`);
                if (ok) {
                    await FDP.db.remove('departments', id);
                    FDPUI.showToast('Abteilung gelöscht', 'success');
                    FDPUI.refreshCurrentView();
                }
            });
        });

        container.querySelector('#addQualificationBtn').addEventListener('click', () => openQualificationDialog(qualifications));
        container.querySelectorAll('.chip-edit-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.target.closest('.chip').dataset.id);
                openQualificationDialog(qualifications, qualifications.find(q => q.id === id));
            });
        });
        container.querySelectorAll('.chip-delete-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.target.closest('.chip').dataset.id);
                const qual = qualifications.find(q => q.id === id);
                const ok = await FDPUI.confirmDialog(`Qualifikation "${qual.name}" wirklich löschen? Bereits zugewiesene Qualifikationen bei Mitarbeitern/Dienstarten bleiben als Text erhalten, tauchen aber nicht mehr in der Auswahl auf.`);
                if (ok) {
                    await FDP.db.remove('qualifications', id);
                    FDPUI.showToast('Qualifikation gelöscht', 'success');
                    FDPUI.refreshCurrentView();
                }
            });
        });
    }

    function openDepartmentDialog(departments, department = null) {
        const isEdit = !!department;
        const flat = FDPEmployees.flattenDepartmentTree(departments.filter(d => !isEdit || d.id !== department.id));

        const bodyHtml = `
            <form id="departmentForm" class="form-grid">
                <div class="form-field">
                    <label for="deptCode">Code * (z. B. 5.11)</label>
                    <input type="text" id="deptCode" required value="${FDPUI.escapeHtml(department?.code || '')}">
                </div>
                <div class="form-field">
                    <label for="deptName">Bezeichnung *</label>
                    <input type="text" id="deptName" required value="${FDPUI.escapeHtml(department?.name || '')}">
                </div>
                <div class="form-field form-field-wide">
                    <label for="deptParent">Übergeordnete Abteilung</label>
                    <select id="deptParent">
                        <option value="">— keine (oberste Ebene) —</option>
                        ${flat.map(({ dept, depth }) => `
                            <option value="${dept.code}" ${department?.parentCode === dept.code ? 'selected' : ''}>
                                ${'\u2007\u2007'.repeat(depth)}${FDPUI.escapeHtml(dept.code)} – ${FDPUI.escapeHtml(dept.name)}
                            </option>`).join('')}
                    </select>
                </div>
                <div class="form-field">
                    <label for="deptMinPresence">Mindestens anwesend (0 = keine Regel)</label>
                    <input type="number" id="deptMinPresence" min="0" step="1" value="${department?.minPresence ?? 0}">
                </div>
                <div class="form-field form-field-checkbox">
                    <label><input type="checkbox" id="deptPresenceUnassigned" ${department?.presenceMustBeUnassigned ? 'checked' : ''}> Diese Person(en) dürfen an dem Tag keine Dienstart (B/C/Verfüger/LdF/FBL) übernommen haben</label>
                </div>
                <div class="form-field form-field-checkbox">
                    <label><input type="checkbox" id="deptPresenceSoft" ${department?.presenceSoft ? 'checked' : ''}> Weiche Ausnahmeregel (nur Hinweis statt Warnung, z. B. bei sehr kleinen Abteilungen)</label>
                </div>
                <p class="text-muted" style="margin: -6px 0 0 0;">Wird die Mindestbesetzung nicht erreicht, prüft die Anwendung automatisch, ob eine anwesende Person aus einer übergeordneten Abteilung als Vertretung zählt, bevor eine Warnung ausgelöst wird. Die Regel gilt nur an Werktagen (Mo–Fr) ohne Feiertage.</p>
            </form>
        `;
        const overlay = FDPUI.showModal({
            title: isEdit ? 'Abteilung bearbeiten' : 'Abteilung hinzufügen',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="deptCancelBtn">Abbrechen</button>
                <button class="btn btn-primary" id="deptSaveBtn">${isEdit ? 'Speichern' : 'Hinzufügen'}</button>
            `
        });
        overlay.querySelector('#deptCancelBtn').addEventListener('click', FDPUI.closeModal);
        overlay.querySelector('#deptSaveBtn').addEventListener('click', async () => {
            const code = overlay.querySelector('#deptCode').value.trim();
            const name = overlay.querySelector('#deptName').value.trim();
            if (!code || !name) {
                FDPUI.showToast('Bitte Code und Bezeichnung angeben.', 'error');
                return;
            }
            const duplicate = departments.some(d => d.code === code && (!isEdit || d.id !== department.id));
            if (duplicate) {
                FDPUI.showToast('Dieser Code ist bereits vergeben.', 'error');
                return;
            }
            const parentCode = overlay.querySelector('#deptParent').value || null;
            if (isEdit && parentCode === department.code) {
                FDPUI.showToast('Eine Abteilung kann nicht sich selbst übergeordnet sein.', 'error');
                return;
            }
            const record = {
                code, name, parentCode,
                minPresence: Number(overlay.querySelector('#deptMinPresence').value) || 0,
                presenceMustBeUnassigned: overlay.querySelector('#deptPresenceUnassigned').checked,
                presenceSoft: overlay.querySelector('#deptPresenceSoft').checked
            };
            if (isEdit) record.id = department.id;
            try {
                await FDP.db.put('departments', record);
                // Falls sich der Code geändert hat, Kind-Abteilungen und zugeordnete
                // Mitarbeiter auf den neuen Code umhängen, damit die Hierarchie
                // konsistent bleibt.
                if (isEdit && department.code !== code) {
                    const children = departments.filter(d => d.parentCode === department.code);
                    for (const child of children) {
                        await FDP.db.put('departments', { ...child, parentCode: code });
                    }
                    const employees = await FDP.db.getAll('employees');
                    const affected = employees.filter(e => e.departmentCode === department.code);
                    for (const emp of affected) {
                        await FDP.db.put('employees', { ...emp, departmentCode: code });
                    }
                }
            } catch (err) {
                FDPUI.showToast('Speichern fehlgeschlagen: ' + (err.message || err), 'error');
                return;
            }
            FDPUI.showToast(isEdit ? 'Abteilung aktualisiert' : 'Abteilung hinzugefügt', 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    function openQualificationDialog(qualifications, qualification = null) {
        const isEdit = !!qualification;
        const bodyHtml = `
            <form id="qualificationForm" class="form-grid">
                <div class="form-field form-field-wide">
                    <label for="qualName">Bezeichnung *</label>
                    <input type="text" id="qualName" required value="${FDPUI.escapeHtml(qualification?.name || '')}">
                </div>
                <div class="form-field form-field-wide">
                    <label for="qualMaxAbsence">Max. gleichzeitig im Urlaub (leer = keine eigene Obergrenze, nur die allgemeine Einstellung gilt)</label>
                    <input type="number" id="qualMaxAbsence" min="0" step="1" value="${qualification?.maxSimultaneousAbsence ?? ''}" placeholder="z. B. 1 für einen kleinen Führungspool">
                </div>
                <p class="text-muted" style="margin:-6px 0 0 0;">Damit lässt sich z. B. für die Qualifikation „LdF" eine eigene, niedrigere Obergrenze setzen als für die allgemeine Belegschaft – unabhängig von der globalen Einstellung unter „Allgemein".</p>
            </form>
        `;
        const overlay = FDPUI.showModal({
            title: isEdit ? 'Qualifikation bearbeiten' : 'Qualifikation hinzufügen',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="qualCancelBtn">Abbrechen</button>
                <button class="btn btn-primary" id="qualSaveBtn">${isEdit ? 'Speichern' : 'Hinzufügen'}</button>
            `
        });
        overlay.querySelector('#qualCancelBtn').addEventListener('click', FDPUI.closeModal);
        overlay.querySelector('#qualSaveBtn').addEventListener('click', async () => {
            const name = overlay.querySelector('#qualName').value.trim();
            if (!name) {
                FDPUI.showToast('Bitte eine Bezeichnung angeben.', 'error');
                return;
            }
            const duplicate = qualifications.some(q => q.name.toLowerCase() === name.toLowerCase() && (!isEdit || q.id !== qualification.id));
            if (duplicate) {
                FDPUI.showToast('Diese Qualifikation gibt es bereits.', 'error');
                return;
            }
            const record = { name };
            const maxAbsenceRaw = overlay.querySelector('#qualMaxAbsence').value;
            if (maxAbsenceRaw !== '') record.maxSimultaneousAbsence = Number(maxAbsenceRaw);
            if (isEdit) record.id = qualification.id;
            try {
                await FDP.db.put('qualifications', record);
            } catch (err) {
                FDPUI.showToast('Speichern fehlgeschlagen: ' + (err.message || err), 'error');
                return;
            }
            FDPUI.showToast(isEdit ? 'Qualifikation aktualisiert' : 'Qualifikation hinzugefügt', 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    async function moveServiceType(serviceTypes, id, direction) {
        const sorted = [...serviceTypes].sort((a, b) => a.sortOrder - b.sortOrder);
        const idx = sorted.findIndex(s => s.id === id);
        const swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const a = sorted[idx];
        const b = sorted[swapIdx];
        const tmp = a.sortOrder;
        a.sortOrder = b.sortOrder;
        b.sortOrder = tmp;
        await FDP.db.put('serviceTypes', a);
        await FDP.db.put('serviceTypes', b);
        FDPUI.refreshCurrentView();
    }

    async function openServiceTypeDialog(serviceTypes, serviceType = null) {
        const isEdit = !!serviceType;
        const qualifications = await FDP.db.getAll('qualifications');
        qualifications.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        const requiredSet = new Set(serviceType?.requiredQualifications || []);
        const bodyHtml = `
            <form id="serviceTypeForm" class="form-grid">
                <div class="form-field">
                    <label for="stName">Bezeichnung *</label>
                    <input type="text" id="stName" required value="${FDPUI.escapeHtml(serviceType?.name || '')}">
                </div>
                <div class="form-field">
                    <label for="stShortCode">Kürzel</label>
                    <input type="text" id="stShortCode" maxlength="8" value="${FDPUI.escapeHtml(serviceType?.shortCode || '')}">
                </div>
                <div class="form-field">
                    <label for="stColor">Farbe</label>
                    <input type="color" id="stColor" value="${serviceType?.color || '#2f6fed'}">
                </div>
                <div class="form-field form-field-wide">
                    <label>Erforderliche Qualifikation(en) (leer = keine Einschränkung)</label>
                    ${qualifications.length > 0 ? `
                        <div class="checkbox-grid">
                            ${qualifications.map(q => `
                                <label class="checkbox-chip">
                                    <input type="checkbox" value="${FDPUI.escapeHtml(q.name)}" class="st-qualification-cb" ${requiredSet.has(q.name) ? 'checked' : ''}>
                                    ${FDPUI.escapeHtml(q.name)}
                                </label>`).join('')}
                        </div>
                    ` : '<p class="text-muted">Noch keine Qualifikationen angelegt (siehe Bereich „Qualifikationen" weiter unten).</p>'}
                </div>
                <div class="form-field form-field-checkbox">
                    <label><input type="checkbox" id="stActive" ${serviceType?.active !== false ? 'checked' : ''}> Dienstart ist aktiv</label>
                </div>
                <div class="form-field form-field-checkbox">
                    <label><input type="checkbox" id="stCountsInStatistics" ${serviceType?.countsInStatistics !== false ? 'checked' : ''}> Wird in der Einsatzdienst-Statistik gewertet</label>
                </div>
                <div class="form-field form-field-checkbox">
                    <label><input type="checkbox" id="stCombinable" ${serviceType?.combinable === true ? 'checked' : ''}> Kann am selben Tag durch dieselbe Person wie andere kombinierbare Dienstarten übernommen werden (z. B. LdF + FBL)</label>
                </div>
            </form>
        `;
        const overlay = FDPUI.showModal({
            title: isEdit ? 'Dienstart bearbeiten' : 'Dienstart hinzufügen',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="stCancelBtn">Abbrechen</button>
                <button class="btn btn-primary" id="stSaveBtn">${isEdit ? 'Speichern' : 'Hinzufügen'}</button>
            `,
            size: 'large'
        });
        overlay.querySelector('#stCancelBtn').addEventListener('click', FDPUI.closeModal);
        overlay.querySelector('#stSaveBtn').addEventListener('click', async () => {
            const name = overlay.querySelector('#stName').value.trim();
            if (!name) {
                FDPUI.showToast('Bitte eine Bezeichnung angeben.', 'error');
                return;
            }
            const record = {
                name,
                shortCode: overlay.querySelector('#stShortCode').value.trim() || name.substring(0, 3).toUpperCase(),
                color: overlay.querySelector('#stColor').value,
                active: overlay.querySelector('#stActive').checked,
                countsInStatistics: overlay.querySelector('#stCountsInStatistics').checked,
                combinable: overlay.querySelector('#stCombinable').checked,
                requiredQualifications: Array.from(overlay.querySelectorAll('.st-qualification-cb:checked')).map(cb => cb.value),
                sortOrder: isEdit ? serviceType.sortOrder : (Math.max(0, ...serviceTypes.map(s => s.sortOrder)) + 1)
            };
            if (isEdit) record.id = serviceType.id;
            await FDP.db.put('serviceTypes', record);
            FDPUI.showToast(isEdit ? 'Dienstart aktualisiert' : 'Dienstart hinzugefügt', 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function exportJson() {
        const data = await FDP.db.exportAll();
        downloadFile(`FDP-Sicherung-${todayStamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
        FDPUI.showToast('JSON-Sicherung erstellt', 'success');
    }

    function importJson(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const data = JSON.parse(reader.result);
                const ok = await FDPUI.confirmDialog('Der Import überschreibt alle aktuell gespeicherten Daten. Fortfahren?', 'Importieren', true);
                if (!ok) return;
                await FDP.db.importAll(data);
                FDPUI.showToast('Daten erfolgreich importiert', 'success');
                FDPApp.refreshHeaderInfo();
                FDPUI.refreshCurrentView();
            } catch (err) {
                FDPUI.showToast('Die Datei konnte nicht gelesen werden: ungültiges Format.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function csvEscape(value) {
        const str = String(value ?? '');
        if (/[;"\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    }

    async function exportEmployeesCsv() {
        const employees = await FDP.db.getAll('employees');
        const header = ['Name', 'Kürzel', 'Abteilung', 'Qualifikationen', 'Aktiv', 'Urlaubsanspruch', 'Resturlaub', 'Beschäftigungsumfang %', 'Bemerkungen'];
        const rows = employees.map(e => [
            e.name, e.shortCode, e.department, (e.qualifications || []).join(', '),
            e.active ? 'Ja' : 'Nein', e.vacationEntitlement, e.vacationRemaining, e.partTimePercent, e.notes
        ]);
        const csv = [header, ...rows].map(r => r.map(csvEscape).join(';')).join('\r\n');
        downloadFile(`FDP-Mitarbeiter-${todayStamp()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
        FDPUI.showToast('CSV-Export erstellt', 'success');
    }

    async function exportStatsCsv() {
        const year = Number(await FDP.db.getSetting('year', new Date().getFullYear()));
        const bundesland = await FDP.db.getSetting('bundesland', 'NW');
        const [employees, serviceTypes, assignments, absences] = await Promise.all([
            FDP.db.getAll('employees'),
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('assignments'),
            FDP.db.getAll('absences')
        ]);
        const activeServiceTypes = serviceTypes.filter(s => s.active !== false).sort((a, b) => a.sortOrder - b.sortOrder);
        const holidays = FDPHolidays.getHolidays(year, bundesland);
        const yearAssignments = assignments.filter(a => a.date.startsWith(String(year)));
        const stats = employees.map(emp => FDPStatistics.computeEmployeeStats(emp, activeServiceTypes, yearAssignments, absences, holidays, year));

        const header = ['Mitarbeiter', ...activeServiceTypes.map(s => s.name), 'Wochenenden', 'Feiertage', 'Urlaub', 'Fortbildung', 'Krankheit', 'Gesamt'];
        const rows = stats.map(s => [
            s.employee.name,
            ...activeServiceTypes.map(st => s.byServiceType[st.id] || 0),
            s.weekends, s.holidays, s.vacationDays, s.trainingDays, s.sickDays, s.totalServices
        ]);
        const csv = [header, ...rows].map(r => r.map(csvEscape).join(';')).join('\r\n');
        downloadFile(`FDP-Statistik-${year}-${todayStamp()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
        FDPUI.showToast('Statistik-CSV erstellt', 'success');
    }

    function todayStamp() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * Exportiert alle Diensteinträge (alle Dienstarten: B-Dienst, C-Dienst,
     * Verfüger, LdF, FBL, ...) des aktuellen Planungsjahres als echte
     * .xlsx-Datei - eine Zeile je Diensteintrag mit Datum, Wochentag,
     * Dienstart und zugeteiltem Mitarbeiter. Nutzt denselben, bereits für
     * die Abwesenheiten-Vorlage verwendeten .xlsx-Writer (siehe import.js).
     */
    async function exportPlanXlsx() {
        const year = Number(await FDP.db.getSetting('year', new Date().getFullYear()));
        const [employees, serviceTypes, assignments] = await Promise.all([
            FDP.db.getAll('employees'),
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('assignments')
        ]);
        const employeeById = new Map(employees.map(e => [e.id, e]));
        const serviceTypeById = new Map(serviceTypes.map(s => [s.id, s]));
        const yearAssignments = assignments
            .filter(a => a.date.startsWith(String(year)))
            .sort((a, b) => a.date.localeCompare(b.date) || (serviceTypeById.get(a.serviceTypeId)?.sortOrder || 0) - (serviceTypeById.get(b.serviceTypeId)?.sortOrder || 0));

        const headers = ['Datum', 'Wochentag', 'Dienstart', 'Mitarbeiter', 'Kürzel'];
        const rows = yearAssignments.map((a) => {
            const st = serviceTypeById.get(a.serviceTypeId);
            const emp = employeeById.get(a.employeeId);
            const date = FDPUI.parseISO(a.date);
            return [a.date, FDPUI.weekdayShort(date), st ? st.name : String(a.serviceTypeId), emp ? emp.name : 'Unbekannt', emp ? (emp.shortCode || '') : ''];
        });

        const bytes = FDPImport.buildMinimalXlsx('Dienstplan', [headers, ...rows]);
        FDPImport.downloadBytes(`FDP-Dienstplan-${year}-${todayStamp()}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        FDPUI.showToast(`${rows.length} Diensteinträge exportiert`, 'success');
    }

    /**
     * Öffnet einen Dialog zum Import eines zuvor (oder extern) erstellten
     * Dienstplans aus Excel/CSV. Erwartete Spalten: Datum, Dienstart,
     * Mitarbeiter (Name oder Kürzel). Ein Diensteintrag wird über
     * Datum + Dienstart eindeutig identifiziert - existiert für diese
     * Kombination bereits ein Eintrag, wird er überschrieben (kein Duplikat).
     */
    function openPlanImportDialog() {
        const bodyHtml = `
            <p class="text-muted">
                Unterstützt werden Excel-Dateien (.xlsx) und CSV-Dateien mit den Spalten
                „Datum", „Dienstart" (Name oder Kürzel, z.&nbsp;B. „B" oder „B-Dienst") und
                „Mitarbeiter" (Name oder Kürzel). Ein bereits vorhandener Diensteintrag am
                selben Tag und derselben Dienstart wird überschrieben.
            </p>
            <div class="form-field">
                <label for="planImportFileInput">Datei auswählen</label>
                <input type="file" id="planImportFileInput" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
            </div>
            <div id="planImportPreviewArea"></div>
        `;
        const overlay = FDPUI.showModal({
            title: 'Dienstplan aus Excel/CSV importieren',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="planImportCancelBtn">Abbrechen</button>
                <button class="btn btn-primary" id="planImportConfirmBtn" disabled>Importieren</button>
            `,
            size: 'large'
        });

        let parsedRows = null;
        overlay.querySelector('#planImportCancelBtn').addEventListener('click', FDPUI.closeModal);

        overlay.querySelector('#planImportFileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const previewArea = overlay.querySelector('#planImportPreviewArea');
            const confirmBtn = overlay.querySelector('#planImportConfirmBtn');
            confirmBtn.disabled = true;
            parsedRows = null;
            if (!file) return;

            previewArea.innerHTML = '<p class="text-muted">Datei wird gelesen…</p>';
            try {
                const extension = file.name.split('.').pop().toLowerCase();
                let table;
                if (extension === 'csv') {
                    table = FDPImport.parseCsv(await file.text());
                } else if (extension === 'xlsx') {
                    if (typeof DecompressionStream === 'undefined') {
                        previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Dieser Browser unterstützt das direkte Lesen von .xlsx-Dateien nicht. Bitte als CSV speichern und erneut versuchen.</div></div>`;
                        return;
                    }
                    table = await FDPImport.parseXlsx(await file.arrayBuffer());
                } else {
                    previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Nicht unterstütztes Dateiformat. Bitte .xlsx oder .csv verwenden.</div></div>`;
                    return;
                }
                if (!table || table.length < 2) {
                    previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Es konnten keine Daten gelesen werden.</div></div>`;
                    return;
                }

                const headers = table[0].map(h => String(h || '').trim().toLowerCase());
                const idxDatum = headers.findIndex(h => h === 'datum');
                const idxDienstart = headers.findIndex(h => h === 'dienstart');
                const idxMitarbeiter = headers.findIndex(h => h === 'mitarbeiter' || h === 'kürzel' || h === 'kuerzel');
                if (idxDatum === -1 || idxDienstart === -1 || idxMitarbeiter === -1) {
                    previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Es müssen mindestens die Spalten „Datum", „Dienstart" und „Mitarbeiter" (oder „Kürzel") vorhanden sein. Gefundene Spalten: ${table[0].map(h => FDPUI.escapeHtml(h)).join(', ') || '-'}.</div></div>`;
                    return;
                }

                const [employees, serviceTypes, existingAssignments] = await Promise.all([
                    FDP.db.getAll('employees'),
                    FDP.db.getAll('serviceTypes'),
                    FDP.db.getAll('assignments')
                ]);
                const employeeByName = new Map(employees.map(e => [e.name.trim().toLowerCase(), e]));
                const employeeByCode = new Map(employees.filter(e => e.shortCode).map(e => [e.shortCode.trim().toLowerCase(), e]));
                const serviceByName = new Map(serviceTypes.map(s => [s.name.trim().toLowerCase(), s]));
                const serviceByCode = new Map(serviceTypes.filter(s => s.shortCode).map(s => [s.shortCode.trim().toLowerCase(), s]));
                const existingBySlot = new Map(existingAssignments.map(a => [`${a.date}|${a.serviceTypeId}`, a]));

                const dataRows = table.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
                const results = [];
                dataRows.forEach((row) => {
                    const dateRaw = row[idxDatum];
                    const dienstartRaw = String(row[idxDienstart] ?? '').trim();
                    const mitarbeiterRaw = String(row[idxMitarbeiter] ?? '').trim();
                    const dateStr = FDPImport.parseFlexibleDate(dateRaw);
                    const st = serviceByName.get(dienstartRaw.toLowerCase()) || serviceByCode.get(dienstartRaw.toLowerCase());
                    const emp = employeeByName.get(mitarbeiterRaw.toLowerCase()) || employeeByCode.get(mitarbeiterRaw.toLowerCase());
                    if (!dateStr) { results.push({ error: `Ungültiges Datum „${dateRaw}"` }); return; }
                    if (!st) { results.push({ error: `Dienstart „${dienstartRaw}" nicht gefunden (${dateStr})` }); return; }
                    if (!emp) { results.push({ error: `Mitarbeiter „${mitarbeiterRaw}" nicht gefunden (${dateStr})` }); return; }
                    const existing = existingBySlot.get(`${dateStr}|${st.id}`);
                    results.push({
                        record: { date: dateStr, serviceTypeId: st.id, employeeId: emp.id, ...(existing ? { id: existing.id } : {}) },
                        overwrite: !!existing,
                        display: { date: dateStr, service: st.name, employee: emp.name }
                    });
                });

                const valid = results.filter(r => r.record);
                const invalid = results.filter(r => r.error);
                const overwriteCount = valid.filter(r => r.overwrite).length;

                previewArea.innerHTML = `
                    <div class="alert alert-warning" style="background:var(--color-success-bg); color: var(--color-success);">
                        <div>${valid.length} von ${dataRows.length} Zeilen können importiert werden (davon ${overwriteCount} als Überschreibung bestehender Einträge).</div>
                    </div>
                    ${invalid.length > 0 ? `
                        <div class="alert alert-warning">
                            ${FDPUI.icon('warning')}
                            <div>${invalid.length} Zeile(n) übersprungen: ${invalid.slice(0, 5).map(r => FDPUI.escapeHtml(r.error)).join('; ')}${invalid.length > 5 ? ' …' : ''}</div>
                        </div>` : ''}
                    <div class="table-scroll">
                    <table class="data-table">
                        <thead><tr><th>Datum</th><th>Dienstart</th><th>Mitarbeiter</th><th></th></tr></thead>
                        <tbody>
                            ${valid.slice(0, 20).map(r => `
                                <tr>
                                    <td>${FDPUI.formatDateDisplay(r.display.date)}</td>
                                    <td>${FDPUI.escapeHtml(r.display.service)}</td>
                                    <td class="cell-strong">${FDPUI.escapeHtml(r.display.employee)}</td>
                                    <td>${r.overwrite ? '<span class="badge badge-warning">überschreibt</span>' : '<span class="badge badge-success">neu</span>'}</td>
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
                previewArea.innerHTML = `<div class="alert alert-warning">${FDPUI.icon('warning')}<div>Die Datei konnte nicht gelesen werden (${FDPUI.escapeHtml(err.message || String(err))}).</div></div>`;
            }
        });

        overlay.querySelector('#planImportConfirmBtn').addEventListener('click', async () => {
            if (!parsedRows || parsedRows.length === 0) return;
            await FDP.db.bulkPut('assignments', parsedRows);
            FDPUI.showToast(`${parsedRows.length} Diensteinträge importiert`, 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    return { render };
})();
