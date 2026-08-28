/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/planner.js
 * Version:    1.12.0
 * Build:      15
 * Datum:      2026-07-11
 *
 * Beschreibung:
 * Automatische Jahresdienstplanung. Erzeugt für einen gewählten Zeitraum
 * Diensteinträge unter Beachtung folgender Regeln:
 *  - Pro Tag genau ein Mitarbeiter je aktiver Dienstart (alle Funktionen müssen besetzt sein)
 *  - B-Dienst/C-Dienst sind 24h-Dienste: nach einem Dienst mindestens ein dienstfreier Kalendertag
 *  - LdF/FBL sind Bereitschaftsfunktionen ohne 24h-Charakter: keine Ruhetagspflicht danach
 *  - Niemand übernimmt zwei Funktionen am selben Tag - Ausnahme: als "kombinierbar"
 *    markierte Dienstarten (z. B. LdF+FBL) dürfen gemeinsam von einer Person übernommen
 *    werden, sofern diese über die dafür erforderlichen Qualifikationen verfügt
 *  - Nur Mitarbeiter mit den für eine Dienstart hinterlegten erforderlichen
 *    Qualifikationen kommen für diese Dienstart infrage
 *  - Kombinierbare Dienstarten (LdF/FBL) werden nach Möglichkeit wochenweise durch
 *    denselben Mitarbeiter besetzt, statt täglich zu wechseln
 *  - Urlaub und Krankheit blockieren die Einteilung
 *  - Wunschfrei wird nach Möglichkeit berücksichtigt
 *  - Wochenenden, Feiertage und Gesamtbelastung werden gleichmäßig verteilt;
 *    an Wochenend-/Feiertagen hat der Ausgleich der Wochenend-/Feiertagslast
 *    Vorrang vor der reinen Gesamtbelastung, damit sich diese nicht nur
 *    zufällig bei exakt gleicher Gesamtlast angleicht
 *  - Mitarbeiter können in ihrer Mitarbeitermaske eine manuelle prozentuale
 *    Zielverteilung auf die einzelnen Dienstarten hinterlegen (z. B. 70%
 *    Verfüger, 30% C-Dienst); nicht festgelegte Dienstarten werden von der
 *    Planung untereinander möglichst gleichmäßig aufgeteilt
 *  - Bei LdF/FBL wird zusätzlich ein Team-Anteilsmodell angewendet: explizit
 *    hinterlegte Prozentwerte (z. B. "Stellvertreter 20 %") werden tatsächlich
 *    eingeplant, nicht nur bei Abwesenheit der Führungsperson genutzt; der
 *    verbleibende Anteil geht automatisch an die als "Leiter der Feuerwehr"
 *    markierte Person, die dadurch weiterhin die meisten Dienste übernimmt
 *
 * Der Algorithmus arbeitet tagesweise chronologisch und wählt je Dienstart
 * den am wenigsten belasteten, verfügbaren Mitarbeiter (Greedy-Fairness-
 * Verfahren mit Gewichtung für Wochenend-/Feiertagslast).
 */

'use strict';

