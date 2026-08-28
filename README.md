# Dienstplanung Führungsdienst

Offline-fähige Dienstplanungssoftware für den Führungsdienst einer Feuerwehr.
Läuft vollständig im Browser (Windows, macOS, iOS, Android) – ohne Installation,
ohne Server, ohne Internetverbindung. Alle Daten werden ausschließlich lokal
im Browser gespeichert (IndexedDB).

## Starten

1. Den Ordner vollständig an einen beliebigen Ort entpacken/kopieren (z. B. auf
   einen USB-Stick, ein Tablet oder in einen lokalen Ordner).
2. `index.html` per Doppelklick in einem aktuellen Browser öffnen
   (Chrome, Edge, Safari, Firefox).
3. Fertig – keine weitere Einrichtung nötig.

**Wichtig:** Da die Daten browser- und geräteweise in IndexedDB gespeichert
werden, sind sie **nicht automatisch zwischen Geräten oder Browsern
synchronisiert**. Für die Übertragung auf ein anderes Gerät nutzen Sie
`Einstellungen → JSON-Sicherung exportieren` und importieren Sie die Datei
dort erneut.

## Erste Schritte

1. **Einstellungen**: Feuerwehrname, Bundesland und Planungsjahr hinterlegen.
2. **Mitarbeiter**: Beliebig viele Mitarbeiter anlegen.
3. **Dienstplanung**: Automatische Jahresplanung erzeugen lassen (berücksichtigt
   Ruhetage, Urlaub, Krankheit, Wunschfrei sowie eine faire Verteilung von
   Wochenenden, Feiertagen und Gesamtbelastung).
4. **Kalender**: Einzelne Tage bei Bedarf manuell nachbearbeiten.
5. **Statistik**: Auswertung je Mitarbeiter einsehen.

## Datensicherung

Da alle Daten lokal im Browser liegen, empfiehlt sich ein regelmäßiger
JSON-Export über `Einstellungen → JSON-Sicherung exportieren`. Diese Datei
enthält den vollständigen Datenbestand und kann jederzeit wieder importiert
werden (auch auf einem anderen Gerät).

**Hinweis zum Browser-Speicher:** Manche Browser können lokal gespeicherte
Daten unter bestimmten Umständen bereinigen (z. B. bei sehr langer
Nichtnutzung im privaten/inkognito-Modus). Bitte regelmäßig sichern und die
Anwendung nicht im privaten Modus verwenden.

## Export-Funktionen

- **JSON-Sicherung**: vollständiger Datenexport/-import (Backup & Umzug)
- **CSV (Excel)**: Mitarbeiterliste und Statistik lassen sich als CSV
  exportieren und direkt in Excel öffnen
- **Drucken / PDF**: Über „Kalender drucken / als PDF speichern“ öffnet sich
  der Browser-Druckdialog; dort kann als Ziel „Als PDF speichern“ gewählt
  werden – ganz ohne zusätzliche Software

## Mitarbeiterimport aus Excel/CSV

Unter `Mitarbeiter → Aus Excel/CSV importieren` lassen sich Mitarbeiter aus
einer Datei einlesen:

- **.xlsx** wird direkt gelesen – ganz ohne externe Bibliotheken, ausschließlich
  über in modernen Browsern eingebaute Web-Standards (Auslesen des ZIP-
  Containers, `DecompressionStream` zur Dekomprimierung, `DOMParser` für die
  enthaltenen XML-Daten). Funktioniert in allen aktuellen Browsern (Chrome,
  Edge, Safari ab 16.4, Firefox ab 113).
- **.csv** wird immer unterstützt (Semikolon oder Komma als Trennzeichen wird
  automatisch erkannt) – die sichere Alternative für ältere Browser.

