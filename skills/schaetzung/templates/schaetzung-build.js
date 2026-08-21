// Generator für eine interaktive Aufwandsschätzungs-Seite (ein selbstständiges HTML).
// Anpassen: KONFIG + BLOCKS + CONDITIONS. Dann: node schaetzung-build.js
// Alles Weitere (Summen, Spanne, PERT, Summenband, 5-PT-Markierung, A/K/X-Checkboxen, Wertauswahl
// min/wahrscheinlich/max/eigen, Kommentare, JSON-Import/-Export, Excel-Export, PDF-Druck) wird aus den Daten berechnet.
const fs = require('fs');
const path = require('path');

// ═══════════════════════ 1. KONFIGURATION ═══════════════════════
// Rohes HTML erlaubt in: eyebrow, untertitel, metaHtml, kalkulationsmodellHtml, schlussHtml,
// fusszeile. Escaped werden: titel, dokumentTitel, mitwirkungTitel, gateBlock, wirLabel, kundeLabel.
const KONFIG = {
  eyebrow: 'Kunde · Projekt · Stand TT.MM.JJJJ',
  titel: 'Aufwandsschätzung mit Herleitung',
  untertitel: 'Jede Position mit Zahl (min · wahrscheinlich · max), Herkunft der Anforderung, getroffenen Annahmen und erkannten Risiken.',
  // Optionaler Hinweis unter dem Titel (HTML), z. B. für Nachträge — '' = keiner:
  metaHtml: '',
  // Eindeutiger Schlüssel je Projekt — trennt localStorage-Stand und JSON-Format.
  // ZWINGEND je Schätzung ändern, sonst überschreiben sich zwei Schätzungen unter derselben Adresse:
  speicherKey: 'projekt-schaetzung',
  // Beschriftung der A/K/X-Zuordnung (wer ist „wir", wer ist der Kunde):
  wirLabel: 'Anbieter',       // eigenen Firmennamen eintragen
  kundeLabel: 'Kunde',
  // Blocktitel, der das GATE-1-Tag trägt (erster Umsetzungsschritt, der die größten
  // Risiken früh misst) — null = kein Gate. Bewusst kein Default-Titel, damit das Tag
  // nie durch zufällige Titelgleichheit erscheint:
  gateBlock: null,
  // Gruppe, die NUR im Summenband erscheint (läuft über die Laufzeit, kein Positionsblock):
  plGruppe: 'Projektleitung & Product Owner',
  mitwirkungTitel: 'Mitwirkungsleistungen des Kunden',
  kalkulationsmodellHtml: '<b>Kalkulationsmodell:</b> Jede Position enthält Implementierung, <b>Tests</b> und <b>Deployment</b> („fertig“ im Sinne der Definition of Done); keine Position ist ein reines Entwicklungsbudget. Personentage à 8 Stunden, ohne Preise.',
  // Optionaler Schluss-Callout (HTML) — '' = keiner:
  schlussHtml: '<b>Grundlage dieser Schätzung:</b> [Anforderungsquellen, Plattformvorgaben, Vorleistungen hier benennen].',
  fusszeile: 'Direkte PT je Position. Generator: schaetzung-build.js — Daten ändern, neu bauen, nie das HTML editieren.',
  dokumentTitel: 'Aufwandsschätzung',
  // Ausgabedateien (identischer Inhalt, z. B. Master + Präsentationskopie):
  ausgaben: ['schaetzung.html']
};

// ═══════════════════════ 2. DATEN ═══════════════════════
// Block:    { group, title, pt, note?, pos: [Position, …] }
//           pt MUSS der Summe der wahrscheinlichen Positionswerte entsprechen (harter Check).
// Position: [name, [min, wahrscheinlich, max], herkunftHtmlText, annahme|null, risiko|null]
// Die Gruppe aus KONFIG.plGruppe wird nicht als Block gerendert — nur Summenband + Erklärsatz.
const BLOCKS = [
{ group: 'Grundleistungen', title: 'Projektstart & Spezifikation', pt: 18, pos: [
  ['Kick-off und Anforderungsworkshops', [5,8,12],
   'Beispiel-Herkunft: Wer fordert das? (Anforderungs-ID, Kundenantwort, Norm …)',
   'Beispiel-Annahme: Was wird vorausgesetzt, damit die Zahl hält?',
   'Beispiel-Risiko: Was kann die Zahl kippen?'],
  ['Feinspezifikation zu Stories', [7,10,15],
   'Beispiel-Herkunft ohne Annahme und Risiko.', null, null]
]},
{ group: 'Fachliche Leistungen', title: 'Beispiel-Feature', pt: 20, pos: [
  ['Umsetzung inkl. Tests', [10,14,22],
   'Herkunft der Anforderung.',
   'Annahme zur Kalkulation.', null],
  ['Anbindung Umsystem', [4,6,9],
   'Herkunft.', null,
   'Vertrag des Umsystems unbekannt — Adapter begrenzt den Schaden.']
]},
{ group: 'Projektleitung & Product Owner', title: 'Projektleitung & Product Owner', pt: 5, pos: [
  ['Projektsteuerung, Abstimmung, Product-Owner-Funktion', [4,5,8],
   'Querschnittsleistung über die gesamte Laufzeit, angesetzt mit ~14 % der Umsetzungsleistung.',
   'Skaliert mit dem Umsetzungsumfang.', null]
]}
];

// Mitwirkungsleistungen des Kunden — Grundlage der Kalkulation.
// Kippt eine Bedingung, werden die abhängigen Positionen neu bewertet.
const CONDITIONS = [
 ['B1','Fachliche Ansprechpartner sind im Projektzeitraum verfügbar'],
 ['B2','Zielplattform und Zugänge stehen zum Kick-off bereit']
];

// ═══════════════════════ 3. MECHANIK (nicht anpassen) ═══════════════════════
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const de = n => n.toLocaleString('de-DE');
const trip = t => `<span class=w data-m=min title="Minimum übernehmen">${t[0]}</span> · <span class="w on" data-m=ml title="Wahrscheinlichen Wert übernehmen">${t[1]}</span> · <span class=w data-m=max title="Maximum übernehmen">${t[2]}</span> · <input class=eigen type=number min=0 step=1 placeholder=eigen title="Eigener Wert in PT — überschreibt die Auswahl">`;

