/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/calendar.js
 * Version:    1.5.0
 * Build:      16
 * Datum:      2026-07-11
 *
 * Beschreibung:
 * Rendert den Jahreskalender (12-Monats-Übersicht) sowie die detaillierte
 * Monatsansicht mit Tageskarten. Jede Tageskarte zeigt die zugewiesenen
 * Diensteinträge je Dienstart, Abwesenheiten sowie ein Ampelsystem, das den
 * Besetzungsstatus des Tages visualisiert. Wochenenden und Feiertage werden
 * farblich hervorgehoben.
 */

'use strict';

const FDPCalendar = (() => {

    let state = {
        mode: 'month', // 'month' | 'year'
        year: new Date().getFullYear(),
        month: new Date().getMonth() // 0-11
    };

    async function render(container, options = {}) {
        if (options.year !== undefined) state.year = options.year;
        if (options.month !== undefined) state.month = options.month;
        if (options.mode !== undefined) state.mode = options.mode;
        if (state.year === undefined) {
            state.year = Number(await FDP.db.getSetting('year', new Date().getFullYear()));
        }

        const bundesland = await FDP.db.getSetting('bundesland', 'NW');
        const feuerwehrname = await FDP.db.getSetting('feuerwehrname', 'Freiwillige Feuerwehr');
        const holidays = FDPHolidays.getHolidays(state.year, bundesland);
        const [serviceTypes, employees, assignments, absences, departments] = await Promise.all([
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('employees'),
            FDP.db.getAll('assignments'),
            FDP.db.getAll('absences'),
            FDP.db.getAll('departments')
        ]);
        const activeServiceTypes = serviceTypes.filter(s => s.active !== false).sort((a, b) => a.sortOrder - b.sortOrder);

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Kalender</h1>
                    <p class="view-subtitle">${state.year} · ${FDPUI.monthName(state.month)}</p>
                </div>
                <div class="header-actions">
                    <div class="segmented">
                        <button class="segmented-btn ${state.mode === 'month' ? 'active' : ''}" data-mode="month">Monat</button>
                        <button class="segmented-btn ${state.mode === 'year' ? 'active' : ''}" data-mode="year">Jahr</button>
                    </div>
                    <button class="btn btn-secondary" id="calPrintBtn">${FDPUI.icon('calendar')} Monat drucken / als PDF speichern</button>
                </div>
            </div>

            <div class="print-only print-header">
                <h1>${FDPUI.escapeHtml(feuerwehrname)}</h1>
                <p>Dienstplan – ${FDPUI.monthName(state.month)} ${state.year}</p>
            </div>

            <div class="calendar-nav">
                <button class="icon-btn" id="calPrevBtn">${FDPUI.icon('chevronLeft')}</button>
                <div class="calendar-nav-label">${state.mode === 'month' ? `${FDPUI.monthName(state.month)} ${state.year}` : `${state.year}`}</div>
                <button class="icon-btn" id="calNextBtn">${FDPUI.icon('chevronRight')}</button>
            </div>

            <div class="calendar-legend">
                ${activeServiceTypes.map(s => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${FDPUI.escapeHtml(s.name)}</span>`).join('')}
                <span class="legend-item"><span class="legend-dot legend-dot-weekend"></span>Wochenende</span>
                <span class="legend-item"><span class="legend-dot legend-dot-holiday"></span>Feiertag</span>
            </div>

            <div id="calendarBody"></div>
        `;

        const body = container.querySelector('#calendarBody');
        if (state.mode === 'month') {
            renderMonthView(body, activeServiceTypes, employees, assignments, absences, holidays, departments);
        } else {
            renderYearView(body, activeServiceTypes, employees, assignments, absences, bundesland);
        }

        container.querySelectorAll('.segmented-btn').forEach((btn) => {
            btn.addEventListener('click', () => render(container, { mode: btn.dataset.mode }));
        });

        container.querySelector('#calPrintBtn').addEventListener('click', async () => {
            if (state.mode !== 'month') {
                await render(container, { mode: 'month' });
            }
            setTimeout(() => window.print(), 50);
        });

        container.querySelector('#calPrevBtn').addEventListener('click', () => {
            if (state.mode === 'month') {
                let m = state.month - 1, y = state.year;
                if (m < 0) { m = 11; y -= 1; }
                render(container, { month: m, year: y });
            } else {
                render(container, { year: state.year - 1 });
            }
        });
        container.querySelector('#calNextBtn').addEventListener('click', () => {
            if (state.mode === 'month') {
                let m = state.month + 1, y = state.year;
                if (m > 11) { m = 0; y += 1; }
                render(container, { month: m, year: y });
            } else {
                render(container, { year: state.year + 1 });
            }
        });
    }

    function dayStatus(dateStr, activeServiceTypes, assignments, absences) {
        const dayAssignments = assignments.filter(a => a.date === dateStr);
        const dayAbsences = absences.filter(a => a.dateFrom <= dateStr && dateStr <= a.dateTo);
        const absentEmployeeIds = new Set(dayAbsences.map(a => a.employeeId));
        const serviceTypeById = new Map(activeServiceTypes.map(s => [s.id, s]));

        // Mehrfachbesetzung ist nur dann ein Konflikt, wenn nicht ALLE betroffenen
        // Dienstarten für diese Person als "kombinierbar" markiert sind
        // (z. B. LdF und FBL dürfen durch dieselbe Person übernommen werden).
        let conflict = false;
        const assignmentsByEmployee = new Map();
        dayAssignments.forEach((a) => {
            if (!assignmentsByEmployee.has(a.employeeId)) assignmentsByEmployee.set(a.employeeId, []);
            assignmentsByEmployee.get(a.employeeId).push(a);
            if (absentEmployeeIds.has(a.employeeId)) conflict = true;
        });
        assignmentsByEmployee.forEach((list) => {
            if (list.length <= 1) return;
            const allCombinable = list.every((a) => {
                const st = serviceTypeById.get(a.serviceTypeId);
                return st && st.combinable === true;
            });
            if (!allCombinable) conflict = true;
        });

        const filledCount = new Set(dayAssignments.map(a => a.serviceTypeId)).size;
        const requiredCount = activeServiceTypes.length;

        let ampel = 'green';
        if (conflict) ampel = 'red';
        else if (filledCount < requiredCount) ampel = requiredCount === 0 ? 'green' : (filledCount === 0 ? 'red' : 'yellow');

        return { dayAssignments, dayAbsences, conflict, ampel, filledCount, requiredCount };
    }

    function renderMonthView(body, activeServiceTypes, employees, assignments, absences, holidays, departments) {
        const employeeMap = new Map(employees.map(e => [e.id, e]));
        const firstOfMonth = new Date(state.year, state.month, 1);
        const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
        const startOffset = (firstOfMonth.getDay() + 6) % 7; // Montag = 0

        const cells = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        const weekRowCount = Math.ceil(cells.length / 7);

        body.innerHTML = `
            <div class="month-grid" style="--week-rows: ${weekRowCount};">
                ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => `<div class="month-grid-weekday">${w}</div>`).join('')}
                ${cells.map((d) => {
                    if (d === null) return '<div class="day-card day-card-empty"></div>';
                    const date = new Date(state.year, state.month, d);
                    const dateStr = FDPUI.formatDateISO(date);
                    const isWeekend = FDPUI.isWeekend(date);
                    const holidayName = holidays[dateStr];
                    const status = dayStatus(dateStr, activeServiceTypes, assignments, absences);
                    const presenceViolations = departments ? FDPPresence.computeViolationsForDate(dateStr, employees, departments, assignments, absences, holidays) : [];

                    return `
                    <div class="day-card ${isWeekend ? 'day-card-weekend' : ''} ${holidayName ? 'day-card-holiday' : ''}" data-date="${dateStr}">
                        <div class="day-card-header">
                            <span class="day-card-date">${d}</span>
                            <span class="day-card-weekday">${FDPUI.weekdayShort(date)}</span>
                            <span class="day-card-wa" title="Wachabteilung im Tagesdienst">${FDPWachabteilung.getWachabteilungForDate(dateStr)}</span>
                            <span class="ampel ampel-${status.ampel}" title="Besetzungsstatus"></span>
                        </div>
                        ${holidayName ? `<div class="day-card-holiday-name">${FDPUI.escapeHtml(holidayName)}</div>` : ''}
                        <div class="day-card-services">
                            ${activeServiceTypes.map((s) => {
                                const assignment = status.dayAssignments.find(a => a.serviceTypeId === s.id);
                                const emp = assignment ? employeeMap.get(assignment.employeeId) : null;
                                return `<div class="day-card-service">
                                    <span class="service-dot" style="background:${s.color}"></span>
                                    <span class="service-name">${FDPUI.escapeHtml(s.shortCode || s.name)}</span>
                                    <span class="service-value">${emp ? FDPUI.escapeHtml(emp.shortCode || emp.name) : '—'}</span>
                                </div>`;
                            }).join('')}
                        </div>
                        ${status.dayAbsences.length > 0 ? `
                            <div class="day-card-absences">
                                ${status.dayAbsences.slice(0, 3).map(a => {
                                    const e = employeeMap.get(a.employeeId);
                                    return `<span class="tag tag-xs">${FDPUI.escapeHtml(e ? (e.shortCode || e.name) : '?')} · ${FDPVacation.TYPE_LABELS[a.type]}</span>`;
                                }).join('')}
                                ${status.dayAbsences.length > 3 ? `<span class="tag tag-xs">+${status.dayAbsences.length - 3}</span>` : ''}
                            </div>
                        ` : ''}
                        ${status.conflict ? `<div class="day-card-conflict">${FDPUI.icon('warning')} Konflikt</div>` : ''}
                        ${presenceViolations.some(v => v.severity !== 'info') ? `<div class="day-card-conflict day-card-presence-warning" title="${FDPUI.escapeHtml(presenceViolations.filter(v => v.severity !== 'info').map(v => v.message).join(' | '))}">${FDPUI.icon('warning')} Abteilung unterbesetzt</div>` : ''}
                    </div>`;
                }).join('')}
            </div>
        `;

        body.querySelectorAll('.day-card:not(.day-card-empty)').forEach((card) => {
            card.addEventListener('click', () => openDayDialog(card.dataset.date, activeServiceTypes, employees, assignments, absences));
        });
    }

    function renderYearView(body, activeServiceTypes, employees, assignments, absences, bundesland) {
        const holidays = FDPHolidays.getHolidays(state.year, bundesland);
        let html = '<div class="year-grid">';
        for (let m = 0; m < 12; m++) {
            const daysInMonth = new Date(state.year, m + 1, 0).getDate();
            const firstOfMonth = new Date(state.year, m, 1);
            const startOffset = (firstOfMonth.getDay() + 6) % 7;
            const cells = [];
            for (let i = 0; i < startOffset; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);

            html += `<div class="mini-month" data-month="${m}">
                <div class="mini-month-title">${FDPUI.monthName(m)}</div>
                <div class="mini-month-grid">
                    ${['M','D','M','D','F','S','S'].map(w => `<div class="mini-weekday">${w}</div>`).join('')}
                    ${cells.map((d) => {
                        if (d === null) return '<div class="mini-day mini-day-empty"></div>';
                        const date = new Date(state.year, m, d);
                        const dateStr = FDPUI.formatDateISO(date);
                        const isWeekend = FDPUI.isWeekend(date);
                        const holidayName = holidays[dateStr];
                        const status = dayStatus(dateStr, activeServiceTypes, assignments, absences);
                        return `<div class="mini-day ampel-bg-${status.ampel} ${isWeekend ? 'mini-day-weekend' : ''} ${holidayName ? 'mini-day-holiday' : ''}" title="${dateStr}${holidayName ? ' · ' + holidayName : ''}" data-date="${dateStr}">${d}</div>`;
                    }).join('')}
                </div>
            </div>`;
        }
        html += '</div>';
        body.innerHTML = html;

        body.querySelectorAll('.mini-month-title').forEach((title, idx) => {
            title.addEventListener('click', () => {
                const content = document.getElementById('appContent');
                render(content, { mode: 'month', month: idx, year: state.year });
            });
        });
        body.querySelectorAll('.mini-day:not(.mini-day-empty)').forEach((cell) => {
            cell.addEventListener('click', () => {
                const content = document.getElementById('appContent');
                const [y, m] = cell.dataset.date.split('-').map(Number);
                render(content, { mode: 'month', month: m - 1, year: y }).then(() => {
                    // Nach Renderwechsel Tagesdialog öffnen
                });
            });
        });
    }

    async function openDayDialog(dateStr, activeServiceTypes, employees, assignments, absences) {
        const date = FDPUI.parseISO(dateStr);
        const dayAssignments = assignments.filter(a => a.date === dateStr);
        const dayAbsences = absences.filter(a => a.dateFrom <= dateStr && dateStr <= a.dateTo);
        const absentIds = new Set(dayAbsences.map(a => a.employeeId));
        const activeEmployees = employees.filter(e => e.active && e.dutyRosterEligible !== false);
        const departments = await FDP.db.getAll('departments');
        const bundesland = await FDP.db.getSetting('bundesland', 'NW');
        const dayHolidays = FDPHolidays.getHolidays(date.getFullYear(), bundesland);
        const presenceViolations = FDPPresence.computeViolationsForDate(dateStr, employees, departments, assignments, absences, dayHolidays);

        const bodyHtml = `
            <div class="day-dialog-date">${FDPUI.weekdayLong(date)}, ${FDPUI.formatDateDisplay(dateStr)}</div>
            <p class="text-muted" style="margin-top:-8px;">Wachabteilung im 24h-Tagesdienst: <strong>${FDPWachabteilung.getWachabteilungForDate(dateStr)}</strong></p>
            ${presenceViolations.length > 0 ? `
                <div class="alert alert-warning" style="margin-bottom:14px;">
                    ${FDPUI.icon('warning')}
                    <div>
                        <strong>Abteilungs-Mindestbesetzung nicht erfüllt:</strong>
                        <div class="warning-list">
                            ${presenceViolations.map(v => `<span class="tag ${v.severity === 'info' ? '' : 'tag-warning'}">${FDPUI.escapeHtml(v.message)}</span>`).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}
            <form id="dayForm" class="form-grid">
                ${activeServiceTypes.map((s) => {
                    const current = dayAssignments.find(a => a.serviceTypeId === s.id);
                    const required = s.requiredQualifications || [];
                    const hasQualification = (e) => required.length === 0 || required.every(q => (e.qualifications || []).some(eq => eq.toLowerCase() === q.toLowerCase()));
                    return `
                    <div class="form-field form-field-wide">
                        <label><span class="service-dot" style="background:${s.color}"></span> ${FDPUI.escapeHtml(s.name)}${required.length > 0 ? ` <span class="text-muted">(benötigt: ${required.map(q => FDPUI.escapeHtml(q)).join(', ')})</span>` : ''}</label>
                        <select data-service-id="${s.id}" class="day-service-select">
                            <option value="">— nicht besetzt —</option>
                            ${activeEmployees.map(e => `
                                <option value="${e.id}" ${current?.employeeId === e.id ? 'selected' : ''} ${(absentIds.has(e.id) || !hasQualification(e)) ? 'disabled' : ''}>
                                    ${FDPUI.escapeHtml(e.name)}${absentIds.has(e.id) ? ' (abwesend)' : (!hasQualification(e) ? ' (Qualifikation fehlt)' : '')}
                                </option>`).join('')}
                        </select>
                    </div>`;
                }).join('')}
            </form>
            ${dayAbsences.length > 0 ? `
                <div class="day-dialog-absences">
                    <h3>Abwesenheiten an diesem Tag</h3>
                    ${dayAbsences.map((a) => {
                        const e = employees.find(x => x.id === a.employeeId);
                        return `<div class="tag">${FDPUI.escapeHtml(e ? e.name : '?')} · ${FDPVacation.TYPE_LABELS[a.type]}</div>`;
                    }).join('')}
                </div>
            ` : ''}
        `;

        const overlay = FDPUI.showModal({
            title: 'Diensteinteilung',
            bodyHtml,
            footerHtml: `
                <button class="btn btn-secondary" id="dayCancelBtn">Schließen</button>
                <button class="btn btn-primary" id="daySaveBtn">Speichern</button>
            `,
            size: 'medium'
        });

        overlay.querySelector('#dayCancelBtn').addEventListener('click', FDPUI.closeModal);
        const serviceTypeById = new Map(activeServiceTypes.map(s => [s.id, s]));
        overlay.querySelector('#daySaveBtn').addEventListener('click', async () => {
            const selects = overlay.querySelectorAll('.day-service-select');
            const chosenByEmployee = new Map(); // employeeId -> [serviceTypeId, ...]
            for (const sel of selects) {
                const val = sel.value;
                if (!val) continue;
                const empId = Number(val);
                const serviceTypeId = Number(sel.dataset.serviceId);
                if (!chosenByEmployee.has(empId)) chosenByEmployee.set(empId, []);
                chosenByEmployee.get(empId).push(serviceTypeId);
            }
            for (const [, serviceTypeIds] of chosenByEmployee) {
                if (serviceTypeIds.length <= 1) continue;
                const allCombinable = serviceTypeIds.every((id) => serviceTypeById.get(id)?.combinable === true);
                if (!allCombinable) {
                    FDPUI.showToast('Ein Mitarbeiter kann an einem Tag nicht zwei nicht-kombinierbare Funktionen übernehmen.', 'error');
                    return;
                }
            }

            for (const sel of selects) {
                const serviceTypeId = Number(sel.dataset.serviceId);
                const existing = dayAssignments.find(a => a.serviceTypeId === serviceTypeId);
                const val = sel.value;

                if (!val && existing) {
                    await FDP.db.remove('assignments', existing.id);
                } else if (val) {
                    const record = { date: dateStr, serviceTypeId, employeeId: Number(val) };
                    if (existing) record.id = existing.id;
                    await FDP.db.put('assignments', record);
                }
            }
            FDPUI.showToast('Diensteinteilung gespeichert', 'success');
            FDPUI.closeModal();
            FDPUI.refreshCurrentView();
        });
    }

    function getState() {
        return state;
    }

    return { render, getState, dayStatus };
})();