Die erste Zeile muss Spaltenüberschriften enthalten. Erkannt werden u. a.
„Name“ (Pflichtfeld), „Kürzel“, „Abteilung“, „Qualifikationen“, „Aktiv“,
„Urlaubsanspruch“, „Resturlaub“, „Beschäftigungsumfang %“, „Bemerkungen“ –
Groß-/Kleinschreibung spielt keine Rolle. Ist bereits ein Mitarbeiter mit
demselben Namen vorhanden, wird dessen Datensatz aktualisiert statt
dupliziert. Vor dem eigentlichen Import wird eine Vorschau angezeigt.

## Führungsfunktionen LdF und FBL

Neben den Einsatzdienstarten (B-Dienst, C-Dienst, Verfüger) sind standardmäßig
zwei weitere, als „kombinierbar“ markierte Dienstarten angelegt:

- **LdF** (Leiter vom Dienst / Führungsfunktion)
- **FBL** (Fachbereichsleitung / Führungsfunktion)

Diese beiden Funktionen dürfen – im Gegensatz zu den übrigen Dienstarten – am
selben Tag durch **dieselbe Person** übernommen werden. Die automatische
Jahresplanung bevorzugt bei kombinierbaren Dienstarten bewusst dieselbe
Person, sofern verfügbar. Beide Funktionen **fließen nicht in die
Einsatzdienst-Statistik** ein (weder in „Gesamt“, Soll/Ist-Vergleich noch in
die Wochenend-/Feiertagsauswertung oder das Diagramm) – sie werden in der
Statistiktabelle als eigene, gekennzeichnete Spalten (mit „*“) rein
informativ mitgeführt.

Über `Einstellungen → Dienstarten` lässt sich für jede Dienstart einzeln
festlegen, ob sie in der Einsatzdienst-Statistik gewertet wird und ob sie
kombinierbar ist – das Prinzip ist also nicht auf LdF/FBL beschränkt, sondern
für beliebige weitere Funktionen nutzbar.

## Sortierbare Belastungsübersicht

In der Statistik lässt sich die Tabelle „Belastungsübersicht" durch Klick auf
eine beliebige Spaltenüberschrift sortieren (erneuter Klick kehrt die
Richtung um). Alle Tabellen der Anwendung sind zudem in einen horizontal
scrollbaren Rahmen eingebettet, sodass breite Tabellen den Kartenrahmen nicht
mehr sprengen, sondern innerhalb der Karte gescrollt werden.

## Import von Abwesenheiten

Unter `Urlaub & Abwesenheit → Aus Excel/CSV importieren` lassen sich
Abwesenheiten (Urlaub, Krankheit, Fortbildung, Wunschfrei) importieren.
Über „Excel-Vorlage herunterladen" steht eine passende, vorausgefüllte
.xlsx-Datei zum Download bereit (Spalten: Mitarbeiter, Art, Von, Bis,
Bemerkung). Diese Vorlage wird - wie der Mitarbeiterimport - vollständig ohne
externe Bibliotheken erzeugt (eigener, minimaler .xlsx-Writer nach dem
offiziellen OOXML-Format) und lässt sich in Excel, LibreOffice oder Numbers
öffnen. Mitarbeiter werden per Name oder Kürzel zugeordnet; Datumsangaben
werden sowohl im Format TT.MM.JJJJ als auch JJJJ-MM-TT sowie als
Excel-Datumszelle erkannt.

## Erforderliche Qualifikationen je Dienstart

Unter `Einstellungen → Dienstarten` kann für jede Dienstart festgelegt
werden, welche Qualifikation(en) ein Mitarbeiter benötigt, um dafür eingeteilt
werden zu können (z. B. „LdF" für die Dienstart LdF, „FBL" für FBL). Ohne
passende Qualifikation erscheint der Mitarbeiter im Kalender-Tagesdialog als
„(Qualifikation fehlt)" und wird von der automatischen Planung nicht für
diese Dienstart berücksichtigt. Ein leeres Feld bedeutet keine Einschränkung.

## Erweitertes Planungsregelwerk (LdF/FBL)

- **Nur qualifiziertes Personal**: LdF und FBL werden nur an Mitarbeiter mit
  den jeweils hinterlegten Qualifikationen vergeben; beide Funktionen
  gemeinsam nur an Personen mit beiden Qualifikationen.