const CSS = `
:root{
  --bg:#f5f7fa; --surface:#ffffff; --surface2:#fbfcfe;
  --ink:#141a22; --ink2:#4d5867; --muted:#8b95a3; --line:#e7ebf1;
  --accent:#2563eb; --accent-d:#1b4dc2; --accent-l:#7ea6f2;
  --track:#eef2f8; --likely:#e07b2c; --likely-ring:#ffffff;
  --good:#0f7b52; --good-bg:#e7f4ee; --warn:#8a6300; --warn-bg:#fbf1d9;
  --ser:#b0442b; --ser-bg:#fbe9e3;
  --shadow:0 1px 2px rgba(20,26,34,.04),0 6px 24px rgba(20,26,34,.06);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:40px 24px 72px}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
h1{font-size:30px;line-height:1.15;margin:6px 0 6px;letter-spacing:-.01em}
.sub{color:var(--ink2);font-size:15px;margin:0}
.meta{color:var(--muted);font-size:13px;margin-top:10px}
header.page{padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:28px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:26px 0 8px}
@media(max-width:760px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 16px 14px;box-shadow:var(--shadow)}
.kpi .v{font-size:26px;font-weight:750;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.kpi .v small{font-size:14px;font-weight:600;color:var(--ink2)}
.kpi .k{font-size:12.5px;color:var(--ink2);margin-top:3px}
.kpi.accent{background:linear-gradient(180deg,#f3f7ff,#ffffff);border-color:#d6e3fb}
.kpi.accent .v{color:var(--accent-d)}
section{margin-top:34px}
.sectitle{display:flex;align-items:baseline;gap:10px;margin:0 0 14px}
.sectitle h2{font-size:19px;margin:0;letter-spacing:-.01em}
.sectitle .hint{color:var(--muted);font-size:13px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.phase{padding:6px 20px 2px}
.phase h3{font-size:13px;letter-spacing:.03em;text-transform:uppercase;color:var(--ink2);margin:16px 0 6px;font-weight:700}
.row{display:grid;grid-template-columns:1fr 260px 118px;align-items:center;gap:16px;padding:9px 20px;border-top:1px solid var(--line)}
.phase h3+.row,.row:first-child{border-top:0}
.row .name{font-size:14px}
@media(max-width:760px){.row{grid-template-columns:1fr;gap:6px}.row .nums{text-align:left}}
.bar{position:relative;height:12px;background:var(--track);border-radius:7px}
.bar .span{position:absolute;top:0;height:12px;border-radius:7px;
  background:linear-gradient(90deg,var(--accent-l),var(--accent));opacity:.9}
.bar .dot{position:absolute;top:50%;width:13px;height:13px;border-radius:50%;
  background:var(--likely);border:2.5px solid var(--likely-ring);
  transform:translate(-50%,-50%);box-shadow:0 1px 3px rgba(20,26,34,.25)}
.bar:hover .span{opacity:1}
.nums{font-variant-numeric:tabular-nums;text-align:right;font-size:13px;color:var(--muted);white-space:nowrap}
.nums b{color:var(--likely);font-weight:750;font-size:15px}
.nums .mm{color:var(--ink2)}
.ticks{position:relative;height:16px;margin:2px 20px 0;color:var(--muted);font-size:11px}
.ticks .t{position:absolute;transform:translateX(-50%);top:0}
.axhead{display:grid;grid-template-columns:1fr 260px 118px;gap:16px;padding:12px 20px 2px;color:var(--muted);font-size:11.5px;letter-spacing:.03em;text-transform:uppercase}
.axhead .r{text-align:right}
@media(max-width:760px){.axhead{display:none}}
.totals{margin-top:18px}
.totals .row{grid-template-columns:1fr 300px 130px;padding:12px 20px}
.totals .row.grand{background:var(--surface2)}
.totals .row.grand .name{font-weight:750;font-size:15px}
.totals .row.grand .nums b{font-size:17px}
.legend{display:flex;gap:20px;align-items:center;flex-wrap:wrap;color:var(--ink2);font-size:13px;margin:2px 0 0}
.legend .lg{display:inline-flex;align-items:center;gap:8px}
.lg .mini{position:relative;width:80px;height:10px;background:var(--track);border-radius:6px}
.lg .mini .s{position:absolute;left:14%;width:64%;height:10px;border-radius:6px;background:linear-gradient(90deg,var(--accent-l),var(--accent))}
.lg .mini .d{position:absolute;left:52%;top:50%;width:11px;height:11px;border-radius:50%;background:var(--likely);border:2px solid #fff;transform:translate(-50%,-50%)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:760px){.grid2{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:18px 20px}
.panel h3{margin:0 0 10px;font-size:15px}
.panel ul{margin:0;padding-left:18px}
.panel li{margin:6px 0;color:var(--ink2)}
.panel li b{color:var(--ink)}
.callout{background:linear-gradient(180deg,#f3f7ff,#fbfdff);border:1px solid #d6e3fb;border-radius:16px;padding:18px 20px;margin-top:22px}
.callout b{color:var(--accent-d)}
.gatetag{display:inline-block;background:#e5efff;color:var(--accent-d);font-size:10px;font-weight:800;letter-spacing:.04em;padding:2px 7px;border-radius:6px;margin-left:8px;vertical-align:middle}
.gateband{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 20px;background:linear-gradient(90deg,#eaf2ff,#f6faff);border-top:1px solid #d6e3fb;border-bottom:1px solid #d6e3fb}
.gateband .gl{font-size:14px}.gateband .gl b{color:var(--accent-d)}
.gateband .gn{font-variant-numeric:tabular-nums;color:var(--ink2);font-size:13px;white-space:nowrap}
.gateband .gn b{color:var(--likely);font-size:16px;font-weight:800}
/* T-shirt */
.bands{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:6px}
.band{border-radius:12px;padding:12px 14px;text-align:center;border:1px solid var(--line);background:var(--surface)}
.band .s{font-size:20px;font-weight:800}
.band .p{font-size:12px;color:var(--ink2);margin-top:2px;font-variant-numeric:tabular-nums}
table.tt{width:100%;border-collapse:collapse;background:var(--surface)}
table.tt th,table.tt td{text-align:left;padding:11px 16px;border-top:1px solid var(--line);font-size:14px}
table.tt th{font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border-top:0}
table.tt td.n{color:var(--ink2)}
.chip{display:inline-block;min-width:44px;text-align:center;padding:3px 10px;border-radius:999px;font-weight:750;font-size:13px}
.scn{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:6px}
@media(max-width:760px){.scn{grid-template-columns:1fr}}
.scard{background:var(--surface);border:1px solid var(--line);border-left-width:5px;border-radius:14px;padding:16px 18px;box-shadow:var(--shadow)}
.scard .h{display:flex;align-items:center;justify-content:space-between;gap:8px}
.scard .t{font-weight:750;font-size:15px}
.scard .r{font-variant-numeric:tabular-nums;color:var(--ink2);font-size:14px;margin-top:8px}
.scard .d{color:var(--ink2);font-size:13px;margin-top:8px}
.badge{padding:3px 11px;border-radius:999px;font-weight:800;font-size:13px}
footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px}
a{color:var(--accent)}
@media print{body{background:#fff}.card,.kpi,.panel,.scard,.callout{box-shadow:none}.wrap{padding:0}}

.card.blk{margin:18px 0;padding:20px 28px 10px}
.blk h3{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 6px}
.blk h3 .bs{font-size:13px;font-weight:700;color:#1a1a1a;white-space:nowrap;background:#eef2f6;border:1px solid #dde4ec;border-radius:20px;padding:3px 12px;margin-left:auto}
.blk .bnote{font-size:12.5px;color:#5b6572;margin:-2px 0 8px;line-height:1.45;max-width:92ch}
.grp{margin:26px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8b95a3;font-weight:700}
.p{border-top:1px solid #eceff3;padding:12px 0}
.p:first-of-type{border-top:none}
.p .pn{font-weight:600;display:flex;align-items:baseline;gap:12px}
.p .pn > span:first-child{flex:1}
.p .pv{font-size:12.5px;font-weight:400;white-space:nowrap;color:#37414d;background:#f2f5f9;border:1px solid #e3e9f0;border-radius:20px;padding:1px 10px}
.p .pv.spread{background:#fdecea;border-color:#f2c4bd;color:#7a2a22}
.p .pv.spread .w.on{color:#b3261e;box-shadow:inset 0 -2px 0 #b3261e}
.p .pv .w{cursor:pointer;padding:0 4px;border-radius:10px}
.p .pv .w:hover{background:#dfe7f3}
.p .pv .w.on{font-weight:700;color:#1a1a1a;background:#fff;box-shadow:inset 0 -2px 0 #1b4dc2}
.p .pv .eigen{width:54px;font:inherit;font-size:12px;border:1px solid #cfd8e3;border-radius:8px;padding:0 5px;background:#fff;color:#37414d;-moz-appearance:textfield}
.p .pv .eigen::-webkit-outer-spin-button,.p .pv .eigen::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.p .pv .eigen.on{font-weight:700;border-color:#1b4dc2;box-shadow:inset 0 -2px 0 #1b4dc2;color:#1a1a1a}
.blk h3 .bs i,.grp i{font-style:normal;color:#1b4dc2}
.avx{display:inline-flex;gap:8px;margin-right:12px}
.avx .cb{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:800;cursor:pointer;user-select:none}
.avx .cb input{width:13px;height:13px;margin:0;cursor:pointer}
.avx .cb.a{color:#1b4dc2}.avx .cb.a input{accent-color:#1b4dc2}
.avx .cb.k{color:#0f7b52}.avx .cb.k input{accent-color:#0f7b52}
.avx .cb.x{color:#b3261e}.avx .cb.x input{accent-color:#b3261e}
.card:has(> #avx-tally){position:sticky;top:0;z-index:20}
#tools{position:fixed;right:22px;bottom:22px;z-index:60;display:flex;gap:8px}
#tools button{background:#1b4dc2;color:#fff;border:0;border-radius:999px;padding:11px 18px;font:600 13px/1 inherit;box-shadow:0 4px 16px rgba(20,26,34,.25);cursor:pointer}
#tools button:hover{background:#2563eb}
#tools button.sec{background:#fff;color:#1b4dc2;border:1px solid #c9d7f2}
#tools button.sec:hover{background:#f3f7ff}
#tools .dd{position:relative}
#tools .dd-btn::after{content:'';display:inline-block;margin-left:8px;border:4px solid transparent;border-bottom-color:currentColor;vertical-align:2px}
#tools .dd.open .dd-btn::after{border-bottom-color:transparent;border-top-color:currentColor;vertical-align:-3px}
#tools .dd-menu{display:none;position:absolute;right:0;bottom:calc(100% + 8px);min-width:230px;background:#fff;border:1px solid #d8dfe8;border-radius:12px;box-shadow:0 8px 28px rgba(20,26,34,.22);padding:6px;flex-direction:column}
#tools .dd.open .dd-menu{display:flex}
#tools .dd-menu button{background:none;color:#1a1a1a;border:0;border-radius:8px;box-shadow:none;padding:9px 12px;text-align:left;font-weight:500;white-space:nowrap}
#tools .dd-menu button:hover{background:#eef3fc;color:#1b4dc2}
#tools .dd-menu button small{display:block;font-size:11px;font-weight:400;color:#6b7685;margin-top:2px}
.cmt-btn{background:none;border:0;cursor:pointer;font-size:13px;color:#8b95a3;padding:0 2px;line-height:1}
.cmt-btn:hover{color:#1b4dc2}
.cmt-btn.hat{color:#8a6300}
.cmt{margin-top:8px;background:#fffbe8;border:1px solid #ecdfae;border-radius:8px;padding:7px 12px;font-size:13px;line-height:1.5;color:#4d4a33;max-width:92ch;white-space:pre-wrap;outline:none}
.cmt:focus{border-color:#d9c264;box-shadow:0 0 0 3px rgba(217,194,100,.18)}
.cmt:empty::before{content:attr(data-ph);color:#b3a76a}
#werte-tally{margin-bottom:3px}
.tl{border-collapse:collapse;margin:2px 0 6px}
.tl td{padding:1px 10px 1px 0;vertical-align:baseline}
.tl td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}
.tl tr.sum td{border-top:1px solid #c9d3e0;padding-top:3px}
.tl tr.sum td.n{font-size:15px;color:#1b4dc2}
#pl-ctl{margin:2px 0 6px;color:#37414d}
#pl-pct{width:64px;font:inherit;font-weight:700;color:#1b4dc2;text-align:right;border:1px solid #c9d3e0;border-radius:6px;padding:2px 6px;background:#fff}
#pl-pct:focus{outline:2px solid #1b4dc2;outline-offset:1px}
#pl-ctl-hint{color:#6b7685;font-size:12.5px}
#export-stamp{display:none;font-size:12px;color:#5b6572;margin-top:6px}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #tools{display:none}
  .cmt-btn{display:none}
  .cmt:empty{display:none}
  .cmt{background:#fffbe8 !important;border:1px solid #ecdfae}
  .card:has(> #avx-tally){position:static;box-shadow:none;border:1px solid #d8dfe8}
  #export-stamp{display:block}
  #pl-pct{border:0;border-bottom:1px solid #1a1a1a;border-radius:0;padding:0 2px;width:48px}
  .p{break-inside:avoid}
  .blk h3{break-after:avoid}
  .card.blk{break-inside:auto}
  .kpis,.sumband,.sumlegend{break-inside:avoid}
  .avx .cb{color:#1a1a1a}
  .p .pv .w{padding:0 2px}
  .p .pv .w.on{box-shadow:none;text-decoration:underline;text-underline-offset:2px}
  .p .pv .eigen{border:0;padding:0;width:auto;max-width:44px;background:none}
  .p .pv .eigen:not(.on){display:none}
  .p .pv .eigen.on{box-shadow:none;text-decoration:underline;text-underline-offset:2px}
}
.p .fld{font-size:13px;line-height:1.55;color:#4d5867;margin-top:3px;max-width:92ch}
.p .fld b.tag{display:inline-block;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;border-radius:4px;padding:1px 6px;margin-right:6px;vertical-align:1px}
.tag.hk{background:#e5efff;color:#1b4dc2}.tag.an{background:#e7f4ee;color:#0f7b52}.tag.ri{background:#fdecea;color:#b3261e}
.condtab td{font-size:13px;padding:6px 10px;border-top:1px solid #eceff3;vertical-align:top}
.condtab td:first-child{font-weight:700;white-space:nowrap;color:#1b4dc2}
.dodbox{background:#eef2f6;border:1px solid #d8dfe8;border-radius:10px;padding:14px 18px;margin:14px 0;font-size:13.5px;line-height:1.55;color:#37414d;max-width:100ch}
.sumband{display:flex;height:30px;border-radius:8px;overflow:hidden;margin:12px 0 10px;font-size:12px;color:#fff;font-weight:600}
.sumband div{display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap}
.sumlegend{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:13px;color:#4d5867;margin-bottom:4px}
.sumlegend .sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:7px;vertical-align:-1px}
.sumlegend b{color:#1a1a1a}
.sumtotal{font-size:13px;color:#1a1a1a;border-top:1px solid #eceff3;margin-top:8px;padding-top:8px}
.lv{border-collapse:collapse;font-size:13px;margin:2px 0 4px}
.lv th{font-weight:600;color:#5b6572;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
.lv td,.lv th{padding:2px 18px 2px 0;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.lv td:first-child,.lv th:first-child{text-align:left;white-space:normal}
.lv td.d{color:#8b95a3}
.lv tr.sum td{border-top:1px solid #c9d3e0;font-weight:700;padding-top:4px}
.lv tr.sum td:nth-child(3){color:#1b4dc2;font-size:14px}
`;

