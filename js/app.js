/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/app.js
 * Version:    1.19.0
 * Build:      23
 * Datum:      2026-07-11
 *
 * Beschreibung:
 * Einstiegspunkt der Anwendung. Initialisiert die Datenbank, legt beim
 * ersten Start sinnvolle Standard-Dienstarten an (konfigurierbar, keine
 * Festcodierung im weiteren Programmverlauf), registriert alle Ansichten
 * und rendert das Dashboard.
 */

'use strict';

const FDPApp = (() => {

    const VERSION = '1.19.0';
    const BUILD = '23';

    async function init() {
        await FDP.db.open();
        await seedDefaultsIfEmpty();

        FDPUI.registerView('dashboard', renderDashboard);
        FDPUI.registerView('calendar', (el) => FDPCalendar.render(el));
        FDPUI.registerView('employees', (el) => FDPEmployees.render(el));
        FDPUI.registerView('vacation', (el) => FDPVacation.render(el));
        FDPUI.registerView('planner', (el) => FDPPlanner.render(el));
        FDPUI.registerView('statistics', (el) => FDPStatistics.render(el));
        FDPUI.registerView('settings', (el) => FDPSettings.render(el));

        const colorTheme = await FDP.db.getSetting('colorTheme', 'blue');
        applyColorTheme(colorTheme);

        await refreshHeaderInfo();
        FDPUI.renderNav();
        FDPUI.navigateTo('dashboard');

        FDPEvents.on('change', () => {
            if (FDPUI.getCurrentView() === 'dashboard') FDPUI.refreshCurrentView();
            refreshHeaderInfo();
        });

        document.getElementById('appLoader').classList.add('hidden');
    }

    /**
     * Legt beim allerersten Start Standard-Dienstarten und Grundeinstellungen an.
     * Dies ist die einzige Stelle mit "Startdaten" - danach erfolgt jede Änderung
     * ausschließlich über die Benutzeroberfläche (Einstellungen).
     */
    async function seedDefaultsIfEmpty() {
        const existing = await FDP.db.getAll('serviceTypes');
        if (existing.length === 0) {
            await FDP.db.bulkPut('serviceTypes', [
                { name: 'B-Dienst', shortCode: 'B', color: '#2f6fed', active: true, sortOrder: 1, countsInStatistics: true, combinable: false },
                { name: 'C-Dienst', shortCode: 'C', color: '#e8833a', active: true, sortOrder: 2, countsInStatistics: true, combinable: false },
                { name: 'Verfüger', shortCode: 'V', color: '#3aa76d', active: true, sortOrder: 3, countsInStatistics: true, combinable: false },
                { name: 'LdF', shortCode: 'LdF', color: '#8a5cf6', active: true, sortOrder: 4, countsInStatistics: false, combinable: true, requiredQualifications: ['LdF'] },
                { name: 'FBL', shortCode: 'FBL', color: '#c65cf6', active: true, sortOrder: 5, countsInStatistics: false, combinable: true, requiredQualifications: ['FBL'] }
            ]);
        } else {
            await ensureLeadershipServiceTypes(existing);
        }
        const year = await FDP.db.getSetting('year', null);
        if (year === null) await FDP.db.setSetting('year', new Date().getFullYear());
        const feuerwehrname = await FDP.db.getSetting('feuerwehrname', null);
        if (feuerwehrname === null) await FDP.db.setSetting('feuerwehrname', 'Freiwillige Feuerwehr');
        const bundesland = await FDP.db.getSetting('bundesland', null);
        if (bundesland === null) await FDP.db.setSetting('bundesland', 'NW');
        const maxAbsence = await FDP.db.getSetting('maxSimultaneousAbsence', null);
        if (maxAbsence === null) await FDP.db.setSetting('maxSimultaneousAbsence', 2);
        const colorTheme = await FDP.db.getSetting('colorTheme', null);
        if (colorTheme === null) await FDP.db.setSetting('colorTheme', 'blue');

        await seedDepartmentsIfEmpty();
        await seedQualificationsIfEmpty();
        await migrateFreeTextQualificationsIntoCatalog();
    }

    /**
     * Legt beim ersten Start die Abteilungsstruktur an (aus dem Organigramm der
     * Feuerwehr). Vollständig über "Einstellungen → Abteilungen" editierbar,
     * erweiterbar und löschbar - dies ist nur der Startbestand.
     */
    async function seedDepartmentsIfEmpty() {
        const existing = await FDP.db.getAll('departments');
        if (existing.length > 0) {
            await migratePresenceRulesIntoDepartments(existing);
            return;
        }
        const departments = [
            { code: '5.0', name: 'Fachbereichsleitung / Leitung der Feuerwehr', parentCode: null },
            { code: '5.1', name: 'Fachdienst 5.1 – Abwehrende Maßnahmen', parentCode: '5.0' },
            { code: '5.11', name: 'Fachgruppe 5.11 – Dienstplanung', parentCode: '5.1', minPresence: 1 },
            { code: '5.111', name: 'SB 5.111', parentCode: '5.11' },
            { code: '5.112', name: 'SB 5.112', parentCode: '5.11' },
            { code: '5.12', name: 'Fachgruppe 5.12 – Wachabteilungen (Leitung: WV 1 / WV 2)', parentCode: '5.1', minPresence: 1 },
            { code: '5.13', name: 'Fachgruppe 5.13 – Aus- und Fortbildung', parentCode: '5.1', minPresence: 1 },
            { code: '5.131', name: 'SB 5.131', parentCode: '5.13' },
            { code: '5.132', name: 'SB 5.132', parentCode: '5.13' },
            { code: '5.14', name: 'Fachgruppe 5.14 – Rettungsdienst', parentCode: '5.1', minPresence: 1 },
            { code: '5.141', name: 'SB 5.141', parentCode: '5.14' },
            { code: '5.2', name: 'Fachdienst 5.2 – Vorbeugende Maßnahmen', parentCode: '5.0' },
            { code: '5.21', name: 'Fachgruppe 5.21', parentCode: '5.2', minPresence: 1 },
            { code: '5.211', name: 'SB 5.211', parentCode: '5.21' },
            { code: '5.212', name: 'SB 5.212', parentCode: '5.21' },
            { code: '5.213', name: 'SB 5.213', parentCode: '5.21' },
            { code: '5.214', name: 'SB 5.214', parentCode: '5.21' },
            { code: '5.215', name: 'SB 5.215', parentCode: '5.21' },
            { code: '5.22', name: 'Fachgruppe 5.22', parentCode: '5.2', minPresence: 1 },
            { code: '5.221', name: 'SB 5.221', parentCode: '5.22' },
            { code: '5.222', name: 'SB 5.222', parentCode: '5.22' },
            { code: '5.223', name: 'SB 5.223', parentCode: '5.22' },
            { code: '5.224', name: 'SB 5.224', parentCode: '5.22' },
            { code: '5.225', name: 'SB 5.225', parentCode: '5.22' },
            { code: '5.226', name: 'SB 5.226', parentCode: '5.22' },
            { code: '5.23', name: 'Fachgruppe 5.23', parentCode: '5.2', minPresence: 1 },
            { code: '5.231', name: 'SB 5.231', parentCode: '5.23' },
            { code: '5.3', name: 'Fachgruppe 5.3 – Freiwillige Feuerwehr', parentCode: '5.0', minPresence: 1, presenceSoft: true },
            { code: '5.31', name: 'SB 5.31', parentCode: '5.3' },
            { code: '5.4', name: 'Fachgruppe 5.4 – Verwaltung', parentCode: '5.0', minPresence: 1 },
            { code: '5.41', name: 'SB 5.41', parentCode: '5.4' },
            { code: '5.42', name: 'SB 5.42', parentCode: '5.4' },
            { code: '5.43', name: 'SB 5.43', parentCode: '5.4' },
            { code: '5.44', name: 'SB 5.44', parentCode: '5.4' }
        ];
        await FDP.db.bulkPut('departments', departments);
    }

    /**
     * Migration für bereits bestehende Installationen: korrigiert die
     * Anwesenheits-Mindestbesetzung auf Basis des überarbeiteten,
     * eindeutigeren Organigramms (Fachdienst 5.1/5.2 als Rückfallebene ohne
     * eigene Regel, Fachgruppen darunter mit minPresence, 5.3 als weiche
     * Ausnahme) und entfernt die fälschlich als eigene Abteilungen angelegten
     * Codes 5.121/5.122 ("WV 1"/"WV 2") - das sind tatsächlich zwei
     * gleichberechtigte FGL-Positionen (Personen) direkt in Fachgruppe 5.12,
     * keine eigenen Unterabteilungen. Mitarbeiter, die zuvor dort zugeordnet
     * waren, werden automatisch direkt auf Fachgruppe 5.12 umgehängt. Diese
     * Migration überschreibt die zuvor (fehlerhaft) automatisch gesetzten
     * Werte auf den Standard-Codes gezielt neu - individuelle Anpassungen an
     * anderen, selbst angelegten Abteilungen bleiben unangetastet.
     */
    async function migratePresenceRulesIntoDepartments(existing) {
        const byCode = new Map(existing.map(d => [d.code, d]));
        const patches = [];

        const groupLevel = ['5.11', '5.12', '5.13', '5.14', '5.21', '5.22', '5.23', '5.4'];
        const dienstLevel = ['5.1', '5.2'];

        groupLevel.forEach((code) => {
            const dept = byCode.get(code);
            if (dept) patches.push({ ...dept, minPresence: 1, presenceMustBeUnassigned: false, presenceSoft: false });
        });
        dienstLevel.forEach((code) => {
            const dept = byCode.get(code);
            if (dept) patches.push({ ...dept, minPresence: 0, presenceMustBeUnassigned: false, presenceSoft: false });
        });
        const d53 = byCode.get('5.3');
        if (d53) patches.push({ ...d53, minPresence: 1, presenceMustBeUnassigned: false, presenceSoft: true });

        if (patches.length > 0) {
            await FDP.db.bulkPut('departments', patches);
        }

        // Fälschlich angelegte Abteilungen 5.121/5.122 entfernen (WV 1/WV 2
        // sind Personen mit gleichberechtigter FGL-Position in Fachgruppe
        // 5.12, keine eigenen Unterabteilungen).
        const wrongCodes = ['5.121', '5.122'];
        const toRemove = wrongCodes.filter(code => byCode.has(code));
        if (toRemove.length > 0) {
            const employees = await FDP.db.getAll('employees');
            const affected = employees.filter(e => wrongCodes.includes(e.departmentCode));
            for (const emp of affected) {
                await FDP.db.put('employees', { ...emp, departmentCode: '5.12' });
            }
            for (const code of toRemove) {
                await FDP.db.remove('departments', byCode.get(code).id);
            }
        }
    }

    /**
     * Legt beim ersten Start einen Grundstock an Qualifikationen an (passend zu
     * den vordefinierten Dienstarten LdF/FBL). Vollständig über
     * "Einstellungen → Qualifikationen" erweiterbar.
     */
    async function seedQualificationsIfEmpty() {
        const existing = await FDP.db.getAll('qualifications');
        if (existing.length > 0) {
            await migrateQualificationAbsenceLimits(existing);
            return;
        }
        await FDP.db.bulkPut('qualifications', [
            { name: 'LdF', maxSimultaneousAbsence: 1 },
            { name: 'FBL', maxSimultaneousAbsence: 1 }
        ]);
    }

    /**
     * Migration für bereits bestehende Installationen: ergänzt bei den
     * Qualifikationen LdF/FBL eine sinnvolle Standard-Obergrenze für
     * gleichzeitigen Urlaub (kleiner Führungspool), sofern dort noch keine
     * eigene Obergrenze gepflegt wurde.
     */
    async function migrateQualificationAbsenceLimits(existing) {
        const patches = existing
            .filter(q => (q.name === 'LdF' || q.name === 'FBL') && q.maxSimultaneousAbsence === undefined)
            .map(q => ({ ...q, maxSimultaneousAbsence: 1 }));
        if (patches.length > 0) {
            await FDP.db.bulkPut('qualifications', patches);
        }
    }

    /**
     * Migration: Qualifikationen, die bereits als Freitext bei Mitarbeitern oder
     * Dienstarten hinterlegt sind (aus früheren Versionen), werden automatisch
     * in den neuen Qualifikationskatalog übernommen, damit keine Daten verloren
     * gehen und die Auswahl weiterhin vollständig ist.
     */
    async function migrateFreeTextQualificationsIntoCatalog() {
        const [employees, serviceTypes, qualifications] = await Promise.all([
            FDP.db.getAll('employees'),
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('qualifications')
        ]);
        const known = new Set(qualifications.map(q => q.name.toLowerCase()));
        const missing = new Set();
        employees.forEach(e => (e.qualifications || []).forEach(q => {
            if (q && !known.has(q.toLowerCase())) missing.add(q);
        }));
        serviceTypes.forEach(s => (s.requiredQualifications || []).forEach(q => {
            if (q && !known.has(q.toLowerCase())) missing.add(q);
        }));
        if (missing.size > 0) {
            await FDP.db.bulkPut('qualifications', [...missing].map(name => ({ name })));
        }
    }

    /**
     * Migration für bereits bestehende Installationen: ergänzt die Führungsfunktionen
     * LdF und FBL, falls sie noch nicht angelegt sind (z. B. nach einem Update der
     * Anwendung). Bestehende Daten bleiben dabei unangetastet.
     */
    async function ensureLeadershipServiceTypes(existing) {
        const hasShortCode = (code) => existing.some(s => (s.shortCode || '').toLowerCase() === code.toLowerCase());
        const maxSort = Math.max(0, ...existing.map(s => s.sortOrder || 0));
        const toAdd = [];
        if (!hasShortCode('LdF')) {
            toAdd.push({ name: 'LdF', shortCode: 'LdF', color: '#8a5cf6', active: true, sortOrder: maxSort + 1, countsInStatistics: false, combinable: true, requiredQualifications: ['LdF'] });
        }
        if (!hasShortCode('FBL')) {
            toAdd.push({ name: 'FBL', shortCode: 'FBL', color: '#c65cf6', active: true, sortOrder: maxSort + 2, countsInStatistics: false, combinable: true, requiredQualifications: ['FBL'] });
        }
        if (toAdd.length > 0) {
            await FDP.db.bulkPut('serviceTypes', toAdd);
        }

        // Bereits vorhandene LdF/FBL-Einträge aus einer älteren Version ohne
        // hinterlegte Qualifikationsanforderung ergänzen (nicht überschreiben,
        // falls der Anwender bereits eigene Anforderungen gepflegt hat).
        const patches = existing.filter((s) => {
            const code = (s.shortCode || '').toLowerCase();
            return (code === 'ldf' || code === 'fbl') && s.requiredQualifications === undefined;
        });
        if (patches.length > 0) {
            const patched = patches.map((s) => ({ ...s, requiredQualifications: [s.shortCode] }));
            await FDP.db.bulkPut('serviceTypes', patched);
        }
    }

    function applyColorTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    async function refreshHeaderInfo() {
        const feuerwehrname = await FDP.db.getSetting('feuerwehrname', 'Freiwillige Feuerwehr');
        const year = await FDP.db.getSetting('year', new Date().getFullYear());
        document.getElementById('orgName').textContent = feuerwehrname;
        document.getElementById('orgYear').textContent = `Planungsjahr ${year}`;
        document.getElementById('appVersion').textContent = `Version ${VERSION} · Build ${BUILD}`;
    }

    // Ausgewähltes Datum für die Abteilungs-Anwesenheit-Detailansicht im
    // Dashboard (bleibt für die Dauer der Sitzung erhalten, Standard: heute)
    let deptDetailDate = null;

    async function renderDashboard(container) {
        const year = Number(await FDP.db.getSetting('year', new Date().getFullYear()));
        const bundesland = await FDP.db.getSetting('bundesland', 'NW');
        const [employees, serviceTypes, assignments, absences, departments] = await Promise.all([
            FDP.db.getAll('employees'),
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('assignments'),
            FDP.db.getAll('absences'),
            FDP.db.getAll('departments')
        ]);
        const activeEmployees = employees.filter(e => e.active);
        const activeServiceTypes = serviceTypes.filter(s => s.active !== false);
        const holidays = FDPHolidays.getHolidays(year, bundesland);

        const todayStr = FDPUI.formatDateISO(new Date());
        const todayAbsences = absences.filter(a => a.dateFrom <= todayStr && todayStr <= a.dateTo);
        const todayAssignments = assignments.filter(a => a.date === todayStr);

        // Konflikte / Warnungen der nächsten 14 Tage ermitteln
        const warnings = [];
        const presenceWarnings = [];
        let cursor = new Date();
        for (let i = 0; i < 14; i++) {
            const dateStr = FDPUI.formatDateISO(cursor);
            const status = FDPCalendar.dayStatus(dateStr, activeServiceTypes, assignments, absences);
            if (status.ampel === 'red') {
                warnings.push({ date: dateStr, reason: status.conflict ? 'Konflikt in der Besetzung' : 'Keine Besetzung' });
            }
            const dayPresenceViolations = FDPPresence.computeViolationsForDate(dateStr, employees, departments, assignments, absences, holidays);
            dayPresenceViolations.forEach((v) => presenceWarnings.push({ date: dateStr, ...v }));
            cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }

        const yearAssignments = assignments.filter(a => a.date.startsWith(String(year)));
        const totalDaysInYear = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
        const totalSlotsNeeded = totalDaysInYear * activeServiceTypes.length;
        const coveragePercent = totalSlotsNeeded > 0 ? Math.round((yearAssignments.length / totalSlotsNeeded) * 100) : 0;

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Dashboard</h1>
                    <p class="view-subtitle">Überblick über Führungsdienst, Besetzung und Abwesenheiten</p>
                </div>
            </div>

            <div class="stat-summary-grid">
                <div class="stat-card stat-card-accent">
                    <div class="stat-card-value">${activeEmployees.length}</div>
                    <div class="stat-card-label">Aktive Mitarbeiter</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${todayAssignments.length} / ${activeServiceTypes.length}</div>
                    <div class="stat-card-label">Heute besetzt</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${todayAbsences.length}</div>
                    <div class="stat-card-label">Heute abwesend</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${coveragePercent}%</div>
                    <div class="stat-card-label">Jahresbesetzung ${year}</div>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="card">
                    <h2>Warnungen (nächste 14 Tage)</h2>
                    ${warnings.length === 0
                        ? '<div class="empty-state-inline">Keine Konflikte erkannt.</div>'
                        : `<ul class="warning-inline-list">
                            ${warnings.map(w => `<li>${FDPUI.icon('warning')} <strong>${FDPUI.formatDateDisplay(w.date)}</strong> – ${w.reason}</li>`).join('')}
                        </ul>`}
                    <div class="button-row">
                        <button class="btn btn-secondary btn-sm" id="dashGotoCalendar">Zum Kalender</button>
                    </div>
                </div>

                <div class="card">
                    <h2>Abteilungs-Anwesenheit (nächste 14 Tage)</h2>
                    ${presenceWarnings.length === 0
                        ? '<div class="empty-state-inline">Alle Mindestbesetzungsregeln erfüllt.</div>'
                        : `<ul class="warning-inline-list">
                            ${presenceWarnings.slice(0, 8).map(w => `<li>${FDPUI.icon('warning')} <strong>${FDPUI.formatDateDisplay(w.date)}</strong> – ${FDPUI.escapeHtml(w.message)}</li>`).join('')}
                            ${presenceWarnings.length > 8 ? `<li class="text-muted">… und ${presenceWarnings.length - 8} weitere</li>` : ''}
                        </ul>`}
                </div>

                <div class="card card-wide">
                    <h2>Abteilungs-Anwesenheit im Detail</h2>
                    <div class="dept-detail-nav">
                        <button class="icon-btn" id="deptDetailPrevBtn" title="Vorheriger Tag">${FDPUI.icon('chevronLeft')}</button>
                        <input type="date" id="deptDetailDateInput" value="${deptDetailDate || todayStr}">
                        <button class="icon-btn" id="deptDetailNextBtn" title="Nächster Tag">${FDPUI.icon('chevronRight')}</button>
                        <button class="btn btn-secondary btn-sm" id="deptDetailTodayBtn">Heute</button>
                    </div>
                    <div id="deptDetailBody"></div>
                </div>

                <div class="card">
                    <h2>Heutige Diensteinteilung</h2>
                    ${activeServiceTypes.length === 0 ? '<div class="empty-state-inline">Keine Dienstarten konfiguriert.</div>' : `
                    <ul class="today-service-list">
                        ${activeServiceTypes.map((s) => {
                            const a = todayAssignments.find(x => x.serviceTypeId === s.id);
                            const emp = a ? employees.find(e => e.id === a.employeeId) : null;
                            return `<li>
                                <span class="service-dot" style="background:${s.color}"></span>
                                <span class="today-service-name">${FDPUI.escapeHtml(s.name)}</span>
                                <span class="today-service-value">${emp ? FDPUI.escapeHtml(emp.name) : 'nicht besetzt'}</span>
                            </li>`;
                        }).join('')}
                    </ul>`}
                </div>

                <div class="card">
                    <h2>Abwesenheiten heute</h2>
                    ${todayAbsences.length === 0 ? '<div class="empty-state-inline">Niemand ist heute abwesend.</div>' : `
                    <ul class="today-service-list">
                        ${todayAbsences.map((a) => {
                            const emp = employees.find(e => e.id === a.employeeId);
                            return `<li>
                                <span class="badge badge-info">${FDPVacation.TYPE_LABELS[a.type]}</span>
                                <span class="today-service-name">${FDPUI.escapeHtml(emp ? emp.name : 'Unbekannt')}</span>
                            </li>`;
                        }).join('')}
                    </ul>`}
                </div>

                <div class="card">
                    <h2>System</h2>
                    <ul class="system-info-list">
                        <li><span>Planungsjahr</span><strong>${year}</strong></li>
                        <li><span>Feiertage im Jahr</span><strong>${Object.keys(holidays).length}</strong></li>
                        <li><span>Mitarbeiter gesamt</span><strong>${employees.length}</strong></li>
                        <li><span>Dienstarten</span><strong>${serviceTypes.length}</strong></li>
                        <li><span>Version</span><strong>${VERSION} (Build ${BUILD})</strong></li>
                    </ul>
                </div>
            </div>
        `;

        container.querySelector('#dashGotoCalendar').addEventListener('click', () => FDPUI.navigateTo('calendar'));

        // Abteilungs-Anwesenheit im Detail: Navigation + initiales Rendern
        if (!deptDetailDate) deptDetailDate = todayStr;
        const deptDetailBody = container.querySelector('#deptDetailBody');
        const deptDetailDateInput = container.querySelector('#deptDetailDateInput');

        function shiftDate(dateStr, deltaDays) {
            const d = FDPUI.parseISO(dateStr);
            const shifted = new Date(d.getFullYear(), d.getMonth(), d.getDate() + deltaDays);
            return FDPUI.formatDateISO(shifted);
        }
        function refreshDeptDetail() {
            deptDetailDateInput.value = deptDetailDate;
            renderDeptDetailBody(deptDetailBody, deptDetailDate, employees, departments, assignments, absences, holidays);
        }
        container.querySelector('#deptDetailPrevBtn').addEventListener('click', () => {
            deptDetailDate = shiftDate(deptDetailDate, -1);
            refreshDeptDetail();
        });
        container.querySelector('#deptDetailNextBtn').addEventListener('click', () => {
            deptDetailDate = shiftDate(deptDetailDate, 1);
            refreshDeptDetail();
        });
        container.querySelector('#deptDetailTodayBtn').addEventListener('click', () => {
            deptDetailDate = todayStr;
            refreshDeptDetail();
        });
        deptDetailDateInput.addEventListener('change', () => {
            if (deptDetailDateInput.value) {
                deptDetailDate = deptDetailDateInput.value;
                refreshDeptDetail();
            }
        });
        refreshDeptDetail();
    }

    /**
     * Rendert für ein bestimmtes Datum, welche Mitarbeiter in welcher
     * Abteilung anwesend (bzw. abwesend) sind - beschränkt auf Abteilungen,
     * für die eine Mindestbesetzung hinterlegt ist (dieselben, die auch die
     * Warnkarte darüber auswertet), damit die Ansicht übersichtlich bleibt.
     */
    function renderDeptDetailBody(bodyEl, dateStr, employees, departments, assignments, absences, holidays) {
        const date = FDPUI.parseISO(dateStr);
        const relevantDepartments = departments.filter(d => (d.minPresence || 0) > 0);
        const absenceIndex = FDPPresence.buildAbsenceIndex(absences);
        const violations = FDPPresence.computeViolationsForDate(dateStr, employees, departments, assignments, absences, holidays);
        const violatedCodes = new Set(violations.map(v => v.departmentCode));

        const employeesByDept = new Map();
        employees.filter(e => e.active && e.departmentCode).forEach((e) => {
            if (!employeesByDept.has(e.departmentCode)) employeesByDept.set(e.departmentCode, []);
            employeesByDept.get(e.departmentCode).push(e);
        });

        const rows = relevantDepartments.map((dept) => {
            const codes = FDPPresence.subtreeCodes(dept.code, departments);
            const present = [];
            const absent = [];
            codes.forEach((code) => {
                (employeesByDept.get(code) || []).forEach((e) => {
                    if (FDPPresence.isPresent(e, dateStr, absenceIndex)) present.push(e);
                    else absent.push(e);
                });
            });
            return { dept, present, absent };
        });

        bodyEl.innerHTML = `
            <p class="text-muted" style="margin-top:2px;">${FDPUI.weekdayLong(date)}, ${FDPUI.formatDateDisplay(dateStr)}${holidays[dateStr] ? ` – ${FDPUI.escapeHtml(holidays[dateStr])}` : ''}</p>
            <div class="table-scroll">
                <table class="data-table">
                    <thead><tr><th>Abteilung</th><th>Anwesend</th><th>Abwesend</th></tr></thead>
                    <tbody>
                        ${rows.map(({ dept, present, absent }) => `
                            <tr>
                                <td class="cell-strong">
                                    ${violatedCodes.has(dept.code) ? `${FDPUI.icon('warning')} ` : ''}${FDPUI.escapeHtml(dept.code)} – ${FDPUI.escapeHtml(dept.name)}
                                </td>
                                <td>${present.length > 0 ? present.map(e => FDPUI.escapeHtml(e.shortCode || e.name)).join(', ') : '<span class="text-muted">niemand</span>'}</td>
                                <td>${absent.length > 0 ? `<span class="text-muted">${absent.map(e => FDPUI.escapeHtml(e.shortCode || e.name)).join(', ')}</span>` : '–'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    return { init, applyColorTheme, refreshHeaderInfo, VERSION, BUILD };
})();

const FDP = { db: FDPDatabase };

document.addEventListener('DOMContentLoaded', () => {
    FDPApp.init().catch((err) => {
        console.error('Initialisierungsfehler:', err);
        document.getElementById('appLoader').innerHTML = `
            <div class="loader-error">
                <p><strong>Die Anwendung konnte nicht gestartet werden.</strong></p>
                <p>${err.message || err}</p>
            </div>
        `;
    });
});
