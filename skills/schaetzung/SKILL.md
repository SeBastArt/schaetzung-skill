---
name: schaetzung
description: Use when eine Aufwandsschätzung als interaktive HTML-Seite für die Kundendiskussion erstellt oder gepflegt werden soll — Trigger: "Aufwandsschätzung", "Schätzung als Seite/HTML", "PT-Schätzung", "Dreipunktschätzung", "Angebotskalkulation", "Scope-Gespräch mit dem Kunden", "A/K/X", effort estimate page, estimation breakdown. Auch beim Ändern einer bestehenden schaetzung-build.js.
---

# Interaktive Aufwandsschätzung (Kundendiskussions-Seite)

## Overview

Erzeugt aus einer Datenbasis (Blöcke → Positionen mit Dreipunktwerten und Herkunft/Annahme/Risiko)
ein **selbstständiges HTML** zum gemeinsamen Durchgehen mit dem Kunden: Summen, Spanne und PERT
werden berechnet, je Position gibt es A/K/X-Zuordnung (Anbieter macht es / Kunde macht es / gestrichen),
**Wertauswahl** (min / wahrscheinlich / max anklicken oder eigenen PT-Wert eintragen — Block-,
Gruppen- und Gesamtsummen ziehen live nach), **Angebotssumme** (nur A + offen, K/X ausgenommen, Projektleitung als änderbarer Prozentsatz — KPIs, Summenband, Überschrift und Erklärsatz folgen), Kommentarfelder, JSON-Import/-Export, Excel-Export
(.xlsx) und PDF-Druck mit Zeitstempel.

**Kernprinzip: Das HTML wird nie von Hand editiert.** Daten ändern → `node schaetzung-build.js`
→ Ausgaben regenerieren sich. Erprobt in einem realen Angebotsprojekt.

## When to Use

- Schätzung soll mit dem Kunden **diskutierbar** sein (Scope-Schnitte, Streichungen, Zuordnung)
- Positionen brauchen **Herleitung** (Herkunft der Anforderung, Annahmen, Risiken)
- Mitwirkungsleistungen des Kunden (B-Bedingungen) sind Teil der Kalkulation

**Nicht verwenden für:** schnelle Zahlentabellen (→ Markdown) · Architekturmodelle (→ Skill `c4`).
Typischer Upstream: Der `c4`-Skill liefert Architektur und Design Decisions, aus denen die
Blöcke abgeleitet werden — die Schätzung funktioniert aber auch ohne C4.

## Vorgehen

1. `templates/schaetzung-build.js` **ins Projekt kopieren** (self-contained: CSS + Script inline).
   Die Ausgabedateien entstehen **neben dem Script** (`__dirname`).
2. Anpassen — nur die drei markierten Abschnitte:
   - `KONFIG`: Titel, Eyebrow, `speicherKey` (**zwingend eindeutig je Schätzung** — trennt den
     Browser-Speicherstand und das JSON-Format; sonst überschreiben sich zwei Schätzungen unter
     derselben Adresse), `wirLabel`/`kundeLabel` (A/K-Beschriftung), `gateBlock`, `plGruppe`,
     Hinweistexte, `ausgaben`
   - `BLOCKS`: `{ group, title, pt, note?, pos: [[name, [min,ml,max], herkunft, annahme|null, risiko|null], …] }`
   - `CONDITIONS`: Mitwirkungsleistungen `['B1', 'Text']`
3. `node schaetzung-build.js`
4. Prüfen (siehe Checkliste)

**GATE 1** ist der empfohlene erste Umsetzungsschritt, der die größten technischen Risiken früh
misst (Spezifikation + gemessener Durchstich). `gateBlock` auf den Titel dieses Blocks setzen —
oder `null` lassen, wenn das Projekt kein solches Gate hat.

## Datenregeln