- **Keine Ruhetagspflicht für Bereitschaftsfunktionen**: Da LdF/FBL als
  Bereitschafts- statt 24h-Dienste gelten, dürfen sie - anders als
  B-Dienst/C-Dienst - an aufeinanderfolgenden Tagen durch dieselbe Person
  wahrgenommen werden.
- **Wochenweise Rotation**: LdF/FBL werden nach Möglichkeit für eine ganze
  Kalenderwoche (Montag bis Sonntag) demselben Mitarbeiter zugeteilt statt
  täglich zu wechseln. Wird die Person im Laufe der Woche nicht verfügbar
  (z. B. Urlaub), springt die Planung automatisch fair auf jemand anderen um.

## Markierung „Leiter der Feuerwehr" / bevorzugte Führungsfunktion

In der Mitarbeitermaske kann ein Mitarbeiter als „Leiter der Feuerwehr /
bevorzugt für Führungsfunktionen (LdF, FBL) vorgesehen" markiert werden. Die
automatische Planung bevorzugt diese Person konsequent für LdF/FBL - auch
wenn sie qualifikationsseitig ebenso B-Dienst/C-Dienst übernehmen könnte.
In der Statistik wird bei dieser Person statt einer Soll/Ist-Abweichung ein
Hinweis „Führungsfunktion" angezeigt, und ihr (bewusst geringer)
Einsatzdienstanteil verfälscht nicht den Vergleichswert der übrigen
Mitarbeiter.

## Projektstruktur

```
index.html
css/
  style.css
js/
  database.js     – IndexedDB-Datenzugriff (alle Object Stores)
  holidays.js     – Feiertagsberechnung je Bundesland
  ui.js           – Navigation, Dialoge, Toasts, Formatierung
  employees.js    – Mitarbeiterverwaltung
  import.js       – Mitarbeiterimport aus Excel (.xlsx) und CSV
  vacation.js     – Urlaub/Krankheit/Fortbildung/Wunschfrei
  calendar.js     – Jahres-/Monatskalender mit Tageskarten
  presence.js     – abteilungsbezogene Anwesenheits-Mindestbesetzung
  yearplan.js     – druckbarer Jahresdienstplan je Mitarbeiter
  planner.js      – automatische Jahresdienstplanung
  statistics.js   – Auswertungen und Diagramme
  settings.js     – Einstellungen, Dienstarten, Export/Import
  app.js          – Initialisierung, Dashboard, Zusammenspiel aller Module
assets/           – für zukünftige Grafiken/Icons vorgesehen
data/             – für zukünftige lokale Referenzdaten vorgesehen
```

## Erweiterbarkeit

Die Anwendung ist bewusst modular und datenbankgestützt aufgebaut:

- **Dienstarten** (B-Dienst, C-Dienst, Verfüger, …) sind unter
  `Einstellungen → Dienstarten` frei konfigurierbar – neue Dienstarten
  erfordern keine Codeänderung.
- Es gibt keine im Code fest hinterlegten Mitarbeiterzahlen oder Namen.
- Für spätere Ausbaustufen (Abteilungs-/Qualifikationsbezug in der
  Planung, Teilzeitquoten, erweiterte Optimierung) ist das Datenmodell in
  `database.js` bereits vorbereitet (Felder `department`, `qualifications`,
  `partTimePercent`).

## Faire Verteilung von Wochenend-/Feiertagsdiensten

Bei der automatischen Planung hat der Ausgleich der Wochenend-/Feiertagslast
an Wochenend- und Feiertagen **Vorrang** vor der reinen Gesamtbelastung
(vorher wirkte er nur als Tiebreaker bei exakt gleicher Gesamtlast, was in
der Praxis selten vorkam und zu einer heterogenen Verteilung führte). An
normalen Werktagen zählt weiterhin die Gesamtbelastung. In einer
Jahressimulation mit 6 Mitarbeitern lag die Differenz zwischen dem am
häufigsten und am seltensten an Wochenenden/Feiertagen eingeteilten
Mitarbeiter danach bei nur noch 4 Diensten übers ganze Jahr.

