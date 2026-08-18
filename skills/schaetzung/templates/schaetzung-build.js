// Generator für eine interaktive Aufwandsschätzungs-Seite (ein selbstständiges HTML).
// Anpassen: KONFIG + BLOCKS + CONDITIONS. Dann: node schaetzung-build.js
// Alles Weitere (Summen, Spanne, PERT, Summenband, 5-PT-Markierung, A/K/X-Checkboxen,
// Kommentare, JSON-Import/-Export, PDF-Druck) wird aus den Daten berechnet.
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
const trip = t => `${t[0]} · <b>${t[1]}</b> · ${t[2]}`;

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
.p .pv.spread b{color:#b3261e}
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
.cmt-btn{background:none;border:0;cursor:pointer;font-size:13px;color:#8b95a3;padding:0 2px;line-height:1}
.cmt-btn:hover{color:#1b4dc2}
.cmt-btn.hat{color:#8a6300}
.cmt{margin-top:8px;background:#fffbe8;border:1px solid #ecdfae;border-radius:8px;padding:7px 12px;font-size:13px;line-height:1.5;color:#4d4a33;max-width:92ch;white-space:pre-wrap;outline:none}
.cmt:focus{border-color:#d9c264;box-shadow:0 0 0 3px rgba(217,194,100,.18)}
.cmt:empty::before{content:attr(data-ph);color:#b3a76a}
#export-stamp{display:none;font-size:12px;color:#5b6572;margin-top:6px}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #tools{display:none}
  .cmt-btn{display:none}
  .cmt:empty{display:none}
  .cmt{background:#fffbe8 !important;border:1px solid #ecdfae}
  .card:has(> #avx-tally){position:static;box-shadow:none;border:1px solid #d8dfe8}
  #export-stamp{display:block}
  .p{break-inside:avoid}
  .blk h3{break-after:avoid}
  .card.blk{break-inside:auto}
  .kpis,.sumband,.sumlegend{break-inside:avoid}
  .avx .cb{color:#1a1a1a}
}
.p .pv b{font-weight:700;color:#1a1a1a}
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
  if (b.group !== curGroup) { curGroup = b.group; body += `<div class=grp>${esc(curGroup)} · ${de(groupSums[curGroup])} PT</div>`; }
  const gate = b.title === KONFIG.gateBlock ? ` <span class=gatetag>GATE 1</span>` : '';
  if (b.title === KONFIG.gateBlock) gateNr = bi;
  body += `<div class='card blk'><h3><span>${bi}. ${esc(b.title)}${gate}</span><span class=bs>Σ ${de(b.pt)} PT</span></h3>`;
  if (b.note) body += `<div class=bnote>${esc(b.note)}</div>`;
  let pi = 0;
  for (const [name, t, hk, an, ri] of b.pos) {
    pi++;
    const spread = Math.abs(t[1]-t[0]) > 5 || Math.abs(t[2]-t[1]) > 5;
    const avx = ['A','K','X'].map(v => `<label class="cb ${v.toLowerCase()}" title="${v==='A'?esc(KONFIG.wirLabel)+' macht es':v==='K'?esc(KONFIG.kundeLabel)+' macht es':'wird gestrichen'}"><input type=checkbox data-k="${bi}.${pi}" data-pt="${t[1]}" value=${v}>${v}</label>`).join('');
    body += `<div class=p data-k="${bi}.${pi}"><div class=pn><span>${bi}.${pi} ${esc(name)}</span><span class=avx>${avx}<button class=cmt-btn type=button title="Kommentar hinzufügen">✎</button></span><span class="pv${spread?" spread":""}">${trip(t)} PT</span></div>`
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
const band = GROUPS.map((g,i)=>`<div style='background:${GRPCOLORS[i%GRPCOLORS.length]};width:${(groupSums[g]/direct*100).toFixed(1)}%'>${de(groupSums[g])}</div>`).join('\n');
const legend = GROUPS.map((g,i)=>`<span><span class=sw style='background:${GRPCOLORS[i%GRPCOLORS.length]}'></span>${esc(g)} <b>${de(groupSums[g])} PT</b></span>`).join('\n');
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

<div class=kpis>
<div class='kpi accent'><div class=v>${de(direct)} <small>PT</small></div><div class=k>Gesamtaufwand (wahrscheinlich)</div></div>
<div class=kpi><div class=v>${de(tmin)}–${de(tmax)} <small>PT</small></div><div class=k>Spanne (Summe aller Minima bzw. Maxima) · PERT-Erwartungswert ≈${de(pert)}</div></div>
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
<div class=sumtotal>${sumFormel} = <b>${de(direct)} PT</b>. Die Blöcke unten (1–${RENDERED_BLOCKS}) tragen zusammen ${de(positionenPt)} PT; ${plPt ? `die ${esc(PL_GROUP)} (${de(plPt)} PT) läuft über die gesamte Laufzeit und ist deshalb nicht als Einzelposition aufgeführt.` : ''}${gateHinweis}</div>
</div></section>

${KONFIG.kalkulationsmodellHtml ? `<div class=dodbox>${KONFIG.kalkulationsmodellHtml}</div>` : ''}

<section><div class=sectitle><h2>${esc(KONFIG.mitwirkungTitel)} (B1–B${CONDITIONS.length})</h2><span class=hint>Grundlage der Kalkulation</span></div>
<div class=card style='padding:6px 8px'><table class=condtab style='width:100%;border-collapse:collapse'>${condRows}</table>
<p style='font-size:12.5px;color:#5b6572;margin:8px 10px'>Entfällt oder verzögert sich eine Mitwirkungsleistung, werden die davon abhängigen Positionen neu bewertet.</p></div></section>

<section><div class=sectitle><h2>Positionen</h2><span class=hint>je Position: min · wahrscheinlich · max PT — <span style="background:#fdecea;border:1px solid #f2c4bd;border-radius:20px;padding:0 8px;color:#7a2a22">rot</span> = min oder max weicht mehr als 5 PT vom wahrscheinlichen Wert ab</span></div>
<div class=card style='padding:10px 18px;margin-bottom:14px;font-size:13.5px'><div id=avx-tally>A = ${esc(KONFIG.wirLabel)} macht es · K = ${esc(KONFIG.kundeLabel)} macht es · X = wird gestrichen</div><div id=export-stamp></div></div>
${body}</section>

${KONFIG.schlussHtml ? `<div class=callout>${KONFIG.schlussHtml}</div>` : ''}

<footer>${KONFIG.fusszeile}</footer>
<script>
(function(){
var KEY='${KONFIG.speicherKey}';
var state={auswahl:{},kommentare:{}};
try{
  var raw=localStorage.getItem(KEY);
  if(raw){ var p=JSON.parse(raw); if(p&&typeof p==='object'){ state.auswahl=p.auswahl||{}; state.kommentare=p.kommentare||{}; } }
}catch(e){}
function save(){ try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){} }

var boxes=[].slice.call(document.querySelectorAll('.avx input'));
var cmts=[].slice.call(document.querySelectorAll('.cmt'));

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

function tally(){
  var sum={A:[0,0],K:[0,0],X:[0,0]},open=0,openPt=0,seen={};
  boxes.forEach(function(b){
    if(seen[b.dataset.k])return; seen[b.dataset.k]=1;
    var sel=null; boxes.forEach(function(o){ if(o.dataset.k===b.dataset.k&&o.checked) sel=o; });
    var pt=+b.dataset.pt;
    if(sel){ sum[sel.value][0]++; sum[sel.value][1]+=pt; } else { open++; openPt+=pt; }
  });
  document.getElementById('avx-tally').innerHTML=
    "<b style='color:#1b4dc2'>A ${esc(KONFIG.wirLabel)}: "+sum.A[0]+" Pos. \u00b7 "+sum.A[1]+" PT</b> &nbsp;\u00b7&nbsp; "+
    "<b style='color:#0f7b52'>K ${esc(KONFIG.kundeLabel)}: "+sum.K[0]+" Pos. \u00b7 "+sum.K[1]+" PT</b> &nbsp;\u00b7&nbsp; "+
    "<b style='color:#b3261e'>X gestrichen: "+sum.X[0]+" Pos. \u00b7 "+sum.X[1]+" PT</b> &nbsp;\u00b7&nbsp; "+
    "<span style='color:#8b95a3'>offen: "+open+" Pos. \u00b7 "+openPt+" PT \u2014 wahrscheinliche Werte, ohne anteilige Projektleitung; Auswahl und Kommentare werden lokal im Browser gespeichert</span>";
}
tally();

// ── JSON-Export/-Import ──
function exportJson(){
  var positionen=[].slice.call(document.querySelectorAll('.p[data-k]')).map(function(p){
    var k=p.dataset.k;
    return { pos:k,
      titel:p.querySelector('.pn span').textContent.replace(k,'').trim(),
      ptWahrscheinlich:+p.querySelector('.avx input').dataset.pt,
      auswahl:state.auswahl[k]||null,
      kommentar:state.kommentare[k]||null };
  });
  var d=new Date();
  var pad=function(x){return (x<10?'0':'')+x;};
  var datum=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  var doc={ format:'${KONFIG.speicherKey}-auswahl', version:1,
    dokument:document.title, exportiertAm:d.toISOString(),
    legende:{A:'${KONFIG.wirLabel} macht es',K:'${KONFIG.kundeLabel} macht es',X:'wird gestrichen'},
    auswahl:state.auswahl, kommentare:state.kommentare, positionen:positionen };
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

// ── Werkzeugleiste ──
var tools=document.createElement('div'); tools.id='tools';
var b1=document.createElement('button'); b1.type='button'; b1.textContent='Als PDF exportieren';
b1.title='\u00d6ffnet den Druckdialog \u2014 dort \u201eAls PDF speichern\u201c w\u00e4hlen. Auswahl und Kommentare werden mit ausgegeben.';
b1.addEventListener('click',function(){window.print();});
var b2=document.createElement('button'); b2.type='button'; b2.className='sec'; b2.textContent='JSON exportieren';
b2.title='Speichert Auswahl und Kommentare als Datei \u2014 zum Weitergeben oder sp\u00e4teren Einspielen.';
b2.addEventListener('click',exportJson);
var fi=document.createElement('input'); fi.type='file'; fi.accept='.json,application/json'; fi.hidden=true;
fi.addEventListener('change',function(){ if(fi.files[0]) importJson(fi.files[0]); fi.value=''; });
var b3=document.createElement('button'); b3.type='button'; b3.className='sec'; b3.textContent='JSON importieren';
b3.title='Spielt eine zuvor exportierte Auswahl-Datei ein \u2014 \u00fcberschreibt die aktuelle Auswahl und Kommentare.';
b3.addEventListener('click',function(){fi.click();});
tools.appendChild(b1); tools.appendChild(b2); tools.appendChild(b3); tools.appendChild(fi);
document.body.appendChild(tools);

window.addEventListener('beforeprint',function(){
  var d=new Date();
  var p=function(x){return (x<10?'0':'')+x;};
  document.getElementById('export-stamp').textContent=
    'Exportiert am '+p(d.getDate())+'.'+p(d.getMonth()+1)+'.'+d.getFullYear()+' um '+p(d.getHours())+':'+p(d.getMinutes())+' Uhr \u2014 die abgebildete A/K/X-Zuordnung und die Kommentare sind der Stand zu diesem Zeitpunkt.';
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