const groupSums = {};
BLOCKS.forEach(b => { groupSums[b.group] = (groupSums[b.group] || 0) + b.pt; });

// Blöcke und Positionen mit Nummerierung; PL-Gruppe wird nicht gerendert.
const PL_GROUP = KONFIG.plGruppe;
let body = '';
let curGroup = '';
let bi = 0;
let gateNr = null;
for (const b of BLOCKS) {
  if (b.group === PL_GROUP) continue;
  bi++;
  if (b.group !== curGroup) { curGroup = b.group; body += `<div class=grp data-g="${esc(curGroup)}" data-pt="${groupSums[curGroup]}">${esc(curGroup)} · ${de(groupSums[curGroup])} PT</div>`; }
  const gate = b.title === KONFIG.gateBlock ? ` <span class=gatetag>GATE 1</span>` : '';
  if (b.title === KONFIG.gateBlock) gateNr = bi;
  body += `<div class='card blk' data-g="${esc(b.group)}" data-title="${esc(b.title)}"><h3><span>${bi}. ${esc(b.title)}${gate}</span><span class=bs data-pt="${b.pt}">Σ ${de(b.pt)} PT</span></h3>`;
  if (b.note) body += `<div class=bnote>${esc(b.note)}</div>`;
  let pi = 0;
  for (const [name, t, hk, an, ri] of b.pos) {
    pi++;
    const spread = Math.abs(t[1]-t[0]) > 5 || Math.abs(t[2]-t[1]) > 5;
    const avx = ['A','K','X'].map(v => `<label class="cb ${v.toLowerCase()}" title="${v==='A'?esc(KONFIG.wirLabel)+' macht es':v==='K'?esc(KONFIG.kundeLabel)+' macht es':'wird gestrichen'}"><input type=checkbox data-k="${bi}.${pi}" data-pt="${t[1]}" value=${v}>${v}</label>`).join('');
    body += `<div class=p data-k="${bi}.${pi}" data-t="${t.join(',')}"><div class=pn><span>${bi}.${pi} ${esc(name)}</span><span class=avx>${avx}<button class=cmt-btn type=button title="Kommentar hinzufügen">✎</button></span><span class="pv${spread?" spread":""}">${trip(t)} PT</span></div>`
      + `<div class=fld><b class='tag hk'>Herkunft</b>${esc(hk)}</div>`
      + (an ? `<div class=fld><b class='tag an'>Annahme</b>${esc(an)}</div>` : '')
      + (ri ? `<div class=fld><b class='tag ri'>Risiko</b>${esc(ri)}</div>` : '')
      + `<div class=cmt data-k="${bi}.${pi}" contenteditable=plaintext-only data-ph="Kommentar — wird gespeichert und mit exportiert" hidden></div>`
      + `</div>`;
  }
  body += `</div>`;
}
const RENDERED_BLOCKS = bi;
const plPt = groupSums[PL_GROUP] || 0;
const positionenPt = BLOCKS.reduce((a, b) => a + b.pt, 0) - plPt;
const PL_RATE = positionenPt ? plPt / positionenPt : 0;   // Projektleitung skaliert mit dem Zuschnitt