## Organisationsstruktur (Abteilungen)

Unter `Einstellungen → Abteilungen` ist die Organisationsstruktur der
Feuerwehr hinterlegt (Code, Bezeichnung, übergeordnete Abteilung) – beim
ersten Start bereits mit der vollständigen Struktur aus Ihrem Organigramm
(5.0 bis 5.44) vorbefüllt und jederzeit erweiter-, umbenenn- und löschbar.
Mitarbeiter werden über ein Dropdown (statt Freitext) einer Abteilung
zugeordnet.

## Qualifikationskatalog

Unter `Einstellungen → Qualifikationen` gibt es einen zentralen, frei
erweiterbaren Katalog aller Qualifikationen (z. B. LdF, FBL, Atemschutz,
Gruppenführer). Sowohl in der Mitarbeitermaske (welche Qualifikationen hat
die Person) als auch im Dienstart-Dialog (welche Qualifikation wird
benötigt) wird aus diesem Katalog per Checkbox ausgewählt, statt Freitext zu
tippen – das verhindert Tippfehler und Karteileichen. Bereits vorhandene
Freitext-Qualifikationen aus einer älteren Version wurden beim Update
automatisch in den Katalog übernommen.

## Führungsdienstler vs. Sachbearbeitung

Nicht jeder Mitarbeiter im Organigramm gehört zum Führungsdienst. In der
Mitarbeitermaske gibt es dafür das Häkchen „Führungsdienstler – steht für
die automatische Dienstplanung (B-/C-Dienst, Verfüger, LdF, FBL) zur
Verfügung". Ist es **nicht** gesetzt, gilt die Person als reine
Sachbearbeitung: Sie taucht weder im Kalender noch in der automatischen
Jahresplanung auf, wird aber weiterhin normal in der Mitarbeiterverwaltung
geführt und ihre Abwesenheiten (Urlaub/Krankheit) bleiben erfasst – für die
später vorgesehene Anwesenheitsplanung je Abteilung.

## Sortierbare Mitarbeitertabelle

Wie die Belastungsübersicht in der Statistik lässt sich jetzt auch die
Mitarbeitertabelle durch Klick auf eine Spaltenüberschrift sortieren
(Name, Kürzel, Abteilung, Rolle, Qualifikationen, Resturlaub, Status).

## LdF/FBL prominent in der Belastungsübersicht

Die Spalten für LdF und FBL stehen jetzt direkt hinter den
Einsatzdienstarten (statt versteckt am Tabellenende) und sind weiterhin mit
„*" gekennzeichnet, da sie nicht in die Einsatzdienst-Statistik (Gesamt,
Soll/Ist) einfließen. Zusätzlich gibt es eine neue Spalte „Gesamt (inkl.
Führung)", die alle Dienste einer Person - Einsatzdienste und
Führungsfunktionen zusammen - aufsummiert.

## Kalender drucken (aktueller Monat)

Auf der Kalenderseite gibt es jetzt einen eigenen Button „Monat drucken /
als PDF speichern" direkt neben der Monats-/Jahresumschaltung. Er wechselt
bei Bedarf automatisch in die Monatsansicht und öffnet den
Browser-Druckdialog für genau diesen Monat, inklusive Kopfzeile mit
Feuerwehrname und Zeitraum. Der bisherige Button unter „Einstellungen" war
fehlerhaft (er druckte die Einstellungsseite statt des Kalenders) - das ist
jetzt behoben; er springt zunächst zum Kalender und druckt danach den dort
aktuell angezeigten Monat.

## Manuelle prozentuale Verteilung auf Dienstarten

