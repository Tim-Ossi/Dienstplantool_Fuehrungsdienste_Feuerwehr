/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/presence.js
 * Version:    2.0.0
 * Build:      17
 * Datum:      2026-07-14
 *
 * Beschreibung:
 * Berechnet für einen gegebenen Tag, ob die abteilungsbezogenen
 * Mindestbesetzungsregeln eingehalten werden. Die Regel gilt bewusst nur an
 * gewöhnlichen Werktagen (Montag bis Freitag) und nicht an Wochenenden oder
 * gesetzlichen Feiertagen, da an diesen Tagen kein regulärer Bürobetrieb der
 * Fachgruppen/Fachdienste stattfindet.
 *
 * Regelwerk:
 *  - Für jede Abteilung mit gesetztem "minPresence" (typischerweise die
 *    Fachgruppen-Ebene, z. B. 5.11, 5.12, 5.13, 5.14, 5.21, 5.22, 5.23, 5.3,
 *    5.4) muss mindestens die angegebene Anzahl an Mitarbeitern dieser
 *    Abteilung ODER ihrer Unterabteilungen anwesend sein (anwesend = aktiv
 *    und nicht durch Urlaub/Krankheit/Fortbildung abwesend). Ist zusätzlich
 *    "presenceMustBeUnassigned" gesetzt, zählt eine Person nur, wenn sie an
 *    diesem Tag zusätzlich KEINE Dienstart übernommen hat.
 *  - Rückfallebene: Wird diese Mindestbesetzung nicht erreicht, gilt die
 *    Regel dennoch als erfüllt, wenn mindestens eine (bei Bedarf
 *    unverplante) Person DIREKT einer übergeordneten Abteilung zugeordnet
 *    ist und anwesend ist (z. B. der Fachdienstleiter FDL 5.1 selbst für
 *    eine leere Fachgruppe 5.11-5.14). Diese Rückfallprüfung läuft die
 *    komplette Elternkette hoch.
 *  - Abteilungen mit "presenceSoft" (z. B. Fachgruppe 5.3, die laut
 *    Organisationsstruktur nur zwei Mitarbeiter umfasst) erzeugen bei einer
 *    Unterbesetzung nur einen informativen Hinweis statt einer harten
 *    Warnung - die Regel darf dort abweichen, wenn sie sich anders nicht
 *    abbilden lässt.
 *
 * Alle Berechnungen beziehen sich bewusst auf ALLE Mitarbeiter einer
 * Abteilung (auch reine Sachbearbeitung ohne "Führungsdienstler"-Häkchen) -
 * es geht hier um physische Anwesenheit in der Abteilung, nicht um die
 * operative Diensteinteilung.
 */

'use strict';

