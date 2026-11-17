import type { Citation } from '../types';

export function download(filename: string, content: BlobPart, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | boolean | undefined | null };

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutralise spreadsheet formula injection from free-text fields.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(','));
  // BOM so Excel opens UTF-8 (curly quotes, diacritics) correctly.
  return `﻿${[head, ...body].join('\r\n')}`;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  download(filename, toCsv(rows, columns), 'text/csv;charset=utf-8');
}

const BIB_TYPE: Record<Citation['type'], string> = {
  Monograph: 'book',
  'Journal article': 'article',
  'Book chapter': 'incollection',
  'Edited volume': 'book',
  'Archival source': 'unpublished',
  'Primary text': 'book',
  Dissertation: 'phdthesis',
  'Digital resource': 'online',
};

function bibKey(c: Citation, used: Set<string>): string {
  const last = (c.authors.split(',')[0] || 'anon').toLowerCase().replace(/[^a-z]/g, '') || 'anon';
  const word = (c.title.toLowerCase().match(/[a-z]{4,}/) || ['work'])[0];
  let key = `${last}${c.year}${word}`;
  let n = 1;
  while (used.has(key)) key = `${last}${c.year}${word}${++n}`;
  used.add(key);
  return key;
}

const bibEscape = (s: string) => s.replace(/([&%$#_{}])/g, '\\$1');

export function toBibtex(cites: Citation[]): string {
  const used = new Set<string>();
  return cites
    .map((c) => {
      const type = BIB_TYPE[c.type];
      const fields: [string, string][] = [
        ['author', c.authors.replace(/;\s*/g, ' and ')],
        ['title', `{${c.title}}`],
        ['year', c.year],
      ];
      if (type === 'article') fields.push(['journal', c.container]);
      else if (type === 'incollection') fields.push(['booktitle', c.container]);
      else if (c.container) fields.push(['howpublished', c.container]);
      if (c.publisher) fields.push(['publisher', c.publisher]);
      if (c.place) fields.push(['address', c.place]);
      if (c.volume) {
        const [vol, num] = c.volume.split(/,\s*no\.\s*/);
        fields.push(['volume', vol]);
        if (num) fields.push(['number', num]);
      }
      if (c.pages) fields.push(['pages', c.pages.replace('–', '--')]);
      if (c.notes) fields.push(['note', c.notes]);
      if (c.tags.length) fields.push(['keywords', c.tags.join(', ')]);
      const body = fields
        .filter(([, v]) => v)
        .map(([k, v]) => `  ${k} = {${bibEscape(v)}}`)
        .join(',\n');
      return `@${type}{${bibKey(c, used)},\n${body}\n}`;
    })
    .join('\n\n');
}

/** Chicago Manual of Style (notes-bibliography) bibliography entry, plain text with *italics* markers. */
export function chicago(c: Citation, italic: (s: string) => string = (s) => `*${s}*`): string {
  const a = c.authors.trim();
  const authors = a ? `${a.replace(/\.$/, '')}. ` : '';
  const pub = [c.place, c.publisher].filter(Boolean).join(': ');
  switch (c.type) {
    case 'Journal article':
      return `${authors}“${c.title}.” ${italic(c.container)}${c.volume ? ` ${c.volume}` : ''} (${c.year})${c.pages ? `: ${c.pages}` : ''}.`;
    case 'Book chapter':
      return `${authors}“${c.title}.” In ${italic(c.container)}${c.pages ? `, ${c.pages}` : ''}. ${pub ? `${pub}, ` : ''}${c.year}.`;
    case 'Archival source':
      return `${authors}${c.title}. ${c.container ? `${c.container}.` : ''}`.trim();
    case 'Digital resource':
      return `${authors}${italic(c.title)}. ${c.container ? `${c.container}.` : ''}`.trim();
    case 'Dissertation':
      return `${authors}“${c.title}.” PhD diss., ${c.publisher || c.container}, ${c.year}.`;
    default:
      return `${authors}${italic(c.title)}. ${pub ? `${pub}, ` : ''}${c.year}.`;
  }
}

export function sortBibliography(cites: Citation[]): Citation[] {
  return [...cites].sort((x, y) => x.authors.localeCompare(y.authors) || x.year.localeCompare(y.year));
}

export function safeFilename(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'export';
}
