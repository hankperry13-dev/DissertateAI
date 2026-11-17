# DissertateAI

A dissertation dashboard for advanced PhD students and dissertation writers in the humanities. It tracks chapter progress, writing sessions, citations, advisor and committee meetings, and publications. It also has an interactive Gantt timeline you can drag to reschedule, and space to keep the Gantt charts you've made in other tools.

Everything runs in the browser and data stays on your machine (`localStorage` for records, IndexedDB for uploaded files). There is no server or account.

## Designed to stay calm

The interface is kept deliberately simple, using design patterns that help people with ADHD focus:

- **Home answers "what now?"** It shows one big countdown to the next milestone, a short to-do list you can tick off right there, three key numbers and one chart. The other charts wait behind **Show more charts**.
- **One main button per page.** Exports are grouped into a single **Export ▾** menu.
- **Filters stay folded away** behind a **Filters** button, which shows how many filters are on.
- **Delete is in the edit dialog**, never a red icon on every row. Finished action items collapse to "✓ 2 done".
- **One-click Log writing** is pre-filled with today's date and the chapter you're working on.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

The first time you open it, the dashboard loads a sample dissertation so every chart has something in it. Open **Settings** to enter your own details, or choose **Start fresh** to clear the sample.

## Pages

| Page | What it does |
|---|---|
| **Home** | Next up (countdown to the next stage end, deadline or meeting), a to-do list from your meetings, words drafted, chapters done, days to defense, and chapter progress. **Show more charts** opens filterable charts: words over time, writing by month, meetings per month, citations by chapter, sources by type and the publication pipeline. Every chart has a **Table** view. |
| **Chapters** | Each chapter's stage, word count, current stage dates and deadline. Late chapters are flagged. Below it is your writing log. **Log writing** can also add the new words to the chapter's count. |
| **Timeline** | **Interactive timeline:** each chapter has Drafting, Revising and Advisor-review bars. Drag a bar to move it, drag its ends to change its length, and drag ◆ to move the deadline. The toolbar has Zoom, Today, Undo (also Ctrl/⌘+Z) and **Options**: which stages to show, whether moving a stage also moves the later stages, and hiding finished chapters. Click a chapter name to type exact dates. Keyboard: focus a bar and press ←/→ (Shift = a week, Alt = change the end date). Export as SVG or CSV. **Uploaded Gantt charts:** drop in, choose or paste files from MS Project, GanttProject, TeamGantt, Office Timeline, Excel and other tools, and attach them to a chapter. PNG/JPG/SVG/PDF preview inline. Other formats are stored so you can download them again. |
| **Citations** | Your working bibliography, with tags, linked chapters and reading status (to read → read → annotated → cited). Search, plus filters for chapter, type, status and tag. Export a **Chicago bibliography**, **BibTeX** or **CSV** of whatever is filtered. |
| **Meetings** | Choose Upcoming, Past or All. Notes, plus action items you can tick off (overdue ones are flagged). Export CSV, or **.ics** to add upcoming meetings to your calendar. |
| **Publications** | A board from Idea to Published/Declined. Drag cards between columns, and submission and decision dates fill in automatically. There's also a table view, plus awaiting-decision and acceptance-rate counts. |
| **Reports** | Pick a template (monthly advisor update, annual review, committee packet, publications for CV, bibliography), check the preview, then **Print / save as PDF**, or use **Other formats** for HTML, Markdown, CSV, BibTeX or a JSON backup. **Choose sections…** lets you customise. |

## Your data

- Use **Settings → Download backup** to save everything as JSON, and **Restore from backup** to load it on another computer or browser.
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
