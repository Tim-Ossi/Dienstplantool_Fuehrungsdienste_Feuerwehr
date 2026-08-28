/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/statistics.js
 * Version:    1.3.0
 * Build:      9
 * Datum:      2026-07-11
 *
 * Beschreibung:
 * Berechnet für jeden Mitarbeiter Kennzahlen (Dienste je Dienstart,
 * Wochenenden, Feiertage, Urlaub, Fortbildung, Krankheit, Belastung,
 * Soll/Ist-Vergleich) und stellt diese tabellarisch sowie als einfache
 * SVG-Balkendiagramme dar. Es werden bewusst keine externen
 * Chart-Bibliotheken verwendet, damit die Anwendung ohne Internetzugriff
 * vollständig funktionsfähig bleibt.
 */

'use strict';

const FDPStatistics = (() => {

    // Sortierzustand der Belastungsübersicht (bleibt für die Dauer der Sitzung erhalten)
    let sortState = { key: 'totalServices', dir: 'desc' };

    async function render(container) {
        const year = Number(await FDP.db.getSetting('year', new Date().getFullYear()));
        const bundesland = await FDP.db.getSetting('bundesland', 'NW');
        const [employees, serviceTypes, assignments, absences] = await Promise.all([
            FDP.db.getAll('employees'),
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('assignments'),
            FDP.db.getAll('absences')
        ]);
        const activeServiceTypes = serviceTypes.filter(s => s.active !== false).sort((a, b) => a.sortOrder - b.sortOrder);
        const operationalServiceTypes = activeServiceTypes.filter(s => s.countsInStatistics !== false);
        const leadershipServiceTypes = activeServiceTypes.filter(s => s.countsInStatistics === false);
        const holidays = FDPHolidays.getHolidays(year, bundesland);
        const yearAssignments = assignments.filter(a => a.date.startsWith(String(year)));

        const stats = employees.map((emp) => computeEmployeeStats(emp, activeServiceTypes, yearAssignments, absences, holidays, year));
        stats.sort((a, b) => b.totalServices - a.totalServices);

        const totalServices = stats.reduce((s, x) => s + x.totalServices, 0);

        // Für den Soll/Ist-Vergleich werden als "Leiter der Feuerwehr / bevorzugte
        // Führungsfunktion" markierte Mitarbeiter ausgenommen: Sie sind bewusst
        // hauptsächlich für LdF/FBL vorgesehen, ein geringer Einsatzdienstanteil ist
        // bei ihnen gewollt und soll weder als Abweichung markiert noch den
        // Vergleichswert für die übrigen Mitarbeiter verfälschen.
        const regularStats = stats.filter(s => !s.employee.preferredLeadership);
        const regularTotal = regularStats.reduce((s, x) => s + x.totalServices, 0);
        const regularAvg = regularStats.length ? (regularTotal / regularStats.length).toFixed(1) : '0';

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Statistik</h1>
                    <p class="view-subtitle">Auswertung für das Jahr ${year}</p>
                </div>
            </div>

            <div class="stat-summary-grid">
                <div class="stat-card">
                    <div class="stat-card-value">${totalServices}</div>
                    <div class="stat-card-label">Einsatzdienste gesamt</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${regularAvg}</div>
                    <div class="stat-card-label">Ø Einsatzdienste je Mitarbeiter (ohne Leitung)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${employees.filter(e => e.active).length}</div>
                    <div class="stat-card-label">Aktive Mitarbeiter</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${Object.keys(holidays).length}</div>
                    <div class="stat-card-label">Feiertage im Jahr</div>
                </div>
            </div>

            <div class="card">
                <h2>Einsatzdienste je Mitarbeiter</h2>
                <p class="text-muted">${leadershipServiceTypes.length > 0 ? `Führungsfunktionen (${leadershipServiceTypes.map(s => s.name).join(', ')}) sind hier nicht enthalten.` : ''}</p>
                <div id="chartServices"></div>
            </div>

            <div class="card">
                <h2>Belastungsübersicht</h2>
                <p class="text-muted">Spaltenüberschrift anklicken, um zu sortieren.</p>
                <div id="belastungTableWrap"></div>
                ${leadershipServiceTypes.length > 0 ? `<p class="text-muted" style="margin-top:10px;">* ${leadershipServiceTypes.map(s => s.name).join(' / ')} fließen nicht in die Einsatzdienst-Statistik (Gesamt, Soll/Ist, Wochenenden/Feiertage, Diagramm) ein. Als „Leitung" markierte Mitarbeiter sind bewusst hauptsächlich für Führungsfunktionen vorgesehen und werden beim Soll/Ist-Vergleich der übrigen Mitarbeiter (Ø ${regularAvg}) nicht mitgerechnet.</p>` : ''}
            </div>
        `;

        renderBarChart(container.querySelector('#chartServices'), stats);
        renderBelastungTable(container.querySelector('#belastungTableWrap'), stats, operationalServiceTypes, leadershipServiceTypes, regularAvg);
    }

    /**
     * Definiert die sortierbaren Spalten der Belastungsübersicht inkl. Wertzugriff.
     */
    function buildColumns(operationalServiceTypes, leadershipServiceTypes, regularAvg) {
        const columns = [
            { key: 'name', label: 'Mitarbeiter', numeric: false, get: (s) => s.employee.name }
        ];
        operationalServiceTypes.forEach((st) => {
            columns.push({ key: `st_${st.id}`, label: st.name, numeric: true, get: (s) => s.byServiceType[st.id] || 0 });
        });
        leadershipServiceTypes.forEach((st) => {
            columns.push({ key: `st_${st.id}`, label: `${st.name} *`, numeric: true, get: (s) => s.byServiceType[st.id] || 0, leadership: true });
        });
        columns.push(
            { key: 'weekends', label: 'Wochenenden', numeric: true, get: (s) => s.weekends },
            { key: 'holidays', label: 'Feiertage', numeric: true, get: (s) => s.holidays },
            { key: 'vacationDays', label: 'Urlaub', numeric: true, get: (s) => s.vacationDays },
            { key: 'trainingDays', label: 'Fortbildung', numeric: true, get: (s) => s.trainingDays },
            { key: 'sickDays', label: 'Krankheit', numeric: true, get: (s) => s.sickDays },
            { key: 'totalServices', label: 'Gesamt Einsatzdienste', numeric: true, get: (s) => s.totalServices },
            { key: 'sollist', label: 'Soll/Ist', numeric: true, get: (s) => s.employee.preferredLeadership ? -9999 : (s.totalServices - Number(regularAvg)) },
            { key: 'totalAll', label: 'Gesamt (inkl. Führung)', numeric: true, get: (s) => s.totalServices + leadershipServiceTypes.reduce((sum, st) => sum + (s.byServiceType[st.id] || 0), 0) }
        );
        return columns;
    }

    function renderBelastungTable(wrapEl, stats, operationalServiceTypes, leadershipServiceTypes, regularAvg) {
        const columns = buildColumns(operationalServiceTypes, leadershipServiceTypes, regularAvg);
        const activeColumn = columns.find(c => c.key === sortState.key) || columns[columns.length - 2];

        const sorted = [...stats].sort((a, b) => {
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
                                <th class="sortable" data-sort-key="${c.key}" title="${c.leadership ? 'Nicht Teil der Einsatzdienst-Statistik' : ''}">
                                    ${FDPUI.escapeHtml(c.label)}${sortState.key === c.key ? `<span class="sort-indicator">${sortState.dir === 'asc' ? '▲' : '▼'}</span>` : ''}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((s) => `
                            <tr>
                                <td class="cell-strong">${FDPUI.escapeHtml(s.employee.name)}${s.employee.preferredLeadership ? ' <span class="badge badge-warning" title="Leiter der Feuerwehr / bevorzugt Führungsfunktion">Leitung</span>' : ''}</td>
                                ${operationalServiceTypes.map(st => `<td>${s.byServiceType[st.id] || 0}</td>`).join('')}
                                ${leadershipServiceTypes.map(st => `<td>${s.byServiceType[st.id] || 0}</td>`).join('')}
                                <td>${s.weekends}</td>
                                <td>${s.holidays}</td>
                                <td>${s.vacationDays}</td>
                                <td>${s.trainingDays}</td>
                                <td>${s.sickDays}</td>
                                <td class="cell-strong">${s.totalServices}</td>
                                <td>${s.employee.preferredLeadership ? '<span class="badge badge-neutral">Führungsfunktion</span>' : renderSollIst(s.totalServices, regularAvg)}</td>
                                <td class="cell-strong">${s.totalServices + leadershipServiceTypes.reduce((sum, st) => sum + (s.byServiceType[st.id] || 0), 0)}</td>
                            </tr>
                        `).join('')}
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
                    sortState = { key, dir: key === 'name' ? 'asc' : 'desc' };
                }
                renderBelastungTable(wrapEl, stats, operationalServiceTypes, leadershipServiceTypes, regularAvg);
            });
        });
    }

    function renderSollIst(actual, avg) {
        const diff = actual - Number(avg);
        if (Math.abs(diff) < 0.5) return '<span class="badge badge-success">ausgeglichen</span>';
        if (diff > 0) return `<span class="badge badge-warning">+${diff.toFixed(1)}</span>`;
        return `<span class="badge badge-info">${diff.toFixed(1)}</span>`;
    }

    function computeEmployeeStats(emp, activeServiceTypes, yearAssignments, absences, holidays, year) {
        const serviceTypeById = new Map(activeServiceTypes.map(s => [s.id, s]));
        const empAssignments = yearAssignments.filter(a => a.employeeId === emp.id);
        const byServiceType = {};
        let weekends = 0;
        let holidayCount = 0;
        let totalServices = 0;

        empAssignments.forEach((a) => {
            byServiceType[a.serviceTypeId] = (byServiceType[a.serviceTypeId] || 0) + 1;
            const st = serviceTypeById.get(a.serviceTypeId);
            const countsInStatistics = !st || st.countsInStatistics !== false;
            if (!countsInStatistics) return; // Führungsfunktionen (z.B. LdF/FBL) nicht in Einsatzdienststatistik werten
            totalServices++;
            const d = FDPUI.parseISO(a.date);
            if (FDPUI.isWeekend(d)) weekends++;
            if (FDPHolidays.isHoliday(a.date, holidays)) holidayCount++;
        });

        const empAbsences = absences.filter(a => a.employeeId === emp.id && a.dateFrom.startsWith(String(year)));
        const vacationDays = sumDays(empAbsences.filter(a => a.type === 'urlaub'));
        const trainingDays = sumDays(empAbsences.filter(a => a.type === 'fortbildung'));
        const sickDays = sumDays(empAbsences.filter(a => a.type === 'krank'));

        return {
            employee: emp,
            byServiceType,
            weekends,
            holidays: holidayCount,
            vacationDays,
            trainingDays,
            sickDays,
            totalServices
        };
    }

    function sumDays(list) {
        return list.reduce((sum, a) => sum + FDPVacation.countDays(a.dateFrom, a.dateTo), 0);
    }

    /**
     * Rendert ein einfaches horizontales SVG-Balkendiagramm ohne externe Abhängigkeiten.
     */
    function renderBarChart(target, stats) {
        if (stats.length === 0) {
            target.innerHTML = '<div class="empty-state"><p>Keine Daten für das gewählte Jahr vorhanden.</p></div>';
            return;
        }
        const max = Math.max(1, ...stats.map(s => s.totalServices));
        const barHeight = 26;
        const gap = 10;
        const chartHeight = stats.length * (barHeight + gap);
        const width = 720;
        const labelWidth = 160;
        const barAreaWidth = width - labelWidth - 60;

        const bars = stats.map((s, i) => {
            const y = i * (barHeight + gap);
            const barLen = (s.totalServices / max) * barAreaWidth;
            return `
                <text x="${labelWidth - 10}" y="${y + barHeight / 2 + 4}" text-anchor="end" class="chart-label">${FDPUI.escapeHtml(s.employee.name)}</text>
                <rect x="${labelWidth}" y="${y}" width="${Math.max(barLen, 2)}" height="${barHeight}" rx="4" class="chart-bar"></rect>
                <text x="${labelWidth + barLen + 8}" y="${y + barHeight / 2 + 4}" class="chart-value">${s.totalServices}</text>
            `;
        }).join('');

        target.innerHTML = `
            <svg viewBox="0 0 ${width} ${chartHeight + 10}" class="stat-chart" xmlns="http://www.w3.org/2000/svg">
                ${bars}
            </svg>
        `;
    }

    return { render, computeEmployeeStats };
})();
