import type { AppData, Chapter, Citation, Meeting, Publication, WritingSession } from '../types';
import { inRange, resolveRange, type DateFilter } from './date';

export interface GlobalFilter {
  range: DateFilter;
  chapterId: string; // '' = all chapters
}

export interface Filtered {
  chapters: Chapter[];
  sessions: WritingSession[];
  citations: Citation[];
  meetings: Meeting[];
  publications: Publication[];
  bounds: { start: string | null; end: string | null };
}

/**
 * One filter slice shared by every chart, figure and table on a page, so the
 * numbers always agree. Dates: sessions by date, citations by date added,
 * meetings by date, publications by submission or decision date.
 */
export function applyFilter(data: AppData, f: GlobalFilter): Filtered {
  const bounds = resolveRange(f.range);
  const ch = f.chapterId;
  const unbounded = !bounds.start && !bounds.end;
  return {
    bounds,
    chapters: ch ? data.chapters.filter((c) => c.id === ch) : data.chapters,
    sessions: data.sessions.filter((s) => (!ch || s.chapterId === ch) && inRange(s.date, bounds)),
    citations: data.citations.filter((c) => (!ch || c.chapterIds.includes(ch)) && (unbounded || inRange(c.addedOn, bounds))),
    meetings: data.meetings.filter((m) => (!ch || m.chapterIds.includes(ch)) && inRange(m.date, bounds)),
    publications: data.publications.filter(
      (p) => (!ch || p.relatedChapterId === ch) && (unbounded || inRange(p.submittedOn, bounds) || inRange(p.decisionOn, bounds)),
    ),
  };
}

export function describeFilter(f: GlobalFilter, chapterName: (id: string) => string): string {
  const b = resolveRange(f.range);
  const range = !b.start && !b.end ? 'All dates' : `${b.start ?? '…'} to ${b.end ?? '…'}`;
  return `${range} · ${f.chapterId ? chapterName(f.chapterId) : 'All chapters'}`;
}