In der Mitarbeitermaske gibt es jetzt den Bereich „Verteilung auf
Dienstarten (%)". Dort kann für jede Dienstart ein Zielanteil (bezogen auf
die persönlichen Dienste dieses Mitarbeiters) hinterlegt werden, z. B.
70 % Verfüger und 30 % C-Dienst. Nicht ausgefüllte Dienstarten teilen sich
den verbleibenden Anteil automatisch gleichmäßig auf. Die automatische
Planung versucht, diese Zielverteilung einzuhalten (nach dem gleichen
Höchstzahlverfahren, das auch bei Sitzverteilungen verwendet wird), ohne
dabei die Gesamtbelastungsfairness zwischen den Mitarbeitern oder die
Wochenend-/Feiertagsfairness zu verletzen - bei einem Konflikt zwischen
beiden hat die bereits bestehende Wochenend-/Feiertagsfairness weiterhin
Vorrang. Die Quote ist daher eine starke Steuerungspräferenz, keine exakte
Garantie (in Tests wurden ca. 90 % des hinterlegten Zielwerts erreicht).

## Benutzerhandbuch (PDF)

Im Projektordner liegt `Benutzerhandbuch.pdf` – ein ausführliches, bebildertes
Handbuch, das alle Funktionsbereiche der Anwendung sowie das komplette
Regelwerk der automatischen Dienstplanung im Detail erklärt (inklusive der
Reihenfolge, in der die einzelnen Regeln gegeneinander abgewogen werden).
Empfehlenswert für neue Nutzer und als Nachschlagewerk.

## LdF/FBL: Team-Anteilsmodell für Leiter und Stellvertreter

Bisher hatte die als „Leiter der Feuerwehr" markierte Person bei LdF/FBL
einen **absoluten** Vorrang – Stellvertreter kamen nur zum Zug, wenn der
Leiter abwesend war, selbst wenn für sie eine eigene Quote hinterlegt war.
Das ist jetzt korrigiert: Für LdF/FBL gilt ein Team-Anteilsmodell –
explizit hinterlegte Stellvertreter-Quoten (z. B. „Stellvertreter 20 %")
werden tatsächlich ganzjährig eingeplant, nicht nur während der Abwesenheit
des Leiters. Der nach Abzug dieser Quoten verbleibende Anteil geht
automatisch an die als Leiter markierte Person, die dadurch weiterhin die
meisten Dienste übernimmt. In einer Jahressimulation (Leiter ohne eigene
Quote, zwei Stellvertreter mit je 20 %) ergab sich eine tatsächliche
Verteilung von 55 % / 23 % / 22 % – vorher wären es de facto 100 % / 0 % / 0 %
gewesen (abgesehen von Abwesenheitstagen des Leiters).

## Druckoptimierung: Monat auf eine A4-Seite (Querformat)

Das Druckformat des Kalender-Monatsausdrucks ist jetzt auf DIN A4 quer
optimiert. Ein kompletter Monat – ob vier, fünf oder sechs Kalenderwochen –
passt zuverlässig auf eine einzige Seite, durch eine kompaktere
Druckdarstellung der Tageskarten und ein Layout, das die verfügbare
Seitenhöhe automatisch vollständig ausnutzt.

## Versionsstand

Version 1.14.0, Build 18, Stand 2026-07-20.

## Sortierbare Abwesenheitstabelle (v1.14.0)

Wie die Mitarbeiter- und Belastungsübersichtstabelle lässt sich jetzt auch
die Tabelle unter „Urlaub & Abwesenheit" durch Klick auf eine
Spaltenüberschrift sortieren.

## Feiertage grau hinterlegt, Abwesenheiten aus Kalenderdruck entfernt (v1.14.0)

Feiertage erhalten im Kalender jetzt zusätzlich zum roten Rahmen dieselbe
graue Hinterlegung wie Wochenenden. Im Monatsdruck werden Abwesenheits-Tags
auf den Tageskarten nicht mehr angezeigt, da bei vielen gleichzeitigen
Abwesenheiten nicht alle auf die kleine Druckfläche passten. Der
Hinweistext zum Querformat wurde auf Wunsch entfernt.

## Abteilungskorrektur: WV 1 / WV 2 (v1.14.0)

Die zuvor als eigene Unterabteilungen 5.121/5.122 angelegten „WV 1"/„WV 2"
waren ein Modellierungsfehler – tatsächlich sind das zwei gleichberechtigte
FGL-Positionen (Personen) direkt in Fachgruppe 5.12, keine eigenen
Abteilungen. Das ist jetzt korrigiert; zuvor dort zugeordnete Mitarbeiter
werden automatisch auf 5.12 direkt umgehängt.

## Wachabteilungs-Rotation (v1.14.0)

Neues Modul `wachabteilung.js` berechnet, welche der vier Wachabteilungen
(WA I–IV) an einem Tag im 24h-Tagesdienst ist, nach dem Muster
„24h-Dienst → 1 Tag frei → 24h-Dienst → 5 Tage frei → von vorn" (8-Tage-
Rhythmus, mathematisch hergeleitet aus dem Muster und dem Fixpunkt
1.1.2026 = WA IV). Wird angezeigt als Badge auf den Kalender-Tageskarten,
im Tagesdialog und als kleines Kürzel je Tag im Jahresdienstplan-Ausdruck.
Die Untergruppen je Wachabteilung (z. B. WA I-1) werden bewusst NICHT
abgebildet, da deren Personal für die Führungsdienstplanung aktuell keine
Rolle spielt (siehe Hinweis unten).

