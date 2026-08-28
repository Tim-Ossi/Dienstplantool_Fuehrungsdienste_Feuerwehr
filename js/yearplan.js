/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/yearplan.js
 * Version:    1.1.0
 * Build:      18
 * Datum:      2026-07-16
 *
 * Beschreibung:
 * Erzeugt für einen einzelnen Mitarbeiter einen druckbaren Jahresdienstplan
 * (DIN A4 Querformat): Monate als Zeilen, Kalendertage 1 bis 31 als Spalten.
 * Für jeden Tag wird die zugewiesene Dienstart bzw. Abwesenheit eingetragen.
 * Wochenenden/Feiertage erhalten die im Kalender bereits verwendete
 * hellgraue Hervorhebung; Tage, an denen der Mitarbeiter planerisch der
 * einzige anwesende Mitarbeiter seiner Abteilung ist (siehe presence.js),
 * werden gelb hervorgehoben.
 *
 * Der Druck läuft über einen eigenen, normalerweise unsichtbaren Bereich
 * (".year-plan-print-area"), der nur während des Druckvorgangs eingeblendet
 * wird (siehe css/style.css) - die übrige Anwendung wird dabei ausgeblendet,
 * ähnlich wie beim Kalender-Monatsdruck, jedoch als eigenständiger
 * Druckmodus, damit sich beide Funktionen nicht gegenseitig stören.
 */

'use strict';

const FDPYearPlan = (() => {

    const ABSENCE_ABBREV = { urlaub: 'U', krank: 'K', fortbildung: 'F', wunschfrei: 'W' };
    const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    /**
     * Baut den Jahresdienstplan für einen Mitarbeiter auf, fügt ihn in einen
     * dediziert dafür vorgesehenen Druckbereich ein und öffnet den
     * Browser-Druckdialog.
     */
    async function printYearPlanForEmployee(employee) {
        const year = Number(await FDP.db.getSetting('year', new Date().getFullYear()));
        const bundesland = await FDP.db.getSetting('bundesland', 'NW');
        const feuerwehrname = await FDP.db.getSetting('feuerwehrname', 'Freiwillige Feuerwehr');

        const [serviceTypes, employees, departments, allAssignments, allAbsences] = await Promise.all([
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('employees'),
            FDP.db.getAll('departments'),
            FDP.db.getAll('assignments'),
            FDP.db.getAll('absences')
        ]);
        const serviceTypeById = new Map(serviceTypes.map(s => [s.id, s]));
        const holidays = FDPHolidays.getHolidays(year, bundesland);

        const yearPrefix = String(year);
        const ownAssignments = allAssignments.filter(a => a.employeeId === employee.id && a.date.startsWith(yearPrefix));
        const assignmentByDate = new Map(ownAssignments.map(a => [a.date, a]));

        const ownAbsences = allAbsences.filter(a => a.employeeId === employee.id);
        const absenceByDate = new Map();
        ownAbsences.forEach((a) => {
            let d = FDPUI.parseISO(a.dateFrom);
            const end = FDPUI.parseISO(a.dateTo);
            while (d <= end) {
                const key = FDPUI.formatDateISO(d);
                if (key.startsWith(yearPrefix)) absenceByDate.set(key, a.type);
                d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
            }
        });

        const daysInMonth = (m) => new Date(year, m + 1, 0).getDate();
        const maxDays = 31;

        let bodyRows = '';
        for (let m = 0; m < 12; m++) {
            const monthDays = daysInMonth(m);
            let cells = '';
            for (let d = 1; d <= maxDays; d++) {
                if (d > monthDays) {
                    cells += '<td class="yp-na"></td>';
                    continue;
                }
                const date = new Date(year, m, d);
                const dateStr = FDPUI.formatDateISO(date);
                const isWeekend = FDPUI.isWeekend(date);
                const isHoliday = FDPHolidays.isHoliday(dateStr, holidays);

                const assignment = assignmentByDate.get(dateStr);
                const absenceType = absenceByDate.get(dateStr);
                let label = '';
                let colorStyle = '';
                if (assignment) {
                    const st = serviceTypeById.get(assignment.serviceTypeId);
                    if (st) {
                        label = st.shortCode || st.name;
                        colorStyle = ` style="color:${st.color}; border-left: 2.5px solid ${st.color};"`;
                    }
                } else if (absenceType) {
                    label = ABSENCE_ABBREV[absenceType] || '';
                }
                const waShort = FDPWachabteilung.getWachabteilungShort(dateStr);

                const sole = FDPPresence.isSolePresentEmployee(employee, dateStr, employees, departments, allAssignments, allAbsences, holidays);
                let cls = '';
                if (sole) cls = 'yp-sole';
                else if (isWeekend || isHoliday) cls = 'yp-weekend';

                cells += `<td class="${cls}"${colorStyle} title="${FDPUI.escapeHtml(FDPUI.formatDateDisplay(dateStr))} – Wachabteilung ${FDPUI.escapeHtml(waShort)}">${FDPUI.escapeHtml(label)}<span class="yp-wa">${FDPUI.escapeHtml(waShort)}</span></td>`;
            }
            bodyRows += `<tr><th class="yp-month-label">${MONTH_NAMES_SHORT[m]}</th>${cells}</tr>`;
        }

        const dayHeaderCells = Array.from({ length: maxDays }, (_, i) => `<th>${i + 1}</th>`).join('');

        const legendItems = serviceTypes.filter(s => s.active !== false)
            .map(s => `<span class="yp-legend-item"><span class="yp-legend-dot" style="background:${s.color}"></span>${FDPUI.escapeHtml(s.shortCode || s.name)} = ${FDPUI.escapeHtml(s.name)}</span>`)
            .join('');
        const absenceLegend = Object.entries(ABSENCE_ABBREV)
            .map(([type, abbrev]) => `<span class="yp-legend-item">${abbrev} = ${FDPVacation.TYPE_LABELS[type]}</span>`)
            .join('');

        const container = document.getElementById('yearPlanPrintArea');
        container.innerHTML = `
            <div class="yp-header">
                <h1>${FDPUI.escapeHtml(feuerwehrname)}</h1>
                <p>Jahresdienstplan ${year} – ${FDPUI.escapeHtml(employee.name)}${employee.shortCode ? ` (${FDPUI.escapeHtml(employee.shortCode)})` : ''}</p>
            </div>
            <div class="yp-table-wrap">
                <table class="yp-table">
                    <thead><tr><th class="yp-month-label">Monat</th>${dayHeaderCells}</tr></thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>
            <div class="yp-legend">
                ${legendItems}
                ${absenceLegend}
                <span class="yp-legend-item"><span class="yp-legend-dot yp-legend-dot-weekend"></span>Wochenende / Feiertag</span>
                <span class="yp-legend-item"><span class="yp-legend-dot yp-legend-dot-sole"></span>Einzige anwesende Person der Abteilung</span>
                <span class="yp-legend-item">Kleine Ziffer/Zahl je Tag = Wachabteilung im 24h-Tagesdienst (I-IV)</span>
            </div>
        `;

        document.body.classList.add('printing-year-plan');
        const cleanup = () => {
            document.body.classList.remove('printing-year-plan');
            container.innerHTML = '';
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        setTimeout(() => window.print(), 50);
    }

    return { printYearPlanForEmployee };
})();