const condRows = CONDITIONS.map(c => `<tr><td>${c[0]}</td><td>${esc(c[1])}</td></tr>`).join('');
const direct = BLOCKS.reduce((a,b)=>a+b.pt,0);

// Gesamtspanne und PERT aus den Positions-Tripeln — nie von Hand pflegen
const tmin = BLOCKS.reduce((a,b)=>a+b.pos.reduce((x,p)=>x+p[1][0],0),0);
const tmax = BLOCKS.reduce((a,b)=>a+b.pos.reduce((x,p)=>x+p[1][2],0),0);
const pert = Math.round((tmin + 4*direct + tmax)/6);
// Harter Konsistenzcheck: Blocksumme = Summe der wahrscheinlichen Positionswerte
for (const b of BLOCKS) {
  const s = b.pos.reduce((x,p)=>x+p[1][1],0);
  if (s !== b.pt) throw new Error(`Blocksumme weicht ab: "${b.title}" pt=${b.pt}, Positionssumme=${s}`);
}
const GROUPS = [...new Set(BLOCKS.map(b=>b.group))];
const GRPCOLORS = ['#5b6572','#2563eb','#0f7b52','#7c3aed','#8a6300'];
const band = GROUPS.map((g,i)=>`<div data-g="${esc(g)}" data-pt="${groupSums[g]}"${g===PL_GROUP?' data-pl':''} style='background:${GRPCOLORS[i%GRPCOLORS.length]};width:${(groupSums[g]/direct*100).toFixed(1)}%'>${de(groupSums[g])}</div>`).join('\n');
const legend = GROUPS.map((g,i)=>`<span><span class=sw style='background:${GRPCOLORS[i%GRPCOLORS.length]}'></span>${esc(g)} <b data-g="${esc(g)}" data-pt="${groupSums[g]}"${g===PL_GROUP?' data-pl':''}>${de(groupSums[g])} PT</b></span>`).join('\n');
const sumFormel = GROUPS.map(g=>de(groupSums[g])).join(' + ');
if (KONFIG.gateBlock && gateNr === null)
  throw new Error(`KONFIG.gateBlock "${KONFIG.gateBlock}" passt auf keinen Blocktitel`);
const gateHinweis = KONFIG.gateBlock
  ? ` Der empfohlene erste Umsetzungsschritt ist <b>Block ${gateNr} „${esc(KONFIG.gateBlock)}“ (GATE 1)</b>; er ist Teil der ${de(direct)}, kein Zuschlag.`
  : '';