## Jahresdienstplan-Druck: Farbdesign und Layout-Korrektur (v1.14.0)

- Dienstarten werden jetzt farbig entsprechend ihrer im Kalender
  hinterlegten Farbe dargestellt (Textfarbe + farbiger linker Rand je
  Zelle), nicht mehr nur als schwarzer Text.
- Der Druckbereich wurde korrigiert: vorher wurde der rechte Rand leicht
  abgeschnitten (jetzt symmetrisch ca. 3 % Rand beidseitig) und die
  verfügbare Seitenhöhe im Querformat wird jetzt zu ca. 90 % ausgenutzt
  (vorher ca. 74–84 %), durch ein Flex-basiertes Höhenlayout statt fester
  Zeilenhöhen.
- Verifiziert per Farbhistogramm-Analyse des gerenderten PDFs (u. a.
  Dienstart-Farben, Gelb- und Grau-Hervorhebung eindeutig unterscheidbar
  nachgewiesen).

## Hinweis für später: vollständige Wachabteilungs-Struktur

Die Fachgruppe 5.12 wird strukturell von den zwei gleichberechtigten
Wachvorstehern (WV 1/WV 2) geleitet; darunter existieren real die vier
Wachabteilungen (WA I–IV) mit je zwei Untergruppen (z. B. WA I-1, WA I-2)
und eigenem Personal. Dieses Personal ist für die aktuelle
Führungsdienstplanung nicht relevant und wird daher bewusst nicht als
eigene Mitarbeiter-Abteilungszuordnung abgebildet. Das wäre für einen
späteren Ausbauschritt interessant (vollständige Wachabteilungs-
Personalplanung inkl. Untergruppen) – dafür wird aber zunächst die im
Architekturkonzept beschriebene Variante mit zentralem Server-Zugriff und
mehreren Benutzerrollen benötigt, da eine Wachabteilungs-Dienstplanung
sinnvollerweise von anderen Personen gepflegt würde als der
Führungsdienstplan.

## Jahresdienstplan je Mitarbeiter drucken (v1.13.0)

In der Mitarbeitertabelle gibt es jetzt pro Zeile einen Druckbutton
(Kalender-Symbol) „Jahresdienstplan drucken". Er erzeugt eine eigene
Druckansicht im DIN-A4-Querformat: Monate als Zeilen, Kalendertage 1 bis 31
als Spalten, mit der jeweils zugewiesenen Dienstart (Kürzel) bzw.
Abwesenheitsart (U/K/F/W) je Tag.

Zwei Hervorhebungen:
- **Hellgrau** (dieselbe Farbe wie im Kalender) für Wochenenden und
  gesetzliche Feiertage.
