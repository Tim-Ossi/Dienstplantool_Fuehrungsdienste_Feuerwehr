/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/vacation.js
 * Version:    1.1.0
 * Build:      16
 * Datum:      2026-07-09
 *
 * Beschreibung:
 * Verwaltet alle Abwesenheitsarten eines Mitarbeiters (Urlaub, Krankheit,
 * Fortbildung, Wunschfrei) im Store "absences". Prüft für Urlaubseinträge,
 * ob die in den Einstellungen definierte maximale Anzahl gleichzeitig
 * abwesender Mitarbeiter überschritten wird, und warnt in diesem Fall.
 *
 * Datenmodell einer Abwesenheit:
 * {
 *   id, employeeId, type: 'urlaub'|'krank'|'fortbildung'|'wunschfrei',
 *   dateFrom, dateTo, note
 * }
 */

'use strict';

const FDPVacation = (() => {

    const TYPE_LABELS = {
        urlaub: 'Urlaub',
        krank: 'Krankheit',
        fortbildung: 'Fortbildung',
        wunschfrei: 'Wunschfrei'
    };

    const TYPE_BADGE_CLASS = {
        urlaub: 'badge-info',
        krank: 'badge-danger',
        fortbildung: 'badge-warning',
        wunschfrei: 'badge-neutral'
    };

    // Sortierzustand der Abwesenheitstabelle (bleibt für die Dauer der Sitzung erhalten)
    let sortState = { key: 'dateFrom', dir: 'desc' };

    async function render(container) {
        const [absences, employees] = await Promise.all([
            FDP.db.getAll('absences'),
            FDP.db.getAll('employees')
        ]);
        const employeeMap = new Map(employees.map(e => [e.id, e]));

        const warnings = await computeOverlapWarnings(absences, employees);

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Urlaub &amp; Abwesenheit</h1>
                    <p class="view-subtitle">${absences.length} Einträge erfasst</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-secondary" id="exportAbsencesXlsxBtn">Als Excel (.xlsx) exportieren</button>
                    <button class="btn btn-secondary" id="importAbsenceBtn">${FDPUI.icon('plus')} Aus Excel/CSV importieren</button>
                    <button class="btn btn-primary" id="addAbsenceBtn">${FDPUI.icon('plus')} Abwesenheit eintragen</button>
                </div>
            </div>

            ${warnings.length > 0 ? `
                <div class="alert alert-warning">
                    ${FDPUI.icon('warning')}
                    <div>
                        <strong>Überschneidungswarnung:</strong> An folgenden Tagen ist die maximal zulässige Anzahl
                        gleichzeitig abwesender Mitarbeiter (Urlaub) überschritten:
                        <div class="warning-list">
                            ${warnings.map(w => `<span class="tag tag-warning">${FDPUI.formatDateDisplay(w.date)} – ${FDPUI.escapeHtml(w.scope)}: ${w.count} von max. ${w.limit}</span>`).join(' ')}
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="card">
                ${absences.length === 0 ? `
                    <div class="empty-state"><p>Es sind noch keine Abwesenheiten erfasst.</p></div>
                ` : `
                <p class="text-muted">Spaltenüberschrift anklicken, um zu sortieren.</p>
                <div id="absenceTableWrap"></div>
                `}
            </div>
        `;

        container.querySelector('#addAbsenceBtn').addEventListener('click', () => openAbsenceDialog(employees));
        container.querySelector('#importAbsenceBtn').addEventListener('click', () => FDPImport.openAbsenceImportDialog());
        container.querySelector('#exportAbsencesXlsxBtn').addEventListener('click', () => exportAbsencesXlsx(absences, employeeMap));

        if (absences.length > 0) {
            renderAbsenceTable(container.querySelector('#absenceTableWrap'), absences, employees, employeeMap);
        }
    }

    function buildColumns(employeeMap) {
        return [
            { key: 'employee', label: 'Mitarbeiter', numeric: false, get: (a) => (employeeMap.get(a.employeeId)?.name || 'Unbekannt') },
            { key: 'type', label: 'Art', numeric: false, get: (a) => TYPE_LABELS[a.type] || a.type },
            { key: 'dateFrom', label: 'Von', numeric: false, get: (a) => a.dateFrom },
            { key: 'dateTo', label: 'Bis', numeric: false, get: (a) => a.dateTo },
            { key: 'days', label: 'Tage', numeric: true, get: (a) => countDays(a.dateFrom, a.dateTo) },
            { key: 'note', label: 'Bemerkung', numeric: false, get: (a) => a.note || '' }
        ];
    }

    function renderAbsenceTable(wrapEl, absences, employees, employeeMap) {
        const columns = buildColumns(employeeMap);
        const activeColumn = columns.find(c => c.key === sortState.key) || columns[2];

        const sorted = [...absences].sort((a, b) => {
            const va = activeColumn.get(a);
            const vb = activeColumn.get(b);
            let cmp;
            if (activeColumn.numeric) cmp = Number(va) - Number(vb);
            else cmp = String(va).localeCompare(String(vb), 'de');
            return sortState.dir === 'asc' ? cmp : -cmp;
        });

        wrapEl.innerHTML = `
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${columns.map((c) => `
                                <th class="sortable" data-sort-key="${c.key}">
                                    ${FDPUI.escapeHtml(c.label)}${sortState.key === c.key ? `<span class="sort-indicator">${sortState.dir === 'asc' ? '▲' : '▼'}</span>` : ''}
                                </th>
                            `).join('')}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((a) => {
                            const emp = employeeMap.get(a.employeeId);
                            const days = countDays(a.dateFrom, a.dateTo);
                            return `
                            <tr data-id="${a.id}">
                                <td class="cell-strong">${FDPUI.escapeHtml(emp ? emp.name : 'Unbekannt')}</td>
                                <td><span class="badge ${TYPE_BADGE_CLASS[a.type]}">${TYPE_LABELS[a.type]}</span></td>
                                <td>${FDPUI.formatDateDisplay(a.dateFrom)}</td>
                                <td>${FDPUI.formatDateDisplay(a.dateTo)}</td>
                                <td>${days}</td>
                                <td>${FDPUI.escapeHtml(a.note || '-')}</td>
                                <td class="cell-actions">
                                    <button class="icon-btn edit-abs-btn" title="Bearbeiten">${FDPUI.icon('edit')}</button>
                                    <button class="icon-btn icon-btn-danger delete-abs-btn" title="Löschen">${FDPUI.icon('trash')}</button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        wrapEl.querySelectorAll('th.sortable').forEach((th) => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                if (sortState.key === key) {
                    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortState = { key, dir: 'asc' };
                }
                renderAbsenceTable(wrapEl, absences, employees, employeeMap);
            });
        });

        wrapEl.querySelectorAll('.edit-abs-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                openAbsenceDialog(employees, absences.find(a => a.id === id));
            });
        });

        wrapEl.querySelectorAll('.delete-abs-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                const ok = await FDPUI.confirmDialog('Diese Abwesenheit wirklich löschen?');
                if (ok) {
                    await FDP.db.remove('absences', id);
                    FDPUI.showToast('Abwesenheit gelöscht', 'success');
                    FDPUI.refreshCurrentView();
                }
            });
        });
    }

    function countDays(from, to) {
        const d1 = FDPUI.parseISO(from);
        const d2 = FDPUI.parseISO(to);
        return Math.round((d2 - d1) / 86400000) + 1;
    }

    /**
     * Prüft für jeden Tag mit mindestens einem Urlaubseintrag, ob die maximal
     * zulässige Anzahl gleichzeitig abwesender Mitarbeiter überschritten wird -
     * sowohl die allgemeine, globale Obergrenze als auch je Qualifikation mit
     * eigener, engerer Obergrenze (z. B. "LdF": max. 1, für einen kleinen
     * Führungspool). Eine Person wird nur dann für eine qualifikationsbezogene
     * Prüfung gezählt, wenn sie diese Qualifikation tatsächlich besitzt.
     */
    async function computeOverlapWarnings(absences, employees) {
        const [maxSimultaneous, qualifications] = await Promise.all([
            FDP.db.getSetting('maxSimultaneousAbsence', 0),
            FDP.db.getAll('qualifications')
        ]);

        const vacationEntries = absences.filter(a => a.type === 'urlaub');
        const employeeMap = new Map((employees || []).map(e => [e.id, e]));

        function countByDay(entries) {
            const counts = {};
            entries.forEach((a) => {
                let d = FDPUI.parseISO(a.dateFrom);
                const end = FDPUI.parseISO(a.dateTo);
                while (d <= end) {
                    const key = FDPUI.formatDateISO(d);
                    counts[key] = (counts[key] || 0) + 1;
                    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
                }
            });
            return counts;
        }

        const warnings = [];

        if (maxSimultaneous > 0) {
            const dayCounts = countByDay(vacationEntries);
            Object.entries(dayCounts).forEach(([date, count]) => {
                if (count > maxSimultaneous) {
                    warnings.push({ date, count, limit: maxSimultaneous, scope: 'Alle Mitarbeiter' });
                }
            });
        }

        const qualsWithLimit = qualifications.filter(q => q.maxSimultaneousAbsence !== undefined && q.maxSimultaneousAbsence !== null);
        qualsWithLimit.forEach((qual) => {
            const entriesForQual = vacationEntries.filter((a) => {
                const emp = employeeMap.get(a.employeeId);
                return emp && (emp.qualifications || []).some(q => q.toLowerCase() === qual.name.toLowerCase());
            });
            const dayCounts = countByDay(entriesForQual);
            Object.entries(dayCounts).forEach(([date, count]) => {
                if (count > qual.maxSimultaneousAbsence) {
                    warnings.push({ date, count, limit: qual.maxSimultaneousAbsence, scope: qual.name });
                }
            });
        });

        return warnings.sort((a, b) => a.date.localeCompare(b.date) || a.scope.localeCompare(b.scope));
    }

    function openAbsenceDialog(employees, absence = null) {
        const isEdit = !!absence;
        const activeEmployees = employees.filter(e => e.active || (absence && e.id === absence.employeeId));

        const bodyHtml = `
            <form id="absenceForm" class="form-grid">
                <div class="form-field form-field-wide">
                    <label for="absEmployee">Mitarbeiter *</label>
                    <select id="absEmployee" required>
                        ${activeEmployees.map(e => `<option value="${e.id}" ${absence?.employeeId === e.id ? 'selected' : ''}>${FDPUI.escapeHtml(e.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-field">
                    <label for="absType">Art *</label>
                    <select id="absType" required>
                        ${Object.entries(TYPE_LABELS).map(([val, label]) => `<option value="${val}" ${absence?.type === val ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-field"></div>
                <div class="form-field">
                    <label for="absFrom">Von *</label>
                    <input type="date" id="absFrom" required value="${absence?.dateFrom || ''}">
                </div>
                <div class="form-field">
                    <label for="absTo">Bis *</label>
                    <input type="date" id="absTo" required value="${absence?.dateTo || ''}">
                </div>
                <div class="form-field form-field-wide">
                    <label for="absNote">Bemerkung</label>
                    <textarea id="absNote" rows="2">${FDPUI.escapeHtml(absence?.note || '')}</textarea>
                </div>
            </form>
        `;

        const overlay = FDPUI.showModal({
            title: isEdit ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="absCancelBtn">Abbrechen</button>
                <button class="btn btn-primary" id="absSaveBtn">${isEdit ? 'Speichern' : 'Eintragen'}</button>
            `
        });

        if (activeEmployees.length === 0) {
            overlay.querySelector('#absSaveBtn').disabled = true;
            FDPUI.showToast('Bitte zunächst einen Mitarbeiter anlegen.', 'error');
        }

        overlay.querySelector('#absCancelBtn').addEventListener('click', FDPUI.closeModal);
        overlay.querySelector('#absSaveBtn').addEventListener('click', async () => {
            const dateFrom = overlay.querySelector('#absFrom').value;
            const dateTo = overlay.querySelector('#absTo').value;
            if (!dateFrom || !dateTo) {
                FDPUI.showToast('Bitte Zeitraum vollständig angeben.', 'error');
                return;
            }
            if (dateTo < dateFrom) {
                FDPUI.showToast('Das "Bis"-Datum darf nicht vor dem "Von"-Datum liegen.', 'error');
                return;
            }
            const record = {
                employeeId: Number(overlay.querySelector('#absEmployee').value),
                type: overlay.querySelector('#absType').value,
                dateFrom,
                dateTo,
                note: overlay.querySelector('#absNote').value.trim()
            };
            if (isEdit) record.id = absence.id;

            // Duplikatsprüfung: gleicher Mitarbeiter, gleiche Art, überschneidender
            // Zeitraum bereits vorhanden (sich selbst beim Bearbeiten ausgenommen).
            const existingAbsences = await FDP.db.getAll('absences');
            const duplicate = existingAbsences.find((a) =>
                a.employeeId === record.employeeId &&
                a.type === record.type &&
                (!isEdit || a.id !== record.id) &&
                FDPUI.dateRangeOverlaps(record.dateFrom, record.dateTo, a.dateFrom, a.dateTo)
            );
            if (duplicate) {
                FDPUI.showToast(`Für diesen Mitarbeiter existiert bereits ein überschneidender Eintrag derselben Art (${FDPUI.formatDateDisplay(duplicate.dateFrom)}–${FDPUI.formatDateDisplay(duplicate.dateTo)}).`, 'error');
                return;
            }

            await FDP.db.put('absences', record);
            FDPUI.showToast(isEdit ? 'Abwesenheit aktualisiert' : 'Abwesenheit eingetragen', 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    /**
     * Liefert alle Abwesenheiten, die einen bestimmten Tag betreffen.
     */
    async function getAbsencesForDate(dateStr) {
        const absences = await FDP.db.getAll('absences');
        return absences.filter(a => a.dateFrom <= dateStr && dateStr <= a.dateTo);
    }

    /**
     * Exportiert alle erfassten Abwesenheiten als echte .xlsx-Datei - mit
     * denselben Spaltenüberschriften (Mitarbeiter, Art, Von, Bis, Bemerkung),
     * die auch die Import-Vorlage und der Abwesenheiten-Import in import.js
     * erwarten, damit sich die Datei nach Bearbeitung direkt wieder
     * importieren lässt.
     */
    function exportAbsencesXlsx(absences, employeeMap) {
        if (absences.length === 0) {
            FDPUI.showToast('Es sind keine Abwesenheiten vorhanden.', 'info');
            return;
        }
        const header = ['Mitarbeiter', 'Art', 'Von', 'Bis', 'Bemerkung'];
        const rows = [...absences]
            .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
            .map((a) => {
                const emp = employeeMap.get(a.employeeId);
                return [emp ? emp.name : 'Unbekannt', TYPE_LABELS[a.type] || a.type, a.dateFrom, a.dateTo, a.note || ''];
            });

        const bytes = FDPImport.buildMinimalXlsx('Abwesenheiten', [header, ...rows]);
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        FDPImport.downloadBytes(`FDP-Abwesenheiten-${stamp}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        FDPUI.showToast(`${absences.length} Abwesenheiten als Excel-Datei exportiert`, 'success');
    }

    return { render, openAbsenceDialog, getAbsencesForDate, TYPE_LABELS, countDays };
})();
