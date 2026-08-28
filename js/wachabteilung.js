/**
 * Projekt:    Feuerwehr Dienstplanungssoftware (FDP)
 * Datei:      js/wachabteilung.js
 * Version:    1.0.0
 * Build:      18
 * Datum:      2026-07-20
 *
 * Beschreibung:
 * Berechnet, welche der vier Wachabteilungen (WA I - WA IV) an einem
 * gegebenen Kalendertag im 24h-Tagesdienst ist. Die Untergruppen je
 * Wachabteilung (z. B. WA I-1/WA I-2) werden hier bewusst NICHT abgebildet -
 * das betrifft die Personalplanung der Wachabteilungen selbst, die für die
 * Führungsdienstplanung aktuell keine Rolle spielt (siehe Benutzerhandbuch).
 *
 * Zugrunde liegendes Muster (je Wachabteilung, wiederkehrend):
 *   24h-Dienst -> 1 Tag frei -> 24h-Dienst -> 5 Tage frei -> von vorn.
 * Das ergibt einen 8-Tage-Rhythmus je Wachabteilung. Bei vier Wachabteilungen
 * überlappungsfrei versetzt ergibt sich folgende Belegung eines
 * gemeinsamen 8-Tage-Zyklus (Position 1-8):
 *
 *   Position:        1    2    3    4    5    6    7    8
 *   Wachabteilung:  WA I  WA II WA I  WA II WA III WA IV WA III WA IV
 *
 *   (WA I: Dienst an Position 1 und 3, danach 5 Tage frei bis Position 1 der
 *   Folgewoche; WA II analog ab Position 2; WA III ab Position 5; WA IV ab
 *   Position 6 - jede Wachabteilung hält damit exakt das beschriebene
 *   Muster ein, und jeder Tag ist durchgehend mit genau einer Wachabteilung
 *   besetzt.)
 *
 * Bekannter Fixpunkt: Am 1.1.2026 hatte Wachabteilung IV Dienst - das
 * entspricht Position 6 des Zyklus. Alle weiteren Tage werden davon
 * ausgehend berechnet.
 *
 * WICHTIGER HINWEIS ZUR ANNAHME: Aus dem einen bekannten Fixpunkt (1.1.2026
 * = WA IV) lässt sich nicht eindeutig ableiten, ob dieser Tag die ERSTE oder
 * ZWEITE Diensttag-Position von WA IV im Zyklus ist (Position 6 oder 8) - 
 * beide sind rechnerisch mit dem beschriebenen Muster vereinbar, ergeben
 * aber unterschiedliche Folgetage für WA I-III in der Woche davor. Diese
 * Datei geht von Position 6 aus. Falls der tatsächliche Dienstplan davon an
 * einer bestimmten Stelle abweicht, bitte Rückmeldung geben - der Fixpunkt
 * (ANCHOR_DATE/ANCHOR_POSITION) ist zentral an einer Stelle einstellbar.
 */

'use strict';

const FDPWachabteilung = (() => {

    const ANCHOR_DATE = '2026-01-01';
    const ANCHOR_POSITION = 6; // 1-indiziert, siehe Kommentar oben

    // Zyklus-Positionen 1-8 -> zuständige Wachabteilung
    const ROTATION = ['WA I', 'WA II', 'WA I', 'WA II', 'WA III', 'WA IV', 'WA III', 'WA IV'];

    /**
     * Liefert die Wachabteilung, die an einem bestimmten Kalendertag im
     * 24h-Tagesdienst ist.
     * @param {string} dateStr Datum im Format JJJJ-MM-TT
     * @returns {string} z. B. "WA I"
     */
    function getWachabteilungForDate(dateStr) {
        const anchor = FDPUI.parseISO(ANCHOR_DATE);
        const date = FDPUI.parseISO(dateStr);
        const diffDays = Math.round((date - anchor) / 86400000);
        const pos = (((ANCHOR_POSITION - 1 + diffDays) % 8) + 8) % 8; // 0-indiziert
        return ROTATION[pos];
    }

    /**
     * Kurzform für kompakte Darstellung (z. B. in engen Tabellenzellen):
     * "WA I" -> "I", "WA IV" -> "IV".
     */
    function getWachabteilungShort(dateStr) {
        return getWachabteilungForDate(dateStr).replace('WA ', '');
    }

    return { getWachabteilungForDate, getWachabteilungShort };
})();