- **Gelb** für Tage, an denen der Mitarbeiter planerisch der **einzige
  anwesende Mitarbeiter seiner Abteilung** (inkl. Unterabteilungen) ist –
  berechnet über dasselbe Anwesenheitsmodul wie die Abteilungs-Mindest-
  besetzung (siehe oben), inklusive der Beschränkung auf gewöhnliche
  Werktage ohne Feiertage.

Getestet inklusive Farbanalyse des gerenderten PDFs: Die gelbe und graue
Hervorhebung rendern zuverlässig und eindeutig unterscheidbar; Tage, an
denen der Mitarbeiter selbst abwesend ist, werden korrekt nicht gelb markiert.

## Überarbeitung Abteilungs-Anwesenheitsregel (v1.12.0)

Nach einem klareren Organigramm wurde die Regel korrigiert und präzisiert:
- **Neue Struktur:** Fachdienst 5.1/5.2 als Rückfallebene ohne eigene
  Mindestbesetzung, darunter die eigentlichen Fachgruppen (5.11-5.14,
  5.21-5.23, 5.3, 5.4) mit `minPresence: 1`. Fachgruppe 5.12 „Wachabteilungen"
  hat jetzt korrekt zwei Unterabteilungen (WV 1, WV 2).
- **Rückfallebene statt Einzelfall-Sonderregel:** Ist eine Fachgruppe
  komplett unbesetzt, gilt die Regel dennoch als erfüllt, wenn mindestens
  eine anwesende Person **direkt** einer übergeordneten Abteilung zugeordnet
  ist (z. B. der Fachdienstleiter selbst). Das ersetzt die frühere, auf
  Einzelpersonen-Abteilungen beschränkte Sonderregel durch einen
  allgemeineren Mechanismus.
- **Weiche Ausnahme:** Fachgruppe 5.3 (nur 2 Mitarbeiter) erzeugt bei
  Unterbesetzung nur einen informativen Hinweis statt einer harten Warnung –
  neu über das Häkchen „Weiche Ausnahmeregel" pro Abteilung einstellbar.
- **Nur Werktage:** Die Regel greift jetzt ausschließlich Montag bis
  Freitag – an Wochenenden und gesetzlichen Feiertagen wird nicht geprüft.

Alle Fälle wurden mit gezielten Testszenarien verifiziert (echte Lücke ohne
Rückfallmöglichkeit → Warnung; Lücke mit Vorgesetztem anwesend → keine
Warnung; Wochenende/Feiertag → keine Prüfung; Fachgruppe 5.3 → nur Hinweis).

## Qualifikationsbezogene Überschneidungsprüfung bei Urlaub (v1.12.0)

Unter `Einstellungen → Qualifikationen` lässt sich jetzt pro Qualifikation
eine eigene Obergrenze für gleichzeitigen Urlaub hinterlegen (z. B. „LdF":
max. 1) – zusätzlich zur weiterhin bestehenden globalen Einstellung. Damit
lässt sich ein kleiner Führungspool (z. B. 3 Personen mit LdF-Qualifikation)
gezielt schützen, ohne die allgemeine Grenze für die gesamte Belegschaft
künstlich niedrig ansetzen zu müssen. Die Warnung unter „Urlaub &
Abwesenheit" zeigt jetzt zusätzlich an, welche Grenze (global oder welche
Qualifikation) überschritten wurde.

## Duplikate beim Abwesenheits-Import werden übersprungen (v1.12.0)

Beim Import aus Excel/CSV werden Zeilen automatisch übersprungen, wenn für
denselben Mitarbeiter, dieselbe Abwesenheitsart und einen sich
überschneidenden Zeitraum bereits ein Eintrag existiert – sowohl gegenüber
bereits gespeicherten Abwesenheiten als auch innerhalb derselben
Importdatei. Die Vorschau zeigt an, wie viele Zeilen als Duplikat
übersprungen wurden.

## Druck-Nachbesserung (v1.10.0)