const FDPPresence = (() => {

    function isPresent(employee, dateStr, absenceIndex) {
        if (!employee.active) return false;
        const blocking = absenceIndex.get(employee.id);
        if (!blocking) return true;
        return !blocking.has(dateStr);
    }

    function buildAbsenceIndex(absences) {
        const index = new Map();
        absences.forEach((a) => {
            if (a.type !== 'urlaub' && a.type !== 'krank' && a.type !== 'fortbildung') return;
            if (!index.has(a.employeeId)) index.set(a.employeeId, new Set());
            const set = index.get(a.employeeId);
            let d = FDPUI.parseISO(a.dateFrom);
            const end = FDPUI.parseISO(a.dateTo);
            while (d <= end) {
                set.add(FDPUI.formatDateISO(d));
                d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
            }
        });
        return index;
    }

    function buildAssignedSet(dateStr, assignments) {
        const set = new Set();
        assignments.forEach((a) => {
            if (a.date === dateStr) set.add(a.employeeId);
        });
        return set;
    }

    function subtreeCodes(rootCode, departments) {
        const childrenByParent = new Map();
        departments.forEach((d) => {
            const key = d.parentCode || '';
            if (!childrenByParent.has(key)) childrenByParent.set(key, []);
            childrenByParent.get(key).push(d.code);
        });
        const result = new Set([rootCode]);
        const queue = [rootCode];
        while (queue.length > 0) {
            const current = queue.shift();
            (childrenByParent.get(current) || []).forEach((childCode) => {
                if (!result.has(childCode)) {
                    result.add(childCode);
                    queue.push(childCode);
                }
            });
        }
        return result;
    }

    function ancestorChain(departmentCode, departmentByCode) {
        const chain = [];
        let current = departmentByCode.get(departmentCode);
        while (current && current.parentCode) {
            chain.push(current.parentCode);
            current = departmentByCode.get(current.parentCode);
        }
        return chain;
    }

    function ruleAppliesOnDate(dateStr, holidays) {
        const date = FDPUI.parseISO(dateStr);
        if (FDPUI.isWeekend(date)) return false;
        if (holidays && FDPHolidays.isHoliday(dateStr, holidays)) return false;
        return true;
    }

    function computeViolationsForDate(dateStr, employees, departments, assignments, absences, holidays) {
        if (!ruleAppliesOnDate(dateStr, holidays)) return [];

        const absenceIndex = buildAbsenceIndex(absences);
        const assignedToday = buildAssignedSet(dateStr, assignments);
        const departmentByCode = new Map(departments.map(d => [d.code, d]));

        const employeesByDept = new Map();
        employees.filter(e => e.active && e.departmentCode).forEach((e) => {
            if (!employeesByDept.has(e.departmentCode)) employeesByDept.set(e.departmentCode, []);
            employeesByDept.get(e.departmentCode).push(e);
        });

        function directPresentCount(deptCode, mustBeUnassigned) {
            const members = employeesByDept.get(deptCode) || [];
            return members.filter(e => isPresent(e, dateStr, absenceIndex) && (!mustBeUnassigned || !assignedToday.has(e.id))).length;
        }

        function subtreePresentCount(deptCode, mustBeUnassigned) {
            const codes = subtreeCodes(deptCode, departments);
            let count = 0;
            codes.forEach((code) => { count += directPresentCount(code, mustBeUnassigned); });
            return count;
        }

        const violations = [];

        departments.forEach((dept) => {
            const required = dept.minPresence || 0;
            if (required <= 0) return;

            const count = subtreePresentCount(dept.code, dept.presenceMustBeUnassigned);
            if (count >= required) return;

            const ancestors = ancestorChain(dept.code, departmentByCode);
            const backupAvailable = ancestors.some((ancestorCode) => directPresentCount(ancestorCode, dept.presenceMustBeUnassigned) > 0);
            if (backupAvailable) return;

            const severity = dept.presenceSoft ? 'info' : 'warning';
            const baseMessage = dept.presenceMustBeUnassigned
                ? `${dept.code} – ${dept.name}: mindestens ${required} unverplante anwesende Person(en) gefordert, aktuell ${count}, auch keine Vertretung aus einer übergeordneten Abteilung verfügbar.`
                : `${dept.code} – ${dept.name}: mindestens ${required} anwesende Person(en) gefordert, aktuell ${count}, auch keine Vertretung aus einer übergeordneten Abteilung verfügbar.`;

            violations.push({
                departmentCode: dept.code,
                departmentName: dept.name,
                severity,
                message: severity === 'info' ? `${baseMessage} (Ausnahme zulässig, da diese Fachgruppe nur wenige Mitarbeiter umfasst)` : baseMessage
            });
        });

        return violations;
    }

    /**
     * Prüft, ob ein Mitarbeiter an einem bestimmten Tag der EINZIGE anwesende
     * Mitarbeiter seiner Abteilung (inklusive deren Teilbaum) ist - also
     * planerisch für die Büroanwesenheit dieser Abteilung allein
     * verantwortlich wäre. Wird u. a. für den persönlichen Jahresdienstplan
     * verwendet, um solche Tage optisch hervorzuheben. Gilt wie die übrige
     * Anwesenheitsregel nur an gewöhnlichen Werktagen ohne Feiertage.
     */
    function isSolePresentEmployee(employee, dateStr, employees, departments, assignments, absences, holidays) {
        if (!ruleAppliesOnDate(dateStr, holidays)) return false;
        if (!employee.active || !employee.departmentCode) return false;

        const dept = departments.find(d => d.code === employee.departmentCode);
        if (!dept) return false;

        const absenceIndex = buildAbsenceIndex(absences);
        if (!isPresent(employee, dateStr, absenceIndex)) return false;

        const assignedToday = buildAssignedSet(dateStr, assignments);
        const mustBeUnassigned = !!dept.presenceMustBeUnassigned;
        if (mustBeUnassigned && assignedToday.has(employee.id)) return false;

        const employeesByDept = new Map();
        employees.filter(e => e.active && e.departmentCode).forEach((e) => {
            if (!employeesByDept.has(e.departmentCode)) employeesByDept.set(e.departmentCode, []);
            employeesByDept.get(e.departmentCode).push(e);
        });

        const codes = subtreeCodes(dept.code, departments);
        let presentCount = 0;
        codes.forEach((code) => {
            const members = employeesByDept.get(code) || [];
            members.forEach((m) => {
                if (isPresent(m, dateStr, absenceIndex) && (!mustBeUnassigned || !assignedToday.has(m.id))) presentCount++;
            });
        });
        return presentCount === 1;
    }

    return { computeViolationsForDate, isSolePresentEmployee, ruleAppliesOnDate, isPresent, buildAbsenceIndex, buildAssignedSet, ancestorChain, subtreeCodes };
})();
