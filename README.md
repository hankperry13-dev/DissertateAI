# DissertateAI

A dissertation dashboard for advanced PhD students and dissertation writers in the humanities. It tracks chapter progress, writing sessions, citations, advisor and committee meetings, and publications. It also has an interactive Gantt timeline you can drag to reschedule, and space to keep the Gantt charts you've made in other tools.

Everything runs in the browser and data stays on your machine (`localStorage` for records, IndexedDB for uploaded files). There is no server or account.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

The first time you open it, the dashboard loads a sample dissertation so every chart has something in it. Open **Settings & data** to enter your own details, or choose **Start fresh** to clear the sample.

## Pages

| Page | What it does |
|---|---|
| **Overview** | Stat tiles (words drafted vs. target, chapters complete, pace needed to finish by your defense, sources cited, meetings, items under review) and charts: chapter progress, stage mix, cumulative words, writing by month, meetings per month, citations by chapter, sources by type, publication pipeline. The date range and chapter filters apply to every figure on the page. Each chart has a **Table** toggle. |
| **Chapters & writing** | Chapter list with stage, word count, stage dates and deadline. Late chapters are flagged. A writing log (date, chapter, drafting/revising, words, minutes) with filters. Logging a drafting session can add its words to the chapter's count. |
| **Timeline & Gantt** | **Interactive timeline:** each chapter's Drafting, Revising and Advisor-review bars. Drag a bar to move it, drag its edges to resize it, and drag the ◆ to move the chapter deadline. *Shift later stages* moves the later stages along with the one you drag. You also get undo (Ctrl/⌘+Z), zoom (weeks/months/quarters), Today and defense markers, a date editor for the selected chapter, and CSV/SVG export. Keyboard: focus a bar and press ←/→ (Shift = a week, Alt = resize the end). **Uploaded Gantt charts:** drag in, choose or paste files exported from MS Project, GanttProject, TeamGantt, Office Timeline, Excel and other tools, and attach them to a chapter. PNG/JPG/SVG/PDF preview inline. .mpp/.gan/.xlsx/.csv files are stored so you can download them again. |
| **Citations** | Working bibliography: monographs, articles, archival and primary sources. You can tag sources, link them to chapters and track reading status (to read → read → annotated → cited). Search and filter by chapter, type, status and tag. Exports to **CSV**, **BibTeX** and a **Chicago-style bibliography**, all of which use the filtered list. |
| **Meetings** | Advisor, committee, workshop and writing-group meetings with notes and action items you can tick off (overdue items are flagged). Filters for date, kind, chapter and open items. Exports to **CSV** and **.ics** (upcoming meetings, for your calendar). |
| **Publications** | Kanban board from Idea to Published/Declined, with drag-and-drop between columns. Moving a card fills in submission and decision dates. Also has a table view, filters, acceptance rate, days under review and CSV export. |
| **Reports & export** | Templates (monthly advisor update, annual progress review, committee packet, publications for CV, bibliography). Pick the sections, date range and chapter, then preview. Download as **Print / PDF**, **HTML**, **Markdown**, **CSV files**, **BibTeX**, or a full **JSON backup**. |

## Your data

- Use **Settings & data → Download backup** to save everything as JSON, and **Restore from backup** to load it on another computer or browser.
- Uploaded Gantt files are kept in IndexedDB and are **not** included in the JSON backup.
- Clearing site data in your browser deletes the dashboard's data, so keep regular backups.

## Project structure

```
src/
  App.tsx                 shell, hash routing, theme toggle
  store.tsx               app state (React context + reducer), persistence, backup parsing
  types.ts                data model
  lib/                    dates, formatting, filters, exports (CSV/BibTeX/Chicago), IndexedDB, sample data
  components/charts.tsx   small SVG chart kit (bars, stacked bars/columns, line, segmented bar, tooltips, table view)
  components/ui.tsx       modal, fields, stat tiles, filters, icons
  pages/                  one file per page; Timeline.tsx + GanttUploads.tsx for the Gantt page
```

## Colour

Chart colours are CSS custom properties in `src/styles.css`, with separate steps for light and dark mode. The stage colours (blue, orange, aqua, violet) and the single-hue reading-status ramp were checked for colour-blind separation and contrast against the chart surface in both modes. Every chart pairs colour with a legend, labels and a table view, so you never have to tell series apart by colour alone.