const FDPPlanner = (() => {

    async function render(container) {
        const year = Number(await FDP.db.getSetting('year', new Date().getFullYear()));
        const [employees, serviceTypes] = await Promise.all([
            FDP.db.getAll('employees'),
            FDP.db.getAll('serviceTypes')
        ]);
        const activeEmployees = employees.filter(e => e.active && e.dutyRosterEligible !== false);
        const activeServiceTypes = serviceTypes.filter(s => s.active !== false).sort((a, b) => a.sortOrder - b.sortOrder);

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Dienstplanung</h1>
                    <p class="view-subtitle">Automatische Jahresplanung nach hinterlegtem Regelwerk</p>
                </div>
            </div>

            <div class="card">
                <h2>Automatische Planung starten</h2>
                <p class="text-muted">
                    Es werden ${activeEmployees.length} aktive Führungsdienstler auf ${activeServiceTypes.length} Dienstarten
                    (${activeServiceTypes.map(s => s.name).join(', ') || 'keine Dienstart konfiguriert'}) verteilt. Mitarbeiter ohne Häkchen „Führungsdienstler" (reine Sachbearbeitung) werden nicht berücksichtigt.
                </p>
                <form id="plannerForm" class="form-grid">
                    <div class="form-field">
                        <label for="plannerFrom">Zeitraum von</label>
                        <input type="date" id="plannerFrom" value="${year}-01-01">
                    </div>
                    <div class="form-field">
                        <label for="plannerTo">Zeitraum bis</label>
                        <input type="date" id="plannerTo" value="${year}-12-31">
                    </div>
                    <div class="form-field form-field-checkbox">
                        <label><input type="checkbox" id="plannerOverwrite"> Bestehende Diensteinträge im Zeitraum überschreiben</label>
                    </div>
                </form>
                <div class="button-row">
                    <button class="btn btn-primary" id="runPlannerBtn" ${activeEmployees.length === 0 || activeServiceTypes.length === 0 ? 'disabled' : ''}>
                        ${FDPUI.icon('shuffle')} Jahresplanung erzeugen
                    </button>
                </div>
                ${activeEmployees.length === 0 ? '<p class="text-danger">Es sind keine aktiven Führungsdienstler vorhanden (prüfen Sie das Häkchen „Führungsdienstler" in der Mitarbeitermaske).</p>' : ''}
                ${activeServiceTypes.length === 0 ? '<p class="text-danger">Es sind keine aktiven Dienstarten konfiguriert.</p>' : ''}
            </div>

            <div class="card" id="plannerResult" style="display:none;"></div>
        `;

        container.querySelector('#runPlannerBtn')?.addEventListener('click', async () => {
            const from = container.querySelector('#plannerFrom').value;
            const to = container.querySelector('#plannerTo').value;
            const overwrite = container.querySelector('#plannerOverwrite').checked;
            if (!from || !to || to < from) {
                FDPUI.showToast('Bitte einen gültigen Zeitraum angeben.', 'error');
                return;
            }
            const btn = container.querySelector('#runPlannerBtn');
            btn.disabled = true;
            btn.textContent = 'Planung läuft…';
            const result = await runPlanning(from, to, overwrite);
            btn.disabled = false;
            btn.innerHTML = `${FDPUI.icon('shuffle')} Jahresplanung erzeugen`;

            const resultBox = container.querySelector('#plannerResult');
            resultBox.style.display = 'block';
            resultBox.innerHTML = `
                <h2>Ergebnis der Planung</h2>
                <p>${result.assigned} Diensteinträge erzeugt für ${result.days} Tage.</p>
                ${result.unfilled.length > 0 ? `
                    <div class="alert alert-warning">
                        ${FDPUI.icon('warning')}
                        <div>
                            <strong>Nicht vollständig besetzt:</strong> An ${result.unfilled.length} Tag(en) konnte nicht jede Dienstart
                            besetzt werden (zu wenige verfügbare Mitarbeiter). Details siehe Kalender.
                        </div>
                    </div>
                ` : '<p class="text-success">Alle Tage im Zeitraum konnten vollständig besetzt werden.</p>'}
                <div class="button-row">
                    <button class="btn btn-secondary" id="gotoCalendarBtn">Zum Kalender</button>
                </div>
            `;
            resultBox.querySelector('#gotoCalendarBtn').addEventListener('click', () => FDPUI.navigateTo('calendar'));
            FDPUI.showToast('Dienstplanung abgeschlossen', 'success');
        });
    }

    /**
     * Führt die automatische Planung für den angegebenen Zeitraum aus.
     */
    async function runPlanning(fromStr, toStr, overwrite) {
        const [employees, serviceTypes, existingAssignments, absences] = await Promise.all([
            FDP.db.getAll('employees'),
            FDP.db.getAll('serviceTypes'),
            FDP.db.getAll('assignments'),
            FDP.db.getAll('absences')
        ]);
        const activeEmployees = employees.filter(e => e.active && e.dutyRosterEligible !== false);
        const activeServiceTypes = serviceTypes.filter(s => s.active !== false).sort((a, b) => a.sortOrder - b.sortOrder);
        const bundesland = await FDP.db.getSetting('bundesland', 'NW');

        function hasRequiredQualifications(employee, service) {
            const required = service.requiredQualifications || [];
            if (required.length === 0) return true;
            const empQualifications = (employee.qualifications || []).map(q => q.toLowerCase());
            return required.every(q => empQualifications.includes(q.toLowerCase()));
        }

        /**
         * Berechnet je Mitarbeiter und Dienstart den angestrebten Anteilswert
         * (0-1) an dessen persönlichen Diensten. Explizit in der Mitarbeitermaske
         * hinterlegte Prozentwerte werden direkt übernommen; alle übrigen, für
         * den Mitarbeiter infrage kommenden Dienstarten teilen sich den
         * verbleibenden Anteil gleichmäßig (Standard: völlig gleichmäßige
         * Verteilung, wenn nichts hinterlegt ist).
         */
        function computeQuotaWeights(employee) {
            const eligible = activeServiceTypes.filter(st => hasRequiredQualifications(employee, st));
            const quotas = employee.serviceTypeQuotas || {};
            const weights = new Map();
            let explicitSum = 0;
            let openCount = 0;
            eligible.forEach((st) => {
                const explicit = quotas[st.id];
                if (explicit !== undefined && explicit !== null && explicit !== '') {
                    explicitSum += Number(explicit);
                } else {
                    openCount++;
                }
            });
            const remaining = Math.max(0, 100 - explicitSum);
            const autoShare = openCount > 0 ? remaining / openCount / 100 : 0;
            eligible.forEach((st) => {
                const explicit = quotas[st.id];
                if (explicit !== undefined && explicit !== null && explicit !== '') {
                    weights.set(st.id, Number(explicit) / 100);
                } else {
                    weights.set(st.id, autoShare);
                }
            });
            return weights;
        }
        const quotaWeights = new Map(); // employeeId -> Map(serviceTypeId -> weight 0..1)
        activeEmployees.forEach((e) => quotaWeights.set(e.id, computeQuotaWeights(e)));

        /**
         * Berechnet für eine kombinierbare Dienstart (z. B. LdF) den angestrebten
         * Team-Anteil (0-1) je Mitarbeiter - im Unterschied zu computeQuotaWeights
         * bezieht sich dieser Anteil nicht auf die persönliche Diensteverteilung
         * einer einzelnen Person, sondern auf die Aufteilung ALLER Dienste dieser
         * einen Dienstart innerhalb des dafür infrage kommenden Teams:
         *  - Explizit hinterlegte Prozentwerte (z. B. "Stellvertreter 20 %") werden
         *    direkt als Anteil an dieser Dienstart übernommen.
         *  - Der verbleibende Anteil geht an die als "Leiter der Feuerwehr /
         *    bevorzugte Führungsfunktion" markierte(n) Person(en) ohne eigene
         *    Festlegung - dadurch übernimmt der Leiter weiterhin die meisten
         *    Dienste, ohne dass zuvor von Stellvertretern reservierte Prozente
         *    ignoriert werden.
         *  - Gibt es keine markierte Führungsperson, teilen sich alle übrigen,
         *    nicht festgelegten Mitarbeiter den Rest gleichmäßig auf.
         */
        function computeTeamShareWeights(service) {
            const eligible = activeEmployees.filter(e => hasRequiredQualifications(e, service));
            const weights = new Map();
            let explicitSum = 0;
            const unsetPreferred = [];
            const unsetRegular = [];
            eligible.forEach((e) => {
                const explicit = (e.serviceTypeQuotas || {})[service.id];
                if (explicit !== undefined && explicit !== null && explicit !== '') {
                    weights.set(e.id, Number(explicit) / 100);
                    explicitSum += Number(explicit);
                } else if (e.preferredLeadership) {
                    unsetPreferred.push(e);
                } else {
                    unsetRegular.push(e);
                }
            });
            const remaining = Math.max(0, 100 - explicitSum);
            if (unsetPreferred.length > 0) {
                const share = remaining / unsetPreferred.length / 100;
                unsetPreferred.forEach((e) => weights.set(e.id, share));
                unsetRegular.forEach((e) => weights.set(e.id, 0));
            } else if (unsetRegular.length > 0) {
                const share = remaining / unsetRegular.length / 100;
                unsetRegular.forEach((e) => weights.set(e.id, share));
            }
            return weights;
        }
        const teamShareWeights = new Map(); // serviceTypeId -> Map(employeeId -> weight 0..1)
        activeServiceTypes.filter(s => s.combinable).forEach((st) => teamShareWeights.set(st.id, computeTeamShareWeights(st)));

        // Belastungszähler je Mitarbeiter (gesamt und je Dienstart für die
        // Quotenberechnung)
        const load = new Map();
        const loadByService = new Map(); // employeeId -> Map(serviceTypeId -> count)
        const weekendLoad = new Map();
        const holidayLoad = new Map();
        const lastServiceDate = new Map(); // letzter zugewiesener Diensttag (für Ruhetag-Regel)
        activeEmployees.forEach((e) => {
            load.set(e.id, 0);
            loadByService.set(e.id, new Map());
            weekendLoad.set(e.id, 0);
            holidayLoad.set(e.id, 0);
            lastServiceDate.set(e.id, null);
        });

        // Bestehende Zuweisungen außerhalb des Planungszeitraums als Vorbelastung berücksichtigen,
        // damit die Ruhetagsregel auch am Rand des Zeitraums korrekt greift.
        const keepAssignments = [];
        const removeIds = [];
        existingAssignments.forEach((a) => {
            const inRange = a.date >= fromStr && a.date <= toStr;
            if (inRange) {
                if (overwrite) {
                    removeIds.push(a.id);
                } else {
                    keepAssignments.push(a);
                    if (load.has(a.employeeId)) {
                        load.set(a.employeeId, load.get(a.employeeId) + 1);
                        const svcMap = loadByService.get(a.employeeId);
                        svcMap.set(a.serviceTypeId, (svcMap.get(a.serviceTypeId) || 0) + 1);
                    }
                    lastServiceDate.set(a.employeeId, a.date);
                }
            } else {
                if (a.date < fromStr) {
                    const current = lastServiceDate.get(a.employeeId);
                    if (!current || a.date > current) lastServiceDate.set(a.employeeId, a.date);
                }
            }
        });

        for (const id of removeIds) {
            await FDP.db.remove('assignments', id);
        }

        // Abwesenheiten je Mitarbeiter/Tag vorbereiten (Set aus "employeeId|date")
        const blockedDates = new Set();
        const wunschfreiDates = new Set();
        absences.forEach((a) => {
            let d = FDPUI.parseISO(a.dateFrom);
            const end = FDPUI.parseISO(a.dateTo);
            while (d <= end) {
                const key = `${a.employeeId}|${FDPUI.formatDateISO(d)}`;
                if (a.type === 'urlaub' || a.type === 'krank' || a.type === 'fortbildung') {
                    blockedDates.add(key);
                } else if (a.type === 'wunschfrei') {
                    wunschfreiDates.add(key);
                }
                d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
            }
        });

        // Bereits belegte Slots (falls nicht überschrieben) berücksichtigen
        const occupiedByDate = new Map(); // date -> Set(employeeId)
        const occupiedSlot = new Set(); // "date|serviceTypeId"
        keepAssignments.forEach((a) => {
            if (!occupiedByDate.has(a.date)) occupiedByDate.set(a.date, new Set());
            occupiedByDate.get(a.date).add(a.employeeId);
            occupiedSlot.add(`${a.date}|${a.serviceTypeId}`);
        });

        const newAssignments = [];
        let unfilled = [];
        let dayCount = 0;

        // Für jede kombinierbare Dienstart (z. B. LdF, FBL) wird pro Kalenderwoche
        // (Schlüssel = Montag der Woche) nach Möglichkeit derselbe Mitarbeiter
        // eingeplant, statt täglich zu wechseln.
        const weekAssigneeByService = new Map(); // serviceTypeId -> Map(weekKey -> employeeId)

        function weekKeyFor(date) {
            const dayNum = (date.getDay() + 6) % 7; // Montag = 0
            const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayNum);
            return FDPUI.formatDateISO(monday);
        }

        const holidayCache = {};
        function holidaysOfYear(y) {
            if (!holidayCache[y]) holidayCache[y] = FDPHolidays.getHolidays(y, bundesland);
            return holidayCache[y];
        }

        let cursor = FDPUI.parseISO(fromStr);
        const end = FDPUI.parseISO(toStr);

        while (cursor <= end) {
            const dateStr = FDPUI.formatDateISO(cursor);
            dayCount++;
            const isWeekend = FDPUI.isWeekend(cursor);
            const isHoliday = FDPHolidays.isHoliday(dateStr, holidaysOfYear(cursor.getFullYear()));
            const usedToday = occupiedByDate.get(dateStr) || new Set();
            // Mitarbeiter, die heute bereits eine NICHT kombinierbare Funktion übernommen haben
            const usedTodayNonCombinable = new Set([...usedToday]);
            // Mitarbeiter, die heute bereits eine kombinierbare Funktion (z. B. LdF) übernommen haben
            const usedTodayCombinable = new Set();

            // Kombinierbare Dienstarten zuerst planen, damit eine Person nach Möglichkeit
            // mehrere kombinierbare Funktionen (z. B. LdF + FBL) gemeinsam übernehmen kann.
            const orderedServices = [...activeServiceTypes].sort((a, b) => (a.combinable === b.combinable) ? 0 : (a.combinable ? -1 : 1));

            for (const service of orderedServices) {
                const slotKey = `${dateStr}|${service.id}`;
                if (occupiedSlot.has(slotKey)) continue; // bereits besetzt und nicht überschrieben

                // Kandidaten ermitteln: aktiv, erforderliche Qualifikation vorhanden, nicht
                // anderweitig heute gebunden, nicht abwesend. Die Ruhetagsregel (mind. ein
                // dienstfreier Tag nach dem letzten Dienst) gilt nur für 24h-Dienste
                // (B-Dienst/C-Dienst & Co.) - Bereitschaftsfunktionen wie LdF/FBL sind davon
                // ausgenommen. Kombinierbare Dienstarten dürfen von einer Person übernommen
                // werden, die heute bereits eine andere kombinierbare Funktion ausübt.
                let candidates = activeEmployees.filter((e) => {
                    if (!hasRequiredQualifications(e, service)) return false;
                    if (usedTodayNonCombinable.has(e.id)) return false;
                    if (!service.combinable && usedTodayCombinable.has(e.id)) return false;
                    if (blockedDates.has(`${e.id}|${dateStr}`)) return false;
                    if (!service.combinable) {
                        const last = lastServiceDate.get(e.id);
                        if (last && last !== dateStr) {
                            const gapDays = Math.round((cursor - FDPUI.parseISO(last)) / 86400000);
                            if (gapDays < 2) return false; // mind. ein dienstfreier Tag dazwischen
                        }
                    }
                    return true;
                });

                // Wunschfrei nach Möglichkeit respektieren: bevorzugt Kandidaten ohne Wunschfrei
                const withoutWunschfrei = candidates.filter(e => !wunschfreiDates.has(`${e.id}|${dateStr}`));
                if (withoutWunschfrei.length > 0) candidates = withoutWunschfrei;

                if (candidates.length === 0) {
                    unfilled.push({ date: dateStr, serviceTypeId: service.id });
                    continue;
                }

                let chosen = null;

                // Wöchentliche Rotation: Ist für diese Woche bereits ein Mitarbeiter für diese
                // kombinierbare Dienstart vorgesehen und weiterhin verfügbar, wird dieser
                // bevorzugt erneut eingeplant, statt täglich zu wechseln.
                if (service.combinable) {
                    const weekKey = weekKeyFor(cursor);
                    const weekMap = weekAssigneeByService.get(service.id) || new Map();
                    weekAssigneeByService.set(service.id, weekMap);
                    const weekAssigneeId = weekMap.get(weekKey);
                    if (weekAssigneeId !== undefined) {
                        chosen = candidates.find(c => c.id === weekAssigneeId) || null;
                    }
                }

                if (!chosen) {
                    // Fairste Wahl: bei kombinierbaren Funktionen wird zunächst dieselbe Person
                    // bevorzugt, die heute bereits eine andere kombinierbare Funktion übernimmt
                    // (Regel: LdF+FBL gemeinsam durch eine Person). An Wochenenden/Feiertagen
                    // entscheidet danach zuerst die Wochenend-/Feiertagslast (nicht erst die
                    // Gesamtlast) - sonst greift der Ausgleich kaum, weil exakt gleiche
                    // Gesamtlast selten vorkommt. Danach entscheidet die Zielquote nach dem
                    // Höchstzahlverfahren (wie bei Sitzverteilungen): Gewicht geteilt durch
                    // (bisherige Zuteilungen + 1) - wer hier den höchsten Wert hat, ist am
                    // weitesten von seiner Zielverteilung entfernt und bekommt die Dienstart
                    // zugeteilt. Bei kombinierbaren Dienstarten (LdF/FBL) bezieht sich das
                    // Gewicht auf den Team-Anteil an dieser einen Dienstart (explizit
                    // hinterlegte Stellvertreter-Quoten werden dadurch tatsächlich eingeplant,
                    // nicht nur bei Abwesenheit der Führungsperson genutzt); bei allen anderen
                    // Dienstarten auf die persönliche Verteilung der jeweiligen Person über ihre
                    // eigenen Dienste. Zuletzt die Gesamtlast.
                    const quotient = (emp) => {
                        const weight = service.combinable
                            ? (teamShareWeights.get(service.id)?.get(emp.id) ?? 0)
                            : (quotaWeights.get(emp.id)?.get(service.id) ?? 0);
                        const ownCount = loadByService.get(emp.id).get(service.id) || 0;
                        return weight / (ownCount + 1);
                    };
                    candidates.sort((a, b) => {
                        if (service.combinable) {
                            const aReused = usedTodayCombinable.has(a.id) ? 0 : 1;
                            const bReused = usedTodayCombinable.has(b.id) ? 0 : 1;
                            if (aReused !== bReused) return aReused - bReused;
                        }
                        if (isWeekend || isHoliday) {
                            const wDiff = (weekendLoad.get(a.id) + holidayLoad.get(a.id)) - (weekendLoad.get(b.id) + holidayLoad.get(b.id));
                            if (wDiff !== 0) return wDiff;
                        }
                        const quotientDiff = quotient(b) - quotient(a);
                        if (Math.abs(quotientDiff) > 0.0005) return quotientDiff;
                        const loadDiff = load.get(a.id) - load.get(b.id);
                        if (loadDiff !== 0) return loadDiff;
                        return Math.random() - 0.5;
                    });
                    chosen = candidates[0];

                    if (service.combinable) {
                        const weekKey = weekKeyFor(cursor);
                        weekAssigneeByService.get(service.id).set(weekKey, chosen.id);
                    }
                }

                newAssignments.push({ date: dateStr, serviceTypeId: service.id, employeeId: chosen.id });
                usedToday.add(chosen.id);
                occupiedByDate.set(dateStr, usedToday);
                if (service.combinable) {
                    usedTodayCombinable.add(chosen.id);
                } else {
                    usedTodayNonCombinable.add(chosen.id);
                }
                // Belastungsausgleich bezieht sich auf ALLE Dienste (auch LdF/FBL), damit sich
                // niemand dauerhaft in einer Führungsfunktion "festsetzt" und dadurch von der
                // fairen Verteilung der Einsatzdienste ausgeschlossen wird. Der Ausschluss von
                // LdF/FBL aus der Einsatzdienst-STATISTIK erfolgt unabhängig davon in statistics.js.
                load.set(chosen.id, load.get(chosen.id) + 1);
                const chosenServiceMap = loadByService.get(chosen.id);
                chosenServiceMap.set(service.id, (chosenServiceMap.get(service.id) || 0) + 1);
                if (isWeekend) weekendLoad.set(chosen.id, weekendLoad.get(chosen.id) + 1);
                if (isHoliday) holidayLoad.set(chosen.id, holidayLoad.get(chosen.id) + 1);
                lastServiceDate.set(chosen.id, dateStr);
            }

            cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }

        if (newAssignments.length > 0) {
            await FDP.db.bulkPut('assignments', newAssignments);
        }

        return { assigned: newAssignments.length, days: dayCount, unfilled };
    }

    return { render, runPlanning };
})();