Nach Rückmeldung wurden drei konkrete Probleme des Monatsdrucks behoben:
- Eine überschüssige Lücke zwischen der Wochentagszeile und der ersten
  Kartenreihe (Ursache: die Wochentagszeile wurde fälschlich genauso hoch
  wie eine volle Kalenderwoche skaliert) ist entfernt; die Kartenraster-Höhe
  wird jetzt zusätzlich dynamisch an die tatsächliche Wochenzahl des
  jeweiligen Monats angepasst (4-6 Wochen), wodurch die Seite noch besser
  ausgenutzt wird (ca. 84-87 % Seitenhöhe statt vorher unnötigem Leerraum).
- Der Abstand zwischen Dienstart-Kürzel (z. B. „B", „LdF") und Mitarbeitername
  in den Tageskarten wurde vergrößert, damit beide nicht mehr ineinanderlaufen.
- Da nicht jeder Browser das per CSS hinterlegte Querformat automatisch im
  Druckdialog vorauswählt, gibt es auf der Kalenderseite jetzt einen
  Hinweistext, das Querformat notfalls manuell im Druckdialog zu wählen.

## Abteilungsbezogene Anwesenheits-Mindestbesetzung (v1.11.0, Regel 6–8)

Umgesetzt und getestet. Unter `Einstellungen → Abteilungen` lässt sich pro
Abteilung festlegen:
- **Mindestens anwesend** (Zahl, 0 = keine Regel) – Regel 6, z. B. für
  5.1/5.2/5.3 auf 1 gesetzt.
- **„…dürfen keine Dienstart übernommen haben"** – Regel 7, zusätzlich für
  die dafür vorgesehenen Unterabteilungen (5.11, 5.13, 5.14, 5.21, 5.22,
  5.23, 5.3) aktiviert.

Die Prüfung bezieht dabei automatisch den kompletten Abteilungs-Teilbaum
ein: Ein Mitarbeiter einer Unterabteilung (z. B. „SB 5.111") zählt auch für
die Mindestbesetzung der übergeordneten Abteilung („FGL 5.11") mit.
Zusätzlich greift **Regel 8** vollautomatisch und ohne gesonderte
Einstellung: Hat eine Abteilung nur genau einen zugeordneten Mitarbeiter und
ist dieser abwesend, prüft die Anwendung, ob eine unverplante, anwesende
Person aus einer übergeordneten Abteilung einspringen könnte.

Verstöße erscheinen an drei Stellen:
- Als eigene Karte „Abteilungs-Anwesenheit" auf dem **Dashboard** (nächste
  14 Tage).
- Als Hinweis „Abteilung unterbesetzt" direkt auf den betroffenen
  **Kalender-Tageskarten**.
- Ausführlich im **Tagesdialog** des Kalenders bei Klick auf den jeweiligen
  Tag.

Wichtig: Diese Regel ist bewusst als **Warnung**, nicht als harte Blockade
umgesetzt – die automatische Dienstplanung berücksichtigt sie aktuell nicht
aktiv bei der Verteilung, sondern zeigt lediglich auf, wo die
Mindestbesetzung nicht erreicht wird. Das lässt sich bei Bedarf als
nächster Ausbauschritt ergänzen.

## Ausblick: Netzlaufwerk-Speicherung und Zugangsprofile

Siehe separates Architekturkonzept-Dokument (`Architekturkonzept.pdf`): Eine
Speicherung auf einem Netzlaufwerk sowie unterschiedliche Zugangsprofile
(Dienstplaner vs. einfacher Mitarbeiter) sind mit der aktuellen,
rein clientseitigen Architektur (kein Server, kein Login) nicht sinnvoll
umsetzbar, ohne die Grundprinzipien der Anwendung (Offline-Fähigkeit ohne
Installation, keine Serverabhängigkeit) zu verändern. Für einen echten
Mehrbenutzerbetrieb mit Rollen und zentraler Speicherung wird ein leichter
Server-Baustein benötigt – die Möglichkeiten dazu sind im Architekturkonzept
dokumentiert, aber noch nicht umgesetzt.
