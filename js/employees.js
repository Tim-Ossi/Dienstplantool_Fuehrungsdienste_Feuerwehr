/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/employees.js
 * Version:    1.8.0
 * Build:      17
 * Datum:      2026-07-11
 *
 * Beschreibung:
 * Verwaltung beliebig vieler Mitarbeiter. Es gibt keine fest programmierten
 * Mitarbeiterzahlen oder Namen - alle Datensätze stammen aus IndexedDB
 * (Store "employees") und werden hier ausschließlich verwaltet.
 *
 * Datenmodell eines Mitarbeiters:
 * {
 *   id, name, shortCode, department (Freitext, Altbestand),
 *   departmentCode (Referenz auf Store "departments"),
 *   qualifications: string[] (Namen aus Store "qualifications"),
 *   active: boolean, dutyRosterEligible: boolean (Führungsdienstler vs.
 *   reine Sachbearbeitung/Anwesenheitsplanung), preferredLeadership: boolean,
 *   serviceTypeQuotas: { [serviceTypeId]: Prozentzahl 0-100 } (manuelle
 *   Zielverteilung auf Dienstarten; nicht gesetzte Dienstarten werden von
 *   der Planung gleichmäßig aufgeteilt),
 *   vacationEntitlement: number, vacationRemaining: number,
 *   partTimePercent: number, notes: string
 * }
 */

'use strict';

