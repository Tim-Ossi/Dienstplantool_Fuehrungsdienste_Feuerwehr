/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/holidays.js
 * Version:    1.0.0
 * Build:      1
 * Datum:      2026-07-09
 *
 * Beschreibung:
 * Berechnet gesetzliche Feiertage für ein gegebenes Jahr und Bundesland.
 * Bewegliche Feiertage werden über den Gaußschen Osteralgorithmus ermittelt.
 * Die Zuordnung "welche Feiertage gelten in welchem Bundesland" ist als
 * Konfigurationstabelle hinterlegt und kann erweitert werden, ohne die
 * Berechnungslogik anzufassen.
 */

'use strict';

const FDPHolidays = (() => {

    /**
     * Berechnet das Datum des Ostersonntags nach dem Gaußschen Osteralgorithmus.
     * @param {number} year
     * @returns {Date}
     */
    function calculateEasterSunday(year) {
        const k = Math.floor(year / 100);
        const m = 15 + Math.floor((3 * k + 3) / 4) - Math.floor((8 * k + 13) / 25);
        const s = 2 - Math.floor((3 * k + 3) / 4);
        const a = year % 19;
        const d = (19 * a + m) % 30;
        const r = Math.floor((d + a / 11) / 29);
        const og = 21 + d - r;
        const sz = 7 - (year + Math.floor(year / 4) + s) % 7;
        const oe = 7 - (og - sz) % 7;
        const os = og + oe;

        // os = Tag im März (falls > 31, dann April)
        if (os > 31) {
            return new Date(year, 3, os - 31); // April
        }
        return new Date(year, 2, os); // März
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function formatISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Bundesweite Feiertage, die in allen 16 Bundesländern gelten.
     */
    function nationalHolidays(year, easter) {
        return [
            { date: formatISO(new Date(year, 0, 1)), name: 'Neujahr' },
            { date: formatISO(addDays(easter, -2)), name: 'Karfreitag' },
            { date: formatISO(addDays(easter, 1)), name: 'Ostermontag' },
            { date: formatISO(new Date(year, 4, 1)), name: 'Tag der Arbeit' },
            { date: formatISO(addDays(easter, 39)), name: 'Christi Himmelfahrt' },
            { date: formatISO(addDays(easter, 50)), name: 'Pfingstmontag' },
            { date: formatISO(new Date(year, 9, 3)), name: 'Tag der Deutschen Einheit' },
            { date: formatISO(new Date(year, 11, 25)), name: '1. Weihnachtsfeiertag' },
            { date: formatISO(new Date(year, 11, 26)), name: '2. Weihnachtsfeiertag' }
        ];
    }

    /**
     * Zusätzliche, bundeslandspezifische Feiertage.
     * Struktur ist bewusst erweiterbar für alle 16 Bundesländer.
     */
    const REGIONAL_HOLIDAYS = {
        NW: (year, easter) => [ // Nordrhein-Westfalen
            { date: formatISO(addDays(easter, 60)), name: 'Fronleichnam' },
            { date: formatISO(new Date(year, 10, 1)), name: 'Allerheiligen' }
        ],
        BW: (year, easter) => [
            { date: formatISO(new Date(year, 0, 6)), name: 'Heilige Drei Könige' },
            { date: formatISO(addDays(easter, 60)), name: 'Fronleichnam' },
            { date: formatISO(new Date(year, 10, 1)), name: 'Allerheiligen' }
        ],
        BY: (year, easter) => [
            { date: formatISO(new Date(year, 0, 6)), name: 'Heilige Drei Könige' },
            { date: formatISO(addDays(easter, 60)), name: 'Fronleichnam' },
            { date: formatISO(new Date(year, 7, 15)), name: 'Mariä Himmelfahrt' },
            { date: formatISO(new Date(year, 10, 1)), name: 'Allerheiligen' }
        ],
        BE: () => [],
        BB: (year, easter) => [
            { date: formatISO(addDays(easter, -3)), name: 'Ostersonntag' },
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' }
        ],
        HB: (year, easter) => [
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' }
        ],
        HH: (year, easter) => [
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' }
        ],
        HE: (year, easter) => [
            { date: formatISO(addDays(easter, 60)), name: 'Fronleichnam' }
        ],
        MV: (year, easter) => [
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' }
        ],
        NI: (year, easter) => [
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' }
        ],
        RP: (year, easter) => [
            { date: formatISO(addDays(easter, 60)), name: 'Fronleichnam' },
            { date: formatISO(new Date(year, 10, 1)), name: 'Allerheiligen' }
        ],
        SL: (year, easter) => [
            { date: formatISO(addDays(easter, 60)), name: 'Fronleichnam' },
            { date: formatISO(new Date(year, 7, 15)), name: 'Mariä Himmelfahrt' },
            { date: formatISO(new Date(year, 10, 1)), name: 'Allerheiligen' }
        ],
        SN: (year, easter) => [
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' },
            { date: formatISO(new Date(year, 10, 22) <= new Date(year, 10, 23) ? computeBussUndBettag(year) : new Date(year, 10, 22)), name: 'Buß- und Bettag' }
        ],
        ST: (year, easter) => [
            { date: formatISO(new Date(year, 0, 6)), name: 'Heilige Drei Könige' },
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' }
        ],
        SH: (year, easter) => [
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' }
        ],
        TH: (year, easter) => [
            { date: formatISO(new Date(year, 9, 31)), name: 'Reformationstag' }
        ]
    };

    /**
     * Buß- und Bettag: Mittwoch vor dem 23. November.
     */
    function computeBussUndBettag(year) {
        const nov23 = new Date(year, 10, 23);
        const dayOfWeek = nov23.getDay(); // 0 = Sonntag
        const diffToWednesday = (dayOfWeek - 3 + 7) % 7 || 7;
        return addDays(nov23, -diffToWednesday);
    }

    const STATE_LABELS = {
        NW: 'Nordrhein-Westfalen', BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin',
        BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen',
        MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', RP: 'Rheinland-Pfalz',
        SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein',
        TH: 'Thüringen'
    };

    /**
     * Liefert alle Feiertage eines Jahres für ein Bundesland als Map { 'YYYY-MM-DD': name }.
     * @param {number} year
     * @param {string} stateCode z.B. 'NW'
     */
    function getHolidays(year, stateCode = 'NW') {
        const easter = calculateEasterSunday(year);
        const list = [
            ...nationalHolidays(year, easter),
            ...(REGIONAL_HOLIDAYS[stateCode] ? REGIONAL_HOLIDAYS[stateCode](year, easter) : [])
        ];
        const map = {};
        list.forEach((h) => { map[h.date] = h.name; });
        return map;
    }

    function getStateLabels() {
        return STATE_LABELS;
    }

    function isHoliday(dateStr, holidayMap) {
        return Object.prototype.hasOwnProperty.call(holidayMap, dateStr);
    }

    return { getHolidays, getStateLabels, isHoliday };
})();
