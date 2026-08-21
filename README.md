# Schätzung — Effort Estimation Skill for Claude Code

Interactive effort-estimation pages as self-contained HTML — built to be **discussed with the
customer**, not just read. One generator script, one data structure, zero dependencies.

> Output language is **German** (estimates for German-speaking customers). The skill instructions
> are German as well.

## Features

- **Three-point estimates** (min · likely · max) per position, rolled up automatically:
  totals, range, PERT expected value, group summary band
- **Derivation per position**: origin of the requirement (Herkunft), assumptions (Annahme),
  risks (Risiko) — the estimate explains itself
- **Customer collaboration built in**:
  - **A/K/X checkboxes** per position (we do it / customer does it / cut) with a sticky
    live tally of positions and person-days per category
  - **Value selection** per position: click min / likely / max or type a custom PT value —
    block, group and total sums follow live ("Σ 41 → 49 PT")
  - **Live offer total**: the KPI tiles, the composition bar and a summary line follow the
    current cut — only positions marked A (or not yet assigned) count, K/X are excluded,
    and the project-management share scales proportionally
  - **Comment fields** per position (✎), auto-saved
  - **JSON export/import** — hand the negotiation state around or archive it
  - **Toolbar with two dropdowns**: "Exportieren" (PDF · Excel) and "JSON" (export · import)
  - **Excel export** (.xlsx, no library): filterable position table with three-point values,
    chosen value, A/K/X and comments, an "offer PT" column (0 for K/X), SUM rows for positions,
    proportional project management and grand total, plus an info sheet
  - **PDF export** via print dialog with a timestamp stamp ("state as of …")
- **Contribution conditions** (B1–Bn): customer obligations the calculation depends on,
  as a first-class table
- **Guard rails**: hard build failure when a block sum doesn't match its positions;
  automatic red highlight when min/max deviates more than 5 PT from the likely value;
  a project-lead group that appears in the summary band but not as a line-item block
- **Self-contained output**: all CSS and JS inlined, works from `file://`, selection state
  persists in `localStorage` (key configurable per project)

## Installation

### As Claude Code Plugin (recommended)

```bash
# Add marketplace
/plugin marketplace add SeBastArt/schaetzung-skill

# Install plugin
/plugin install schaetzung@SeBastArt-schaetzung-skill
```

### As Standalone Skill

```bash
# Personal (all projects)
cp -r skills/schaetzung ~/.claude/skills/schaetzung

# Project-specific
cp -r skills/schaetzung .claude/skills/schaetzung
```

### For Development (single source of truth)

```powershell
# Windows (junction, no admin rights needed)
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\schaetzung" -Target "C:\path\to\schaetzung-skill\skills\schaetzung"
```

```bash
# macOS / Linux
ln -s /path/to/schaetzung-skill/skills/schaetzung ~/.claude/skills/schaetzung
```

## Usage

Ask Claude for an "Aufwandsschätzung als Seite" (or any of the triggers in the skill
description). Claude copies `templates/schaetzung-build.js` into your project, fills in three
marked sections — `KONFIG` (titles, storage key, labels), `BLOCKS` (groups → blocks →
positions with three-point values and derivation) and `CONDITIONS` (customer obligations) —
then runs:

```bash
node schaetzung-build.js
```

The console prints totals, range, PERT and the project-lead share; the HTML lands next to the
script. **Never edit the generated HTML** — change the data, rebuild.

## Works well with

[`c4-skill`](https://github.com/SeBastArt/c4-skill) — model the architecture first, derive the
estimation blocks from its design decisions. The estimation skill does not require C4, though.

## License

MIT