const html = `<!doctype html><html lang=de><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>${esc(KONFIG.dokumentTitel)}</title><style>${CSS}
.kpis{grid-template-columns:repeat(3,1fr)}
@media(max-width:760px){.kpis{grid-template-columns:1fr}}</style></head><body><div class=wrap>
<header class=page><div class=eyebrow>${KONFIG.eyebrow}</div><h1>${esc(KONFIG.titel)}</h1><p class=sub>${KONFIG.untertitel}</p>${KONFIG.metaHtml ? `<div class=meta>${KONFIG.metaHtml}</div>` : ''}</header>

<div class=kpis data-pl-rate="${PL_RATE}" data-pl-ml="${plPt}" data-pl-name="${esc(PL_GROUP)}">
<div class='kpi accent' id=kpi-gesamt><div class=v>${de(direct)} <small>PT</small></div><div class=k>Gesamtaufwand (wahrscheinlich)</div></div>
<div class=kpi id=kpi-spanne><div class=v>${de(tmin)}–${de(tmax)} <small>PT</small></div><div class=k>Spanne (Summe aller Minima bzw. Maxima) · PERT-Erwartungswert ≈${de(pert)}</div></div>
<div class=kpi><div class=v>B1–B${CONDITIONS.length}</div><div class=k>${esc(KONFIG.mitwirkungTitel)} (Grundlage der Kalkulation)</div></div>
</div>

<section><div class=sectitle><h2>So setzen sich die ${de(direct)} PT zusammen</h2><span class=hint>wahrscheinliche Werte</span></div>
<div class=card style='padding:14px 18px'>
<div class=sumband>
${band}
</div>
<div class=sumlegend>
${legend}
</div>
<div class=sumtotal id=sum-live hidden></div>
<div class=sumtotal>Die Blöcke unten (1–${RENDERED_BLOCKS}) tragen zusammen ${de(positionenPt)} PT; ${plPt ? `die ${esc(PL_GROUP)} (${de(plPt)} PT) läuft über die gesamte Laufzeit und ist deshalb nicht als Einzelposition aufgeführt.` : ''}${gateHinweis}</div>
</div></section>

${KONFIG.kalkulationsmodellHtml ? `<div class=dodbox>${KONFIG.kalkulationsmodellHtml}</div>` : ''}

<section><div class=sectitle><h2>${esc(KONFIG.mitwirkungTitel)} (B1–B${CONDITIONS.length})</h2><span class=hint>Grundlage der Kalkulation</span></div>
<div class=card style='padding:6px 8px'><table class=condtab style='width:100%;border-collapse:collapse'>${condRows}</table>
<p style='font-size:12.5px;color:#5b6572;margin:8px 10px'>Entfällt oder verzögert sich eine Mitwirkungsleistung, werden die davon abhängigen Positionen neu bewertet.</p></div></section>

<section><div class=sectitle><h2>Positionen</h2><span class=hint>je Position: min · wahrscheinlich · max PT — <span style="background:#fdecea;border:1px solid #f2c4bd;border-radius:20px;padding:0 8px;color:#7a2a22">rot</span> = min oder max weicht mehr als 5 PT vom wahrscheinlichen Wert ab</span></div>
<div class=card style='padding:10px 18px;margin-bottom:14px;font-size:13.5px'><div id=pl-ctl><label>Projektleitung anteilig: <input id=pl-pct type=number min=0 max=100 step=0.1 title="Prozentsatz der Projektleitung auf die direkten PT (A + offen). Leeren setzt auf den Schätzwert zurück."> % der direkten PT (A + offen)</label> <span id=pl-ctl-hint></span></div><div id=werte-tally></div><div id=avx-tally>A = ${esc(KONFIG.wirLabel)} macht es · K = ${esc(KONFIG.kundeLabel)} macht es · X = wird gestrichen</div><div id=export-stamp></div></div>
${body}</section>

${KONFIG.schlussHtml ? `<div class=callout>${KONFIG.schlussHtml}</div>` : ''}

<footer>${KONFIG.fusszeile}</footer>
<script>
(function(){
var KEY='${KONFIG.speicherKey}';
var state={auswahl:{},kommentare:{},werte:{}};
try{
  var raw=localStorage.getItem(KEY);
  if(raw){ var p=JSON.parse(raw); if(p&&typeof p==='object'){ state.auswahl=p.auswahl||{}; state.kommentare=p.kommentare||{}; state.werte=(p.werte&&typeof p.werte==='object')?p.werte:{}; } }
}catch(e){}
function save(){ try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){} }

var boxes=[].slice.call(document.querySelectorAll('.avx input'));
var cmts=[].slice.call(document.querySelectorAll('.cmt'));
var pos=[].slice.call(document.querySelectorAll('.p[data-k]'));

// ── Wertauswahl: min / wahrscheinlich / max / eigener Wert ──
function tripOf(p){ return p.dataset.t.split(',').map(Number); }
function modeOf(p){ var w=state.werte[p.dataset.k]; return (w&&w.m)||'ml'; }
function effPt(p){
  var t=tripOf(p),w=state.werte[p.dataset.k];
  if(!w) return t[1];
  if(w.m==='eigen') return (typeof w.e==='number'&&isFinite(w.e))?w.e:t[1];
  return w.m==='min'?t[0]:w.m==='max'?t[2]:t[1];
}
function setWert(k,m,e){
  var w=state.werte[k]||{};
  if(m!==undefined) w.m=m;
  if(e!==undefined){ if(e===null) delete w.e; else w.e=e; }
  if(w.m==='eigen'&&w.e===undefined) w.m='ml';
  if((!w.m||w.m==='ml')&&w.e===undefined) delete state.werte[k]; else { if(!w.m) w.m='ml'; state.werte[k]=w; }
  save(); paintWerte(); tally();
}
function paintWerte(){
  pos.forEach(function(p){
    var m=modeOf(p),w=state.werte[p.dataset.k];
    [].slice.call(p.querySelectorAll('.pv .w')).forEach(function(x){ x.classList.toggle('on',x.dataset.m===m); });
    var e=p.querySelector('.pv .eigen');
    if(document.activeElement!==e) e.value=(w&&typeof w.e==='number')?w.e:'';
    e.classList.toggle('on',m==='eigen');
  });
}
pos.forEach(function(p){
  var k=p.dataset.k;
  [].slice.call(p.querySelectorAll('.pv .w')).forEach(function(x){
    x.addEventListener('click',function(){ setWert(k,x.dataset.m); });
  });
  var e=p.querySelector('.pv .eigen');
  e.addEventListener('input',function(){
    var v=parseFloat(e.value);
    if(isFinite(v)&&v>=0) setWert(k,'eigen',Math.round(v*10)/10); else setWert(k,'ml',null);
  });
  e.addEventListener('focus',function(){ var w=state.werte[k]; if(w&&typeof w.e==='number') setWert(k,'eigen'); });
  e.addEventListener('keydown',function(ev){ if(ev.key==='Enter') e.blur(); });
});
paintWerte();

boxes.forEach(function(b){
  if(state.auswahl[b.dataset.k]===b.value) b.checked=true;
  b.addEventListener('change',function(){
    if(b.checked){
      boxes.forEach(function(o){ if(o.dataset.k===b.dataset.k&&o!==b) o.checked=false; });
      state.auswahl[b.dataset.k]=b.value;
    } else delete state.auswahl[b.dataset.k];
    save(); tally();
  });
});

cmts.forEach(function(c){
  var k=c.dataset.k;
  if(state.kommentare[k]){ c.textContent=state.kommentare[k]; c.hidden=false; markBtn(k,true); }
  c.addEventListener('input',function(){
    var txt=c.textContent.replace(/\u00a0/g,' ').trim();
    if(txt) state.kommentare[k]=txt; else delete state.kommentare[k];
    markBtn(k,!!txt); save();
  });
  c.addEventListener('blur',function(){ if(!c.textContent.trim()) c.hidden=true; });
});
function markBtn(k,hat){
  var p=document.querySelector('.p[data-k="'+k+'"]');
  if(p) p.querySelector('.cmt-btn').classList.toggle('hat',hat);
}
[].slice.call(document.querySelectorAll('.cmt-btn')).forEach(function(btn){
  btn.addEventListener('click',function(){
    var c=btn.closest('.p').querySelector('.cmt');
    c.hidden=false; c.focus();
  });
});

function fmt(n){ return (Math.round(n*10)/10).toLocaleString('de-DE'); }
// ── Angebotssumme: nur A + offen zaehlen, K/X raus, Projektleitung anteilig ──
var KP=document.querySelector('.kpis');
var PL_DEF=Math.round((+KP.dataset.plRate||0)*1000)/10, PL_ML=+KP.dataset.plMl||0;
function plPct(){ return (typeof state.plPct==='number'&&isFinite(state.plPct))?state.plPct:PL_DEF; }
function plRate(){ return plPct()/100; }
var plIn=document.getElementById('pl-pct');
function paintPl(){ if(document.activeElement!==plIn) plIn.value=String(plPct()); }
plIn.addEventListener('input',function(){
  var v=parseFloat(String(plIn.value).replace(',','.'));
  if(isFinite(v)&&v>=0&&v<=100&&Math.abs(v-PL_DEF)>0.001) state.plPct=Math.round(v*10)/10; else delete state.plPct;
  save(); tally();
});
plIn.addEventListener('blur',paintPl);
plIn.addEventListener('keydown',function(ev){ if(ev.key==='Enter') plIn.blur(); });
paintPl();
var ORIG={};
(function(){
  var g=document.getElementById('kpi-gesamt'),s=document.getElementById('kpi-spanne');
  ORIG.gv=g.querySelector('.v').innerHTML; ORIG.gk=g.querySelector('.k').innerHTML;
  ORIG.sv=s.querySelector('.v').innerHTML; ORIG.sk=s.querySelector('.k').innerHTML;
  [].slice.call(document.querySelectorAll('.sumband div[data-g]')).forEach(function(d){ d.dataset.w=d.style.width; });
})();
function selOf(k){ return state.auswahl[k]||''; }
function inAngebot(k){ var s=selOf(k); return s!=='K'&&s!=='X'; }
function angebot(){
  var r={direkt:0,min:0,max:0,ml:0,grp:{},ausK:0,ausX:0,changed:false};
  pos.forEach(function(p){
    var k=p.dataset.k,t=tripOf(p),e=effPt(p),s=selOf(k);
    if(s==='K'){ r.ausK+=e; r.changed=true; return; }
    if(s==='X'){ r.ausX+=e; r.changed=true; return; }
    if(modeOf(p)!=='ml') r.changed=true;
    r.direkt+=e; r.min+=t[0]; r.max+=t[2]; r.ml+=t[1];
    var g=p.closest('.blk').dataset.g; r.grp[g]=(r.grp[g]||0)+e;
  });
  if(Math.abs(plPct()-PL_DEF)>0.001) r.changed=true;
  r.pl=Math.round(r.direkt*plRate());
  r.gesamt=r.direkt+r.pl;
  r.smin=Math.round(r.min*(1+plRate())); r.smax=Math.round(r.max*(1+plRate()));
  return r;
}
function paintTop(a){
  var g=document.getElementById('kpi-gesamt'),s=document.getElementById('kpi-spanne'),live=document.getElementById('sum-live');
  var segs=[].slice.call(document.querySelectorAll('.sumband div[data-g]'));
  var legs=[].slice.call(document.querySelectorAll('.sumlegend b[data-g]'));
  if(!a.changed){
    g.querySelector('.v').innerHTML=ORIG.gv; g.querySelector('.k').innerHTML=ORIG.gk;
    s.querySelector('.v').innerHTML=ORIG.sv; s.querySelector('.k').innerHTML=ORIG.sk;
    segs.forEach(function(d){ d.style.width=d.dataset.w; d.textContent=fmt(+d.dataset.pt); });
    legs.forEach(function(b){ b.textContent=fmt(+b.dataset.pt)+' PT'; });
    live.hidden=true; return;
  }
  g.querySelector('.v').innerHTML=fmt(a.gesamt)+' <small>PT</small>';
  g.querySelector('.k').innerHTML='Gesamtaufwand des gewählten Zuschnitts (inkl. anteiliger Projektleitung) · Schätzung: '+ORIG.gv.replace('<small>PT</small>','PT');
  s.querySelector('.v').innerHTML=fmt(a.smin)+'–'+fmt(a.smax)+' <small>PT</small>';
  s.querySelector('.k').innerHTML='Spanne des gewählten Zuschnitts (Minima bzw. Maxima der enthaltenen Positionen, inkl. anteiliger Projektleitung) · Schätzung: '+ORIG.sv.replace('<small>PT</small>','PT');
  var rowsHtml='',sumO=0,sumA=0;
  segs.forEach(function(d){
    var name=d.dataset.g,isPl=d.dataset.pl!==undefined,v=isPl?a.pl:(a.grp[name]||0),o=+d.dataset.pt;
    d.style.width=(a.gesamt?v/a.gesamt*100:0).toFixed(1)+'%'; d.textContent=v?fmt(v):'';
    sumO+=o; sumA+=v;
    var diff=v-o;
    rowsHtml+='<tr><td>'+name+(isPl?' \u00b7 '+String(plPct()).replace('.',',')+' %':'')+'</td><td>'+fmt(o)+'</td><td>'+fmt(v)+'</td><td class=d>'+(Math.abs(diff)<0.05?'':(diff>0?'+':'\u2212')+fmt(Math.abs(diff)))+'</td></tr>';
  });
  legs.forEach(function(b){
    var v=b.dataset.pl!==undefined?a.pl:(a.grp[b.dataset.g]||0),o=+b.dataset.pt;
    b.innerHTML=Math.abs(v-o)<0.05?fmt(o)+' PT':fmt(o)+' → <i>'+fmt(v)+' PT</i>';
  });
  var dS=sumA-sumO;
  var aus=[]; if(a.ausK) aus.push('K '+fmt(a.ausK)+' PT'); if(a.ausX) aus.push('X '+fmt(a.ausX)+' PT');
  live.innerHTML='<table class=lv><tr><th>Anteil</th><th>Sch\u00e4tzung</th><th>Angebot</th><th></th></tr>'+rowsHtml
    +'<tr class=sum><td>Summe (PT)</td><td>'+fmt(sumO)+'</td><td>'+fmt(sumA)+'</td><td class=d>'+(Math.abs(dS)<0.05?'':(dS>0?'+':'\u2212')+fmt(Math.abs(dS)))+'</td></tr></table>'
    +'<div style="color:#5b6572">Angebot = Positionen mit A oder ohne Zuordnung, zu den gew\u00e4hlten Werten, plus anteilige Projektleitung.'+(aus.length?' Nicht im Angebot: '+aus.join(' \u00b7 ')+'.':'')+'</div>';
  live.hidden=false;
}
function tally(){
  var sum={A:[0,0],K:[0,0],X:[0,0]},open=0,openPt=0,tot=0,totMl=0,changed=0;
  pos.forEach(function(p){
    var k=p.dataset.k,pt=effPt(p),ml=tripOf(p)[1];
    tot+=pt; totMl+=ml; if(modeOf(p)!=='ml') changed++;
    var sel=null; boxes.forEach(function(o){ if(o.dataset.k===k&&o.checked) sel=o; });
    if(sel){ sum[sel.value][0]++; sum[sel.value][1]+=pt; } else { open++; openPt+=pt; }
  });
  // Block- und Gruppensummen
  var grp={};
  [].slice.call(document.querySelectorAll('.blk')).forEach(function(b){
    var s=0; [].slice.call(b.querySelectorAll('.p[data-k]')).forEach(function(p){ s+=effPt(p); });
    var bs=b.querySelector('.bs'),orig=+bs.dataset.pt;
    bs.innerHTML = Math.abs(s-orig)<0.05 ? '\u03a3 '+fmt(orig)+' PT' : '\u03a3 '+fmt(orig)+' \u2192 <i>'+fmt(s)+' PT</i>';
    grp[b.dataset.g]=(grp[b.dataset.g]||0)+s;
  });
  [].slice.call(document.querySelectorAll('.grp')).forEach(function(g){
    var orig=+g.dataset.pt,s=grp[g.dataset.g]||0,name=g.dataset.g;
    g.innerHTML = Math.abs(s-orig)<0.05 ? name+' \u00b7 '+fmt(orig)+' PT' : name+' \u00b7 '+fmt(orig)+' \u2192 <i>'+fmt(s)+' PT</i>';
  });
  var ang=angebot(); paintTop(ang);
  document.getElementById('pl-ctl-hint').textContent='= '+fmt(ang.pl)+' PT'+(Math.abs(plPct()-PL_DEF)>0.001?' (Sch\u00e4tzung: '+String(PL_DEF).replace('.',',')+' % = '+fmt(PL_ML)+' PT)':'');
  var delta=tot-totMl;
  var zeilen='<tr><td class=n>'+fmt(ang.direkt)+' PT</td><td>Positionen im Angebot: <b style="color:#1b4dc2">A ${esc(KONFIG.wirLabel)} \u00b7 '+sum.A[0]+' Pos. \u00b7 '+fmt(sum.A[1])+' PT</b>'
    +(open?' + <span style="color:#8b95a3">offen (noch nicht zugeordnet, z\u00e4hlt mit) \u00b7 '+open+' Pos. \u00b7 '+fmt(openPt)+' PT</span>':'')+'</td></tr>';
  if(plRate()) zeilen+='<tr><td class=n>+ '+fmt(ang.pl)+' PT</td><td>Projektleitung \u00b7 '+String(plPct()).replace('.',',')+' % der Positionen im Angebot</td></tr>';
  zeilen+='<tr class=sum><td class=n>= '+fmt(ang.gesamt)+' PT</td><td><b>Angebotssumme</b>'+(ang.changed?' <span style="color:#5b6572">\u2014 Sch\u00e4tzung vor Anpassung: '+fmt(totMl+PL_ML)+' PT</span>':' <span style="color:#5b6572">\u2014 entspricht der Sch\u00e4tzung; A/K/X setzen, min/max anklicken oder eigenen Wert eintragen</span>')+'</td></tr>';
  document.getElementById('werte-tally').innerHTML='<table class=tl>'+zeilen+'</table>';
  document.getElementById('avx-tally').innerHTML=
    "<span style='color:#5b6572'>Nicht im Angebot:</span> "+
    "<b style='color:#0f7b52'>K ${esc(KONFIG.kundeLabel)} \u00b7 "+sum.K[0]+" Pos. \u00b7 "+fmt(sum.K[1])+" PT</b> &nbsp;\u00b7&nbsp; "+
    "<b style='color:#b3261e'>X gestrichen \u00b7 "+sum.X[0]+" Pos. \u00b7 "+fmt(sum.X[1])+" PT</b>"+
    (changed?" &nbsp;\u00b7&nbsp; <span style='color:#5b6572'>"+changed+" Pos. mit ge\u00e4ndertem Wert ("+(delta>0?'+':'')+fmt(delta)+" PT gegen\u00fcber wahrscheinlich, \u00fcber alle Positionen)</span>":"")+
    " <span style='color:#8b95a3'>\u2014 Auswahl, Werte und Kommentare werden lokal im Browser gespeichert</span>";
}
tally();

// ── JSON-Export/-Import ──
function exportJson(){
  var positionen=[].slice.call(document.querySelectorAll('.p[data-k]')).map(function(p){
    var k=p.dataset.k;
    return { pos:k,
      titel:p.querySelector('.pn span').textContent.replace(k,'').trim(),
      ptMin:tripOf(p)[0], ptWahrscheinlich:tripOf(p)[1], ptMax:tripOf(p)[2],
      wertModus:modeOf(p), ptGewaehlt:effPt(p),
      auswahl:state.auswahl[k]||null,
      kommentar:state.kommentare[k]||null };
  });
  var d=new Date();
  var pad=function(x){return (x<10?'0':'')+x;};
  var datum=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  var summeGewaehlt=0,summeWahrscheinlich=0; pos.forEach(function(p){ summeGewaehlt+=effPt(p); summeWahrscheinlich+=tripOf(p)[1]; });
  var doc={ format:'${KONFIG.speicherKey}-auswahl', version:2,
    dokument:document.title, exportiertAm:d.toISOString(),
    legende:{A:'${KONFIG.wirLabel} macht es',K:'${KONFIG.kundeLabel} macht es',X:'wird gestrichen'},
    wertModi:{min:'Minimum',ml:'wahrscheinlicher Wert (Standard)',max:'Maximum',eigen:'eigener Wert (Feld e)'},
    summen:{gewaehlt:Math.round(summeGewaehlt*10)/10, wahrscheinlich:summeWahrscheinlich, hinweis:'direkte PT aller Positionen ohne anteilige Projektleitung',
      angebot:(function(){ var a=angebot(); return {direkt:Math.round(a.direkt*10)/10, projektleitung:a.pl, gesamt:Math.round(a.gesamt*10)/10, plAnteil:Math.round(plRate()*1000)/10, spanneMin:a.smin, spanneMax:a.smax, nichtEnthaltenK:Math.round(a.ausK*10)/10, nichtEnthaltenX:Math.round(a.ausX*10)/10, hinweis:'Positionen mit A oder ohne Zuordnung, gew\u00e4hlte Werte, plus anteilige Projektleitung'}; })()},
    projektleitungProzent:plPct(), auswahl:state.auswahl, werte:state.werte, kommentare:state.kommentare, positionen:positionen };
  var blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='${KONFIG.speicherKey}-auswahl-'+datum+'.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
}
function importJson(file){
  var r=new FileReader();
  r.onload=function(){
    try{
      var d=JSON.parse(r.result);
      if(!d||d.format!=='${KONFIG.speicherKey}-auswahl'){ alert('Keine g\u00fcltige Auswahl-Datei: Feld format=\u201e${KONFIG.speicherKey}-auswahl\u201c fehlt.'); return; }
      state.auswahl=(d.auswahl&&typeof d.auswahl==='object')?d.auswahl:{};
      state.kommentare=(d.kommentare&&typeof d.kommentare==='object')?d.kommentare:{};
      state.werte=(d.werte&&typeof d.werte==='object')?d.werte:{};
      if(typeof d.projektleitungProzent==='number'&&isFinite(d.projektleitungProzent)&&Math.abs(d.projektleitungProzent-PL_DEF)>0.001) state.plPct=d.projektleitungProzent; else delete state.plPct;
      paintPl();
      paintWerte();
      boxes.forEach(function(b){ b.checked = state.auswahl[b.dataset.k]===b.value; });
      cmts.forEach(function(c){
        var v=state.kommentare[c.dataset.k]||'';
        c.textContent=v; c.hidden=!v; markBtn(c.dataset.k,!!v);
      });
      save(); tally();
    }catch(e){ alert('Datei konnte nicht gelesen werden: '+e.message); }
  };
  r.readAsText(file);
}

// ── Excel-Export (.xlsx, ohne Bibliothek: ZIP ohne Kompression + SpreadsheetML) ──
var CRC_T=(function(){var t=[],c;for(var i=0;i<256;i++){c=i;for(var k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c>>>0;}return t;})();
function crc32(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=CRC_T[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zipStore(files){
  var enc=new TextEncoder(),parts=[],cd=[],off=0,d=new Date();
  var tm=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF,dt=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;
  function u16(v){return [v&255,(v>>>8)&255];} function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];}
  files.forEach(function(f){
    var name=enc.encode(f.name),data=enc.encode(f.data),crc=crc32(data);
    var lh=new Uint8Array([].concat(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(tm),u16(dt),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0)));
    parts.push(lh,name,data);
    cd.push(new Uint8Array([].concat(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(tm),u16(dt),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off))),name);
    off+=lh.length+name.length+data.length;
  });
  var cdLen=0; cd.forEach(function(x){cdLen+=x.length;});
  var end=new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cdLen),u32(off),u16(0)));
  return new Blob(parts.concat(cd,[end]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function xe(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function colL(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
function sheetXml(rows,widths,opts){
  opts=opts||{};
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  if(opts.freeze) x+='<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
  if(widths){ x+='<cols>'; widths.forEach(function(w,i){ x+='<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>'; }); x+='</cols>'; }
  x+='<sheetData>';
  rows.forEach(function(r,ri){
    x+='<row r="'+(ri+1)+'">';
    r.forEach(function(c,ci){
      var ref=colL(ci)+(ri+1),st=(ri===0&&opts.headerBold)?' s="1"':'';
      if(c===null||c===undefined||c==='') return;
      if(typeof c==='number') x+='<c r="'+ref+'"'+st+'><v>'+c+'</v></c>';
      else if(typeof c==='object'&&c.f) x+='<c r="'+ref+'" s="1"><f>'+xe(c.f)+'</f></c>';
      else x+='<c r="'+ref+'" t="inlineStr"'+st+'><is><t xml:space="preserve">'+xe(c)+'</t></is></c>';
    });
    x+='</row>';
  });
  x+='</sheetData>';
  if(opts.filter) x+='<autoFilter ref="'+opts.filter+'"/>';
  return x+'</worksheet>';
}
function exportXlsx(){
  var LEG={A:'${KONFIG.wirLabel} macht es',K:'${KONFIG.kundeLabel} macht es',X:'wird gestrichen'};
  var MOD={min:'Minimum',ml:'wahrscheinlich',max:'Maximum',eigen:'eigener Wert'};
  var head=['Nr','Gruppe','Block','Position','Min PT','Wahrscheinlich PT','Max PT','Modus','Gew\u00e4hlt PT (Angebot)','Zuordnung','Zuordnung (Text)','Kommentar','PT bei K/X (nicht angeboten)'];
  var rows=[head];
  [].slice.call(document.querySelectorAll('.blk')).forEach(function(b){
    [].slice.call(b.querySelectorAll('.p[data-k]')).forEach(function(p){
      var k=p.dataset.k,t=tripOf(p),a=state.auswahl[k]||'';
      rows.push([k,b.dataset.g,b.dataset.title,p.querySelector('.pn span').textContent.replace(k,'').trim(),t[0],t[1],t[2],MOD[modeOf(p)],(a==='K'||a==='X')?'':effPt(p),a,a?LEG[a]:'offen',state.kommentare[k]||'',(a==='K'||a==='X')?effPt(p):'']);
    });
  });
  var last=rows.length,tr=last+1;
  var sumRow=last+1,R=plRate().toFixed(4),pct=(plRate()*100).toFixed(1).replace('.',',');
  rows.push(['','','','Summe Positionen (E\u2013G: alle; I: nur A + offen)',{f:'SUM(E2:E'+last+')'},{f:'SUM(F2:F'+last+')'},{f:'SUM(G2:G'+last+')'},'',{f:'SUM(I2:I'+last+')'},'','','',{f:'SUM(M2:M'+last+')'}]);
  if(plRate()) rows.push(['','','',KP.dataset.plName+' (anteilig '+pct+' %)',{f:'ROUND(E'+sumRow+'*'+R+',0)'},{f:'ROUND(F'+sumRow+'*'+R+',0)'},{f:'ROUND(G'+sumRow+'*'+R+',0)'},'',{f:'ROUND(I'+sumRow+'*'+R+',0)'},'','','','']);
  var endRow=sumRow+(plRate()?1:0);
  rows.push(['','','','Gesamt (Spalte I = Angebotssumme: A + offen, ohne K/X)',{f:'SUM(E'+sumRow+':E'+endRow+')'},{f:'SUM(F'+sumRow+':F'+endRow+')'},{f:'SUM(G'+sumRow+':G'+endRow+')'},'',{f:'SUM(I'+sumRow+':I'+endRow+')'},'','','','']);
  var d=new Date(),pad=function(x){return (x<10?'0':'')+x;};
  var datum=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  var tot=0,totMl=0; pos.forEach(function(p){ tot+=effPt(p); totMl+=tripOf(p)[1]; });
  var ang=angebot();
  var info=[['Feld','Wert'],['Dokument',document.title],['Exportiert am',pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes())],
    ['\u03a3 Angebot (A + offen, inkl. anteiliger Projektleitung)',Math.round(ang.gesamt*10)/10],['davon direkte PT (A + offen)',Math.round(ang.direkt*10)/10],['davon Projektleitung anteilig',ang.pl],['Projektleitung Prozentsatz',plPct()],
    ['Nicht enthalten: K',Math.round(ang.ausK*10)/10],['Nicht enthalten: X',Math.round(ang.ausX*10)/10],
    ['\u03a3 wahrscheinlich alle Positionen (ohne PL)',totMl],['\u03a3 gew\u00e4hlt alle Positionen (ohne PL)',Math.round(tot*10)/10],
    ['Legende Zuordnung','A = '+LEG.A+' \u00b7 K = '+LEG.K+' \u00b7 X = '+LEG.X],
    ['Legende Modus','Minimum / wahrscheinlich (Standard) / Maximum / eigener Wert \u2014 bestimmt den Positionswert'],
    ['Hinweis','Blatt \u201ePositionen\u201c ist filterbar; die Summenzeilen rechnen per Formel und folgen Filtern nicht. Spalte \u201eGew\u00e4hlt PT (Angebot)\u201c enth\u00e4lt nur A/offen; K/X stehen in \u201ePT bei K/X\u201c. Darunter Projektleitung (Prozentsatz aus der Seite) und Gesamt.']];
  var files=[
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Positionen" sheetId="1" r:id="rId1"/><sheet name="Info" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Positionen!$A$1:$M$'+last+'</definedName></definedNames></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/></cellXfs></styleSheet>'},
    {name:'xl/worksheets/sheet1.xml',data:sheetXml(rows,[6,30,34,52,8,14,8,14,18,10,16,50,24],{headerBold:true,freeze:true,filter:'A1:M'+last})},
    {name:'xl/worksheets/sheet2.xml',data:sheetXml(info,[34,110],{headerBold:true})}
  ];
  var a=document.createElement('a');
  a.href=URL.createObjectURL(zipStore(files));
  a.download='${KONFIG.speicherKey}-'+datum+'.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
}

// ── Werkzeugleiste: zwei Dropdowns ──
var tools=document.createElement('div'); tools.id='tools';
var fi=document.createElement('input'); fi.type='file'; fi.accept='.json,application/json'; fi.hidden=true;
fi.addEventListener('change',function(){ if(fi.files[0]) importJson(fi.files[0]); fi.value=''; });
function dropdown(label,cls,items){
  var dd=document.createElement('div'); dd.className='dd';
  var btn=document.createElement('button'); btn.type='button'; btn.className='dd-btn'+(cls?' '+cls:''); btn.textContent=label;
  btn.setAttribute('aria-haspopup','menu'); btn.setAttribute('aria-expanded','false');
  var menu=document.createElement('div'); menu.className='dd-menu'; menu.setAttribute('role','menu');
  items.forEach(function(it){
    var b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem');
    b.innerHTML=it.label+(it.hint?'<small>'+it.hint+'</small>':''); b.title=it.title||'';
    b.addEventListener('click',function(){ closeAll(); it.run(); });
    menu.appendChild(b);
  });
  btn.addEventListener('click',function(ev){ ev.stopPropagation(); var open=dd.classList.contains('open'); closeAll(); if(!open){ dd.classList.add('open'); btn.setAttribute('aria-expanded','true'); } });
  dd.appendChild(menu); dd.appendChild(btn);
  return dd;
}
function closeAll(){ [].slice.call(tools.querySelectorAll('.dd.open')).forEach(function(d){ d.classList.remove('open'); d.querySelector('.dd-btn').setAttribute('aria-expanded','false'); }); }
document.addEventListener('click',closeAll);
document.addEventListener('keydown',function(ev){ if(ev.key==='Escape') closeAll(); });
tools.appendChild(dropdown('Exportieren','',[
  { label:'Als PDF', hint:'Druckdialog \u2014 dort \u201eAls PDF speichern\u201c', title:'Auswahl, gew\u00e4hlte PT-Werte und Kommentare werden mit ausgegeben.', run:function(){ window.print(); } },
  { label:'Als Excel (.xlsx)', hint:'Positionen filterbar, mit Summenzeile', title:'Alle Positionen mit Dreipunktwerten, gew\u00e4hltem Wert, A/K/X-Zuordnung und Kommentaren.', run:exportXlsx }
]));
tools.appendChild(dropdown('JSON','sec',[
  { label:'Exportieren', hint:'Stand als Datei weitergeben oder archivieren', title:'Speichert Auswahl, gew\u00e4hlte PT-Werte und Kommentare als Datei.', run:exportJson },
  { label:'Importieren', hint:'\u00dcberschreibt Auswahl, Werte und Kommentare', title:'Spielt eine zuvor exportierte Auswahl-Datei ein.', run:function(){ fi.click(); } }
]));
tools.appendChild(fi);
document.body.appendChild(tools);

window.addEventListener('beforeprint',function(){
  var d=new Date();
  var p=function(x){return (x<10?'0':'')+x;};
  document.getElementById('export-stamp').textContent=
    'Exportiert am '+p(d.getDate())+'.'+p(d.getMonth()+1)+'.'+d.getFullYear()+' um '+p(d.getHours())+':'+p(d.getMinutes())+' Uhr \u2014 die abgebildete A/K/X-Zuordnung, die gew\u00e4hlten PT-Werte (unterstrichen) und die Kommentare sind der Stand zu diesem Zeitpunkt.';
});
})();
</scr`+`ipt></div></body></html>`;

for (const datei of KONFIG.ausgaben) {
  fs.writeFileSync(path.join(__dirname, datei), html, 'utf8');
}
console.log('OK ->', KONFIG.ausgaben.join(', '),
  '| Blöcke:', BLOCKS.length, '| direkt:', direct,
  '| Spanne:', tmin + '–' + tmax, '| PERT:', pert,
  '| PL-Anteil:', plPt ? (100*plPt/positionenPt).toFixed(1)+' % der Umsetzungsleistung' : '—',
  '| Gruppen:', JSON.stringify(groupSums));