const FDPEmployees = (() => {

    // Sortierzustand der Mitarbeitertabelle (bleibt für die Dauer der Sitzung erhalten)
    let sortState = { key: 'name', dir: 'asc' };

    async function render(container) {
        const [employees, departments] = await Promise.all([
            FDP.db.getAll('employees'),
            FDP.db.getAll('departments')
        ]);
        const departmentByCode = new Map(departments.map(d => [d.code, d]));
        const rosterCount = employees.filter(e => e.dutyRosterEligible !== false).length;

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Mitarbeiter</h1>
                    <p class="view-subtitle">${employees.length} Mitarbeiter erfasst · ${employees.filter(e => e.active).length} aktiv · ${rosterCount} führungsdienstplanbar</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-secondary" id="importEmployeesBtn">${FDPUI.icon('plus')} Aus Excel/CSV importieren</button>
                    <button class="btn btn-primary" id="addEmployeeBtn">${FDPUI.icon('plus')} Mitarbeiter anlegen</button>
                </div>
            </div>
            <div class="card">
                ${employees.length === 0 ? `
                    <div class="empty-state">
                        <p>Es sind noch keine Mitarbeiter angelegt.</p>
                        <button class="btn btn-primary" id="addEmployeeBtnEmpty">${FDPUI.icon('plus')} Ersten Mitarbeiter anlegen</button>
                    </div>
                ` : `
                <p class="text-muted">Spaltenüberschrift anklicken, um zu sortieren.</p>
                <div id="employeeTableWrap"></div>
                `}
            </div>
        `;

        const openAdd = () => openEmployeeDialog();
        container.querySelector('#addEmployeeBtn')?.addEventListener('click', openAdd);
        container.querySelector('#addEmployeeBtnEmpty')?.addEventListener('click', openAdd);
        container.querySelector('#importEmployeesBtn')?.addEventListener('click', () => FDPImport.openImportDialog());

        if (employees.length > 0) {
            renderEmployeeTable(container.querySelector('#employeeTableWrap'), employees, departmentByCode);
        }
    }

    /**
     * Definiert die sortierbaren Spalten der Mitarbeitertabelle inkl. Wertzugriff.
     */
    function buildColumns(departmentByCode) {
        const deptLabel = (e) => {
            const dept = e.departmentCode ? departmentByCode.get(e.departmentCode) : null;
            return dept ? dept.name : (e.department || '');
        };
        return [
            { key: 'name', label: 'Name', numeric: false, get: (e) => e.name },
            { key: 'shortCode', label: 'Kürzel', numeric: false, get: (e) => e.shortCode || '' },
            { key: 'department', label: 'Abteilung', numeric: false, get: deptLabel },
            { key: 'role', label: 'Rolle', numeric: false, get: (e) => e.dutyRosterEligible !== false ? 'Führungsdienst' : 'Sachbearbeitung' },
            { key: 'qualifications', label: 'Qualifikationen', numeric: false, get: (e) => (e.qualifications || []).join(', ') },
            { key: 'vacationRemaining', label: 'Urlaub (Rest / Anspruch)', numeric: true, get: (e) => e.vacationRemaining ?? 0 },
            { key: 'status', label: 'Status', numeric: false, get: (e) => e.active ? 'aktiv' : 'inaktiv' }
        ];
    }

    function renderEmployeeTable(wrapEl, employees, departmentByCode) {
        const columns = buildColumns(departmentByCode);
        const activeColumn = columns.find(c => c.key === sortState.key) || columns[0];

        const sorted = [...employees].sort((a, b) => {
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
                        ${sorted.map((e) => {
                            const dept = e.departmentCode ? departmentByCode.get(e.departmentCode) : null;
                            const deptLabel = dept ? dept.name : (e.department || '-');
                            return `
                            <tr data-id="${e.id}">
                                <td class="cell-strong">${FDPUI.escapeHtml(e.name)} ${e.preferredLeadership ? '<span class="badge badge-warning" title="Leiter der Feuerwehr / bevorzugt Führungsfunktion">Leitung</span>' : ''}</td>
                                <td><span class="badge badge-neutral">${FDPUI.escapeHtml(e.shortCode || '-')}</span></td>
                                <td>${FDPUI.escapeHtml(deptLabel)}</td>
                                <td>${e.dutyRosterEligible !== false ? '<span class="badge badge-info">Führungsdienst</span>' : '<span class="badge badge-neutral" title="Nur Sachbearbeitung / Anwesenheitsplanung">Sachbearbeitung</span>'}</td>
                                <td>${(e.qualifications || []).map(q => `<span class="tag">${FDPUI.escapeHtml(q)}</span>`).join(' ') || '-'}</td>
                                <td>${e.vacationRemaining ?? 0} / ${e.vacationEntitlement ?? 0} Tage</td>
                                <td>${e.active ? '<span class="badge badge-success">aktiv</span>' : '<span class="badge badge-muted">inaktiv</span>'}</td>
                                <td class="cell-actions">
                                    <button class="icon-btn print-year-plan-btn" title="Jahresdienstplan drucken">${FDPUI.icon('calendar')}</button>
                                    <button class="icon-btn edit-emp-btn" title="Bearbeiten">${FDPUI.icon('edit')}</button>
                                    <button class="icon-btn icon-btn-danger delete-emp-btn" title="Löschen">${FDPUI.icon('trash')}</button>
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
                renderEmployeeTable(wrapEl, employees, departmentByCode);
            });
        });

        wrapEl.querySelectorAll('.edit-emp-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                const emp = employees.find(x => x.id === id);
                openEmployeeDialog(emp);
            });
        });

        wrapEl.querySelectorAll('.print-year-plan-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                const emp = employees.find(x => x.id === id);
                btn.disabled = true;
                try {
                    await FDPYearPlan.printYearPlanForEmployee(emp);
                } finally {
                    btn.disabled = false;
                }
            });
        });

        wrapEl.querySelectorAll('.delete-emp-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.target.closest('tr').dataset.id);
                const emp = employees.find(x => x.id === id);
                const ok = await FDPUI.confirmDialog(`Mitarbeiter "${emp.name}" wirklich löschen? Zugehörige Diensteinträge und Abwesenheiten bleiben als historische Daten bestehen, referenzieren aber keinen aktiven Mitarbeiter mehr.`);
                if (ok) {
                    await FDP.db.remove('employees', id);
                    FDPUI.showToast('Mitarbeiter gelöscht', 'success');
                    FDPUI.refreshCurrentView();
                }
            });
        });
    }

    /**
     * Vergleicht zwei Abteilungscodes (z. B. "5.11" vs. "5.2") segmentweise
     * numerisch, damit die hierarchische Reihenfolge stimmt (5.2 kommt nach
     * 5.14, nicht alphabetisch vor 5.11).
     */
    function compareDepartmentCodes(a, b) {
        const partsA = String(a).split('.').map(Number);
        const partsB = String(b).split('.').map(Number);
        const len = Math.max(partsA.length, partsB.length);
        for (let i = 0; i < len; i++) {
            const diff = (partsA[i] || 0) - (partsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    /**
     * Baut aus der flachen Abteilungsliste eine hierarchisch sortierte,
     * eingerückte Liste für die Auswahl im Formular.
     */
    function flattenDepartmentTree(departments) {
        const byParent = new Map();
        departments.forEach((d) => {
            const key = d.parentCode || '';
            if (!byParent.has(key)) byParent.set(key, []);
            byParent.get(key).push(d);
        });
        byParent.forEach((list) => list.sort((a, b) => compareDepartmentCodes(a.code, b.code)));

        const result = [];
        function visit(parentKey, depth) {
            const children = byParent.get(parentKey) || [];
            children.forEach((d) => {
                result.push({ dept: d, depth });
                visit(d.code, depth + 1);
            });
        }
        visit('', 0);
        return result;
    }

    async function openEmployeeDialog(employee = null) {
        const isEdit = !!employee;
        const [departments, qualifications, serviceTypes] = await Promise.all([
            FDP.db.getAll('departments'),
            FDP.db.getAll('qualifications'),
            FDP.db.getAll('serviceTypes')
        ]);
        qualifications.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        const activeServiceTypes = serviceTypes.filter(s => s.active !== false).sort((a, b) => a.sortOrder - b.sortOrder);
        const flatDepartments = flattenDepartmentTree(departments);
        const empQualifications = new Set(employee?.qualifications || []);
        const empQuotas = employee?.serviceTypeQuotas || {};

        const bodyHtml = `
            <form id="employeeForm" class="form-grid">
                <div class="form-field">
                    <label for="empName">Name *</label>
                    <input type="text" id="empName" required value="${FDPUI.escapeHtml(employee?.name || '')}">
                </div>
                <div class="form-field">
                    <label for="empShortCode">Kürzel</label>
                    <input type="text" id="empShortCode" maxlength="6" value="${FDPUI.escapeHtml(employee?.shortCode || '')}">
                </div>
                <div class="form-field form-field-wide">
                    <label for="empDepartment">Abteilung</label>
                    ${flatDepartments.length > 0 ? `
                        <select id="empDepartment">
                            <option value="">— keine Abteilung —</option>
                            ${flatDepartments.map(({ dept, depth }) => `
                                <option value="${dept.code}" ${employee?.departmentCode === dept.code ? 'selected' : ''}>
                                    ${'\u2007\u2007'.repeat(depth)}${FDPUI.escapeHtml(dept.code)} – ${FDPUI.escapeHtml(dept.name)}
                                </option>`).join('')}
                        </select>
                    ` : `<input type="text" id="empDepartmentText" value="${FDPUI.escapeHtml(employee?.department || '')}" placeholder="Noch keine Abteilungen unter Einstellungen angelegt">`}
                </div>
                <div class="form-field form-field-wide">
                    <label>Qualifikationen</label>
                    ${qualifications.length > 0 ? `
                        <div class="checkbox-grid">
                            ${qualifications.map(q => `
                                <label class="checkbox-chip">
                                    <input type="checkbox" value="${FDPUI.escapeHtml(q.name)}" class="emp-qualification-cb" ${empQualifications.has(q.name) ? 'checked' : ''}>
                                    ${FDPUI.escapeHtml(q.name)}
                                </label>`).join('')}
                        </div>
                    ` : '<p class="text-muted">Noch keine Qualifikationen unter Einstellungen angelegt.</p>'}
                </div>
                <div class="form-field">
                    <label for="empVacationEntitlement">Urlaubsanspruch (Tage/Jahr)</label>
                    <input type="number" id="empVacationEntitlement" min="0" step="0.5" value="${employee?.vacationEntitlement ?? 30}">
                </div>
                <div class="form-field">
                    <label for="empVacationRemaining">Resturlaub (Tage)</label>
                    <input type="number" id="empVacationRemaining" min="0" step="0.5" value="${employee?.vacationRemaining ?? employee?.vacationEntitlement ?? 30}">
                </div>
                <div class="form-field">
                    <label for="empPartTime">Beschäftigungsumfang (%)</label>
                    <input type="number" id="empPartTime" min="1" max="100" value="${employee?.partTimePercent ?? 100}">
                </div>
                <div class="form-field form-field-checkbox">
                    <label><input type="checkbox" id="empActive" ${employee?.active !== false ? 'checked' : ''}> Mitarbeiter ist aktiv</label>
                </div>
                <div class="form-field form-field-checkbox">
                    <label><input type="checkbox" id="empDutyRosterEligible" ${employee?.dutyRosterEligible !== false ? 'checked' : ''}>
                        Führungsdienstler – steht für die automatische Dienstplanung (B-/C-Dienst, Verfüger, LdF, FBL) zur Verfügung
                    </label>
                </div>
                <p class="text-muted" style="margin: -6px 0 0 0;">Ist dieses Häkchen entfernt, wird die Person nur für die Anwesenheitsplanung (Urlaub/Krankheit je Abteilung) geführt und taucht nicht im Kalender oder in der automatischen Dienstplanung auf.</p>
                <div class="form-field form-field-checkbox">
                    <label><input type="checkbox" id="empPreferredLeadership" ${employee?.preferredLeadership === true ? 'checked' : ''}> Leiter der Feuerwehr / bevorzugt für Führungsfunktionen (LdF, FBL) vorgesehen</label>
                </div>
                <div class="form-field form-field-wide">
                    <label>Verteilung auf Dienstarten (%)</label>
                    <p class="text-muted" style="margin: -2px 0 8px 0;">Legt fest, welchen Anteil der jeweiligen Person an den einzelnen Dienstarten die automatische Planung anstrebt (bezogen auf die Dienste dieser Person, nicht auf die Gesamtbelastung aller Mitarbeiter - diese bleibt weiterhin ausgeglichen). Leer gelassene Dienstarten werden von der Planung möglichst gleichmäßig untereinander aufgeteilt.</p>
                    ${activeServiceTypes.length > 0 ? `
                        <div class="quota-grid">
                            ${activeServiceTypes.map(st => `
                                <div class="quota-row">
                                    <span class="service-dot" style="background:${st.color}"></span>
                                    <span class="quota-label">${FDPUI.escapeHtml(st.name)}</span>
                                    <input type="number" min="0" max="100" step="1" placeholder="auto" class="quota-input" data-service-id="${st.id}" value="${empQuotas[st.id] ?? ''}">
                                    <span class="quota-percent">%</span>
                                </div>
                            `).join('')}
                        </div>
                        <p class="text-muted quota-sum-hint" id="quotaSumHint"></p>
                    ` : '<p class="text-muted">Noch keine Dienstarten unter Einstellungen angelegt.</p>'}
                </div>
                <div class="form-field form-field-wide">
                    <label for="empNotes">Bemerkungen</label>
                    <textarea id="empNotes" rows="3">${FDPUI.escapeHtml(employee?.notes || '')}</textarea>
                </div>
            </form>
        `;

        const overlay = FDPUI.showModal({
            title: isEdit ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="empCancelBtn">Abbrechen</button>
                <button class="btn btn-primary" id="empSaveBtn">${isEdit ? 'Speichern' : 'Anlegen'}</button>
            `,
            size: 'large'
        });

        function updateQuotaSumHint() {
            const hint = overlay.querySelector('#quotaSumHint');
            if (!hint) return;
            const inputs = Array.from(overlay.querySelectorAll('.quota-input'));
            const sum = inputs.reduce((s, inp) => s + (inp.value.trim() === '' ? 0 : Number(inp.value)), 0);
            const openCount = inputs.filter(inp => inp.value.trim() === '').length;
            if (sum > 100) {
                hint.textContent = `Summe: ${sum}% – das sind mehr als 100%, bitte prüfen.`;
                hint.classList.add('text-danger');
            } else {
                hint.textContent = openCount > 0
                    ? `Summe der festgelegten Werte: ${sum}%. Die restlichen ${100 - sum}% werden gleichmäßig auf die ${openCount} nicht ausgefüllten Dienstart(en) verteilt.`
                    : `Summe: ${sum}%.`;
                hint.classList.remove('text-danger');
            }
        }
        overlay.querySelectorAll('.quota-input').forEach((inp) => inp.addEventListener('input', updateQuotaSumHint));
        updateQuotaSumHint();

        overlay.querySelector('#empCancelBtn').addEventListener('click', FDPUI.closeModal);
        overlay.querySelector('#empSaveBtn').addEventListener('click', async () => {
            const name = overlay.querySelector('#empName').value.trim();
            if (!name) {
                FDPUI.showToast('Bitte einen Namen angeben.', 'error');
                return;
            }
            const departmentSelect = overlay.querySelector('#empDepartment');
            const departmentText = overlay.querySelector('#empDepartmentText');
            const selectedQualifications = Array.from(overlay.querySelectorAll('.emp-qualification-cb:checked')).map(cb => cb.value);
            const serviceTypeQuotas = {};
            overlay.querySelectorAll('.quota-input').forEach((inp) => {
                if (inp.value.trim() !== '') {
                    serviceTypeQuotas[inp.dataset.serviceId] = Math.max(0, Math.min(100, Number(inp.value)));
                }
            });

            const record = {
                name,
                shortCode: overlay.querySelector('#empShortCode').value.trim(),
                departmentCode: departmentSelect ? (departmentSelect.value || null) : (employee?.departmentCode || null),
                department: departmentText ? departmentText.value.trim() : (employee?.department || ''),
                qualifications: selectedQualifications,
                vacationEntitlement: Number(overlay.querySelector('#empVacationEntitlement').value) || 0,
                vacationRemaining: Number(overlay.querySelector('#empVacationRemaining').value) || 0,
                partTimePercent: Number(overlay.querySelector('#empPartTime').value) || 100,
                active: overlay.querySelector('#empActive').checked,
                dutyRosterEligible: overlay.querySelector('#empDutyRosterEligible').checked,
                preferredLeadership: overlay.querySelector('#empPreferredLeadership').checked,
                serviceTypeQuotas,
                notes: overlay.querySelector('#empNotes').value.trim()
            };
            if (isEdit) record.id = employee.id;

            await FDP.db.put('employees', record);
            FDPUI.showToast(isEdit ? 'Mitarbeiter aktualisiert' : 'Mitarbeiter angelegt', 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    return { render, openEmployeeDialog, compareDepartmentCodes, flattenDepartmentTree };
})();