| Regel | Wirkung |
|---|---|
| `pt` je Block = Summe der ml-Werte seiner Positionen | sonst **harter Build-Abbruch** (gewollt — fängt verschobene Positionen). Gilt auch für die PL-Gruppe: sie braucht mindestens eine Position mit Dreipunktwerten |
| Gruppe `KONFIG.plGruppe` | erscheint nur im Summenband + Erklärsatz, nie als Block; zählt in Gesamt/Spanne/PERT mit. Faustregel ~14 % der Umsetzungsleistung — der Konsolen-Output weist den Ist-Anteil aus |
| Abweichung min oder max > 5 PT vom ml-Wert | PT-Pille automatisch leicht rot |
| Texte in `BLOCKS`/`CONDITIONS` werden escaped | kein HTML dort. In `KONFIG` sind `eyebrow`, `untertitel`, `metaHtml`, `kalkulationsmodellHtml`, `schlussHtml`, `fusszeile` **rohes HTML**; escaped werden nur `titel`, `dokumentTitel`, `mitwirkungTitel`, `gateBlock`, `wirLabel`, `kundeLabel` |
| `gateBlock` muss exakt einem Blocktitel entsprechen | sonst harter Build-Abbruch; die Blocknummer im Erklärsatz wird automatisch ermittelt |
| Mehrere `ausgaben` | identische Kopien (z. B. Master + Präsentationsdatei mit sprechendem Namen) |
| Wertauswahl je Position | Standard ist der wahrscheinliche Wert; nur Abweichungen werden gespeichert (`werte[k]={m:'min'|'max'|'eigen', e?}`) |
| Angebotssumme (live) | zählt nur Positionen mit **A oder ohne Zuordnung** zu den gewählten Werten; K und X sind ausgenommen; die PL-Gruppe wird **anteilig** nachgezogen — Prozentsatz im Eingabefeld über der Tally-Zeile (Vorgabe `plPt / Positionen-PT` aus dem Build; abweichender Wert wird gespeichert, steht im JSON als `projektleitungProzent` und in der Excel-PL-Formel). Sobald etwas abweicht, zeigen KPI-Kacheln (Gesamt, Spanne), Summenband und Legende den gewählten Zuschnitt, unter dem Band erscheint eine Tabelle je Anteil (Schätzung · Angebot · Differenz, Summenzeile), und Abschnittsüberschrift („So setzt sich das Angebot von … zusammen") sowie die `<span class=st data-k=…>`-Stellen im Erklärsatz (direkt, pct, pl, gate, gesamt) werden nachgezogen; ohne Abweichung erscheint die Originalansicht |
| JSON-Format | `<speicherKey>-auswahl`, `version: 2` — enthält `auswahl`, `werte`, `kommentare`, `summen` (inkl. `angebot`: direkt, projektleitung, gesamt, Spanne, nicht enthaltene K/X) und je Position `ptMin/ptWahrscheinlich/ptMax/wertModus/ptGewaehlt`. Dateien ohne `werte` werden akzeptiert (Werte = Standard) |
| Excel-Export | echtes .xlsx ohne Bibliothek (ZIP ohne Kompression + SpreadsheetML): Blatt „Positionen" (filterbar, fixierte Kopfzeile, Spalte „Gewählt PT (Angebot)" nur für A/offen, K/X-Werte in „PT bei K/X (nicht angeboten)" direkt neben der Zuordnung, danach Kommentar; Summenzeilen „Summe Positionen", PL anteilig per ROUND-Formel, „Gesamt") + Blatt „Info" (Dokument, Zeitpunkt, Summen, Legenden). Dateiname `<speicherKey>-<Datum>.xlsx` |

## Konsistenzregeln (aus Kundenrückmeldungen — nicht verhandelbar)

Die Seite zeigt **zwei Zahlenwelten**: die *Schätzung* (wahrscheinliche Werte, alle Positionen,
PL-Vorgabe) und das *Angebot* (gewählter Zuschnitt). Jede angezeigte Zahl muss eindeutig einer der
beiden gehören, und **alles, was zum Angebot gehört, folgt jeder Änderung live** — A/K/X, Wertauswahl
und PL-Prozentsatz.

| Regel | Warum |
|---|---|
| **Angebot = Positionen mit A oder ohne Zuordnung** zu den gewählten Werten **+ Projektleitung anteilig** (Prozentfeld). K und X zählen nie ins Angebot | Kundenbefund: K/X landeten in der Summe, KPIs blieben stehen — „da geht man vom Falschen aus" |
| Alles Sichtbare läuft mit: KPI-Kacheln, Summenband + Legende, Tabelle je Anteil, Abschnittsüberschrift, `<span class=st>`-Stellen im Erklärsatz, Summenleiste bei den Positionen, JSON, Excel | Ein einziger statischer Wert neben Live-Werten wirkt wie ein Rechenfehler |
| Keine Summe ohne Basis: jede Zahl sagt, worüber sie summiert („alle Positionen" vs. „A + offen", „ohne PL" vs. „inkl. PL") | Die Zeile „Σ gewählt 534 PT / Angebot 503 PT" nebeneinander verstand niemand |
| Summenleiste ist eine **Rechnung von oben nach unten**: Positionen im Angebot → + PL → = Angebotssumme; darunter „Nicht im Angebot: K · X" | Lesbarkeit im Kundengespräch |
| PL ist ein **Prozentsatz**, kein Fixwert — Vorgabe aus den Daten (`plPt / Positionen-PT`), im Feld änderbar, gespeichert, im JSON (`projektleitungProzent`) und in der Excel-Formel | Der Kunde will den Satz diskutieren, nicht unsere Faustregel übernehmen |
| Excel: Spalte „Gewählt PT (Angebot)" enthält **nur** angebotene Positionen; K/X-Werte stehen daneben in „PT bei K/X (nicht angeboten)"; keine redundanten Textspalten; Summenzeilen Positionen / PL / Gesamt per Formel | Wer das Excel weiterreicht, darf nicht erst Spalten interpretieren müssen |
| Erklärtexte ohne Rechenformeln wiederholen, die Legende/Tabelle schon zeigen | doppelte Zahlen veralten zuerst |

**Gestaltung:** Alle Boxen im selben Card-Stil (`.card`-Variablen: weiß, 16px-Radius, Schatten) —
keine grauen Sonderflächen. KPI-Raster hat genau so viele Spalten wie Kacheln (3). Tagesaktuelle
Nachträge gehören **nicht** in den Kopf der Seite (`metaHtml` nur für dauerhafte Hinweise) —
Änderungshistorie in die Block-Notiz oder die Mitwirkungsleistung, die sie betrifft.

## Prüf-Checkliste nach jedem Build

```bash
node schaetzung-build.js   # muss ohne Blocksummen-Fehler durchlaufen; Konsole zeigt Summen + PL-Anteil
```

**Statisch (für Agenten ausreichend, solange Abschnitt 3 „MECHANIK" unangetastet blieb —
die Interaktionsmechanik ist erprobt):** per node/grep gegen das erzeugte HTML prüfen:
Gesamtsumme und Spanne der KPIs · Anzahl `<input type=checkbox>` = gerenderte Positionen × 3 ·
Anzahl `class=w data-m=min` und `class=eigen` = gerenderte Positionen ·
`pv spread` genau an den Positionen mit > 5 PT Abweichung · `data-pl-rate` am `.kpis`-Container
= plPt / Positionen-PT · `id=pl-pct`, `id=sum-live`, `id=sec-sum-h` vorhanden · `KONFIG.speicherKey`
erscheint als `KEY='…'`, im JSON-Format und im xlsx-Dateinamen · kein Rest eines fremden
Projektnamens · das eingebettete Script parst (`new Function(scriptText)`).

**Interaktiv (Browser, wenn verfügbar — per DevTools/Extension, nicht headless mit Fremdbrowsern):**
1. Frischer Stand: KPI = Schätzwert, Überschrift „So setzen sich die N PT zusammen", Tabelle unter
   dem Band ausgeblendet, PL-Feld zeigt die Vorgabe.
2. Eine Position auf **K**, eine auf **X**, eine auf **max**: KPI „Gesamt" und Spanne sinken/steigen
   passend, Band/Legende zeigen „388 → 375 PT", Tabelle Schätzung · Angebot · Differenz erscheint,
   Überschrift wird „So setzt sich das Angebot von … zusammen", Summenleiste rechnet
   Positionen + PL = Angebotssumme, „Nicht im Angebot" nennt K/X.
3. **PL-Prozent ändern** (z. B. 20): PL-Zeile, KPI, Tabelle, Erklärsatz (Prozent, PL-PT, Gate, Gesamt)
   folgen; Feld leeren → Vorgabe.
4. Reload: Stand bleibt. Alles zurücksetzen → exakt die Originalansicht.
5. JSON-Export enthält `summen.angebot` und `projektleitungProzent`; Import stellt alles wieder her.
6. Excel (in echtem Excel öffnen, keine Reparaturmeldung): Spalte I leer bei K/X, Spalte K gefüllt,
   Summenzeilen = Werte der Seite (Positionen / PL per `ROUND(I*rate)` / Gesamt).
7. Werkzeugleiste: „Exportieren ▾" (PDF · Excel), „JSON ▾" (Exportieren · Importieren) öffnen nach
   oben, schließen bei Klick außerhalb/Escape. Druckbild: Zeitstempel, Auswahl, gewählte Werte
   unterstrichen, PL-Prozent sichtbar.

## Common Mistakes

- **Ausgabe-HTML editieren** statt Generator — nächster Build überschreibt alles
- Blocksumme nach Positionsänderung nicht nachgezogen → Build-Abbruch ist die Diagnose, kein Bug
- Backticks oder `${` in Datentexten → bricht das Template-Literal; Apostroph `'` in Strings escapen
- **Neue Zahl auf der Seite, die nicht an `tally()`/`paintTop()` hängt** — jede Summe, Überschrift
  oder Erklärzahl, die vom Zuschnitt abhängt, braucht einen Live-Pfad (siehe Konsistenzregeln)
- `type=number`-Felder bekommen Werte mit **Punkt** (`'13.6'`), nie mit Komma — sonst bleiben sie leer
- Mechanik-Code liegt in einem Template-Literal: dort kein `${` und kein Backtick; bei Patches per
  Skript Ersatztexte als Funktion übergeben (`s.replace(a, () => b)`), sonst zerlegt `$` den Text
- Skalierende Querschnitte (PL) nach Datenänderung: Vorgabe wird aus den Daten berechnet, der
  Konsolen-Output zeigt den Ist-Anteil — die PL-Position in den Daten trotzdem nachziehen
- localStorage der Seite ist **pro Browser und Adresse** (file:// vs. localhost = getrennte Stände);
  Übergabe zwischen Rechnern läuft über den JSON-Export
