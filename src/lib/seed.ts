import type { AppData, Chapter, Citation, Meeting, Publication, WritingSession } from '../types';
import { addDays, today, toTime } from './date';

/**
 * Sample data so the dashboard is useful on first open. Everything is editable,
 * and "Start fresh" in Settings clears it. Dates are anchored to real calendar
 * dates around a 2026–27 writing year.
 */

const chapters: Chapter[] = [
  {
    id: 'ch0',
    number: 0,
    title: 'Introduction: Paper Afterlives',
    status: 'drafting',
    wordCount: 3200,
    targetWords: 10000,
    deadline: '2027-04-30',
    stages: {
      drafting: { start: '2026-11-01', end: '2027-01-31' },
      revising: { start: '2027-02-01', end: '2027-03-15' },
      review: { start: '2027-03-16', end: '2027-04-15' },
    },
    notes: 'Frame around the archive-as-afterlife argument; return to it once Ch. 4 is drafted.',
  },
  {
    id: 'ch1',
    number: 1,
    title: 'Ephemeral Things: Clippings and the Antebellum Reader',
    status: 'complete',
    wordCount: 14800,
    targetWords: 14000,
    deadline: '2026-04-15',
    stages: {
      drafting: { start: '2025-09-01', end: '2025-12-15' },
      revising: { start: '2026-01-05', end: '2026-02-28' },
      review: { start: '2026-03-01', end: '2026-04-10' },
    },
    notes: 'Approved by advisor April 2026. Section 3 adapted for the C19 talk.',
  },
  {
    id: 'ch2',
    number: 2,
    title: 'The Scrapbook as Archive',
    status: 'review',
    wordCount: 13100,
    targetWords: 14000,
    deadline: '2026-12-15',
    stages: {
      drafting: { start: '2026-01-10', end: '2026-05-15' },
      revising: { start: '2026-05-16', end: '2026-09-30' },
      review: { start: '2026-10-01', end: '2026-11-30' },
    },
    notes: 'With advisor since Oct 1. Expect comments on the Stoler/Steedman framing.',
  },
  {
    id: 'ch3',
    number: 3,
    title: 'Reprinting the Dead: Elegy and Exchange',
    status: 'revising',
    wordCount: 11600,
    targetWords: 14000,
    deadline: '2027-02-15',
    stages: {
      drafting: { start: '2026-04-01', end: '2026-09-15' },
      revising: { start: '2026-09-16', end: '2026-12-20' },
      review: { start: '2027-01-05', end: '2027-02-05' },
    },
    notes: 'Restructure around the exchange-paper network; cut the Poe digression.',
  },
  {
    id: 'ch4',
    number: 4,
    title: 'Circulating Libraries and Black Atlantic Readers',
    status: 'drafting',
    wordCount: 5400,
    targetWords: 14000,
    deadline: '2027-05-31',
    stages: {
      drafting: { start: '2026-08-15', end: '2027-01-31' },
      revising: { start: '2027-02-01', end: '2027-04-15' },
      review: { start: '2027-04-16', end: '2027-05-20' },
    },
    notes: 'Archive trip in January for the subscription-library ledgers.',
  },
  {
    id: 'ch5',
    number: 5,
    title: 'Coda: The Digital Afterlife of Print',
    status: 'not_started',
    wordCount: 0,
    targetWords: 5000,
    deadline: '2027-06-30',
    stages: {
      drafting: { start: '2027-03-01', end: '2027-04-30' },
      revising: { start: '2027-05-01', end: '2027-05-31' },
      review: { start: '2027-06-01', end: '2027-06-20' },
    },
    notes: '',
  },
];

/** Deterministic pseudo-random generator so sample data is stable across reloads. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildSessions(): WritingSession[] {
  const rand = rng(42);
  const out: WritingSession[] = [];
  const end = today() < '2026-11-16' ? today() : '2026-11-16';
  let d = '2026-01-05';
  let i = 0;
  while (d <= end) {
    // Roughly 3–4 writing days per week; fewer in August (archive travel).
    const p = d.slice(5, 7) === '08' ? 0.3 : 0.52;
    if (rand() < p) {
      const active = chapters.filter((c) =>
        (['drafting', 'revising'] as const).some((k) => d >= c.stages[k].start && d <= c.stages[k].end),
      );
      if (active.length) {
        const ch = active[Math.floor(rand() * active.length)];
        const kind = d >= ch.stages.revising.start ? 'revising' : 'drafting';
        const words = Math.round((kind === 'drafting' ? 450 + rand() * 1050 : 200 + rand() * 650) / 10) * 10;
        out.push({
          id: `s${i++}`,
          date: d,
          chapterId: ch.id,
          words,
          minutes: Math.round((60 + rand() * 150) / 15) * 15,
          kind,
          note: '',
        });
      }
    }
    d = addDays(d, 1);
  }
  return out;
}

const c = (p: Partial<Citation> & Pick<Citation, 'id' | 'authors' | 'title' | 'year' | 'type'>): Citation => ({
  container: '',
  volume: '',
  publisher: '',
  place: '',
  pages: '',
  chapterIds: [],
  status: 'read',
  tags: [],
  notes: '',
  addedOn: '2026-02-01',
  ...p,
});

const citations: Citation[] = [
  c({ id: 'c1', authors: 'McGill, Meredith L.', title: 'American Literature and the Culture of Reprinting, 1834–1853', year: '2003', type: 'Monograph', publisher: 'University of Pennsylvania Press', place: 'Philadelphia', chapterIds: ['ch1', 'ch3'], status: 'cited', tags: ['reprinting', 'print culture'], addedOn: '2025-08-20' }),
  c({ id: 'c2', authors: 'Garvey, Ellen Gruber', title: 'Writing with Scissors: American Scrapbooks from the Civil War to the Harlem Renaissance', year: '2013', type: 'Monograph', publisher: 'Oxford University Press', place: 'New York', chapterIds: ['ch1', 'ch2'], status: 'cited', tags: ['scrapbooks'], addedOn: '2025-08-22' }),
  c({ id: 'c3', authors: 'Derrida, Jacques', title: 'Archive Fever: A Freudian Impression', year: '1996', type: 'Monograph', publisher: 'University of Chicago Press', place: 'Chicago', chapterIds: ['ch0', 'ch2'], status: 'annotated', tags: ['archive theory'], notes: 'Trans. Eric Prenowitz.', addedOn: '2025-09-02' }),
  c({ id: 'c4', authors: 'Steedman, Carolyn', title: 'Dust: The Archive and Cultural History', year: '2002', type: 'Monograph', publisher: 'Rutgers University Press', place: 'New Brunswick, NJ', chapterIds: ['ch2'], status: 'cited', tags: ['archive theory'], addedOn: '2026-01-12' }),
  c({ id: 'c5', authors: 'Stoler, Ann Laura', title: 'Along the Archival Grain: Epistemic Anxieties and Colonial Common Sense', year: '2009', type: 'Monograph', publisher: 'Princeton University Press', place: 'Princeton', chapterIds: ['ch2', 'ch4'], status: 'annotated', tags: ['archive theory', 'method'], addedOn: '2026-01-15' }),
  c({ id: 'c6', authors: 'Gitelman, Lisa', title: 'Paper Knowledge: Toward a Media History of Documents', year: '2014', type: 'Monograph', publisher: 'Duke University Press', place: 'Durham', chapterIds: ['ch0', 'ch5'], status: 'read', tags: ['media history'], addedOn: '2026-03-04' }),
  c({ id: 'c7', authors: 'Price, Leah', title: 'How to Do Things with Books in Victorian Britain', year: '2012', type: 'Monograph', publisher: 'Princeton University Press', place: 'Princeton', chapterIds: ['ch1'], status: 'cited', tags: ['book history'], addedOn: '2025-10-01' }),
  c({ id: 'c8', authors: 'Hartman, Saidiya', title: 'Venus in Two Acts', year: '2008', type: 'Journal article', container: 'Small Axe', volume: '12, no. 2', pages: '1–14', chapterIds: ['ch4'], status: 'annotated', tags: ['method', 'Black Atlantic'], addedOn: '2026-06-10' }),
  c({ id: 'c9', authors: 'Trouillot, Michel-Rolph', title: 'Silencing the Past: Power and the Production of History', year: '1995', type: 'Monograph', publisher: 'Beacon Press', place: 'Boston', chapterIds: ['ch0', 'ch4'], status: 'read', tags: ['method'], addedOn: '2026-06-12' }),
  c({ id: 'c10', authors: 'Cohen, Lara Langer', title: 'The Fabrication of American Literature: Fraudulence and Antebellum Print Culture', year: '2012', type: 'Monograph', publisher: 'University of Pennsylvania Press', place: 'Philadelphia', chapterIds: ['ch3'], status: 'cited', tags: ['print culture'], addedOn: '2026-04-05' }),
  c({ id: 'c11', authors: 'Spires, Derrick R.', title: 'The Practice of Citizenship: Black Politics and Print Culture in the Early United States', year: '2019', type: 'Monograph', publisher: 'University of Pennsylvania Press', place: 'Philadelphia', chapterIds: ['ch4'], status: 'annotated', tags: ['Black print culture'], addedOn: '2026-08-18' }),
  c({ id: 'c12', authors: 'Darnton, Robert', title: 'What Is the History of Books?', year: '1982', type: 'Journal article', container: 'Daedalus', volume: '111, no. 3', pages: '65–83', chapterIds: ['ch0'], status: 'read', tags: ['book history'], addedOn: '2025-08-25' }),
  c({ id: 'c13', authors: 'Benjamin, Walter', title: 'Unpacking My Library', year: '1968', type: 'Book chapter', container: 'Illuminations', publisher: 'Schocken', place: 'New York', pages: '59–67', chapterIds: ['ch2'], status: 'cited', tags: ['collecting'], notes: 'Ed. Hannah Arendt, trans. Harry Zohn.', addedOn: '2026-02-20' }),
  c({ id: 'c14', authors: 'Jackson, H. J.', title: 'Marginalia: Readers Writing in Books', year: '2001', type: 'Monograph', publisher: 'Yale University Press', place: 'New Haven', chapterIds: ['ch1', 'ch4'], status: 'read', tags: ['reading practices'], addedOn: '2026-09-01' }),
  c({ id: 'c15', authors: 'Cvetkovich, Ann', title: 'An Archive of Feelings: Trauma, Sexuality, and Lesbian Public Cultures', year: '2003', type: 'Monograph', publisher: 'Duke University Press', place: 'Durham', chapterIds: ['ch2'], status: 'to_read', tags: ['archive theory', 'affect'], addedOn: '2026-10-08' }),
  c({ id: 'c16', authors: 'Fern, Fanny', title: 'Ruth Hall: A Domestic Tale of the Present Time', year: '1854', type: 'Primary text', publisher: 'Mason Brothers', place: 'New York', chapterIds: ['ch1'], status: 'cited', tags: ['primary'], addedOn: '2025-09-10' }),
  c({ id: 'c17', authors: 'Hawthorne, Nathaniel', title: 'The House of the Seven Gables', year: '1851', type: 'Primary text', publisher: 'Ticknor, Reed, and Fields', place: 'Boston', chapterIds: ['ch3'], status: 'annotated', tags: ['primary'], addedOn: '2026-04-11' }),
  c({ id: 'c18', authors: 'Harper, Frances Ellen Watkins', title: 'Poems on Miscellaneous Subjects', year: '1854', type: 'Primary text', publisher: 'J. B. Yerrinton & Son', place: 'Boston', chapterIds: ['ch3', 'ch4'], status: 'cited', tags: ['primary', 'elegy'], addedOn: '2026-05-02' }),
  c({ id: 'c19', authors: 'Unidentified compiler', title: 'Family scrapbook of newspaper verse and obituaries, c. 1858–1871', year: '1871', type: 'Archival source', container: 'Manuscripts collection (sample entry)', chapterIds: ['ch2', 'ch3'], status: 'annotated', tags: ['archive visit', 'scrapbooks'], notes: 'Photographed 212 leaves; see image log.', addedOn: '2026-03-18' }),
  c({ id: 'c20', authors: 'Subscription library', title: 'Members’ borrowing ledger, 1833–1841', year: '1841', type: 'Archival source', container: 'Institutional records (sample entry)', chapterIds: ['ch4'], status: 'to_read', tags: ['archive visit', 'libraries'], notes: 'Request scans before the January trip.', addedOn: '2026-10-29' }),
  c({ id: 'c21', authors: 'Freedom’s Journal', title: 'Freedom’s Journal (New York), 1827–1829', year: '1829', type: 'Digital resource', container: 'Digitized newspaper run', chapterIds: ['ch4'], status: 'read', tags: ['Black print culture', 'periodicals'], addedOn: '2026-08-20' }),
  c({ id: 'c22', authors: 'Gitelman, Lisa', title: '“Raw Data” Is an Oxymoron', year: '2013', type: 'Edited volume', publisher: 'MIT Press', place: 'Cambridge, MA', chapterIds: ['ch5'], status: 'to_read', tags: ['digital humanities'], notes: 'Editor.', addedOn: '2026-11-02' }),
];

const meetings: Meeting[] = [
  { id: 'm1', date: '2026-01-14', time: '10:00', kind: 'Advisor', attendees: 'Prof. A. Reyes', chapterIds: ['ch1'], agenda: 'Ch. 1 revision plan', notes: 'Tighten the clipping-as-reading argument; move theory up front.', actionItems: [{ id: 'a1', text: 'Send revised Ch. 1 outline', done: true, due: '2026-01-21' }] },
  { id: 'm2', date: '2026-02-11', time: '14:00', kind: 'Writing group', attendees: 'Dissertation writing group', chapterIds: ['ch2'], agenda: 'Workshop Ch. 2 opening', notes: 'Group liked the scrapbook case study; wanted more on genre.', actionItems: [] },
  { id: 'm3', date: '2026-03-04', time: '11:00', kind: 'Advisor', attendees: 'Prof. A. Reyes', chapterIds: ['ch1', 'ch2'], agenda: 'Ch. 1 approval; Ch. 2 draft progress', notes: 'Ch. 1 nearly there — two small fixes.', actionItems: [{ id: 'a2', text: 'Fix footnote style in Ch. 1 (Chicago 17th)', done: true }] },
  { id: 'm4', date: '2026-04-08', time: '15:30', kind: 'Committee', attendees: 'Prof. A. Reyes, Prof. M. Okafor, Prof. L. Brandt', chapterIds: ['ch1', 'ch2', 'ch3'], agenda: 'Annual progress review', notes: 'Committee approved timeline. Okafor suggests Hartman for Ch. 4.', actionItems: [{ id: 'a3', text: 'File annual progress report with the graduate school', done: true, due: '2026-04-30' }, { id: 'a4', text: 'Read Hartman, “Venus in Two Acts”', done: true }] },
  { id: 'm5', date: '2026-04-22', time: '16:00', kind: 'Workshop', attendees: 'Americanist colloquium', chapterIds: ['ch3'], agenda: 'Present “Reprinting the Dead” paper', notes: 'Q&A on the exchange system — follow up on postal rates.', actionItems: [{ id: 'a5', text: 'Look up 1845 postal act on newspaper exchanges', done: true }] },
  { id: 'm6', date: '2026-05-20', time: '10:00', kind: 'Advisor', attendees: 'Prof. A. Reyes', chapterIds: ['ch2'], agenda: 'Ch. 2 full draft', notes: 'Strong draft. Revise structure: archive theory → case studies.', actionItems: [{ id: 'a6', text: 'Reverse-outline Ch. 2', done: true }] },
  { id: 'm7', date: '2026-06-17', time: '13:00', kind: 'Writing group', attendees: 'Dissertation writing group', chapterIds: ['ch3'], agenda: 'Ch. 3 section 2', notes: '', actionItems: [] },
  { id: 'm8', date: '2026-07-15', time: '10:00', kind: 'Advisor', attendees: 'Prof. A. Reyes', chapterIds: ['ch3', 'ch4'], agenda: 'Summer check-in; archive plans', notes: 'Approve archive trip; apply for travel grant.', actionItems: [{ id: 'a7', text: 'Submit travel grant application', done: true, due: '2026-08-01' }] },
  { id: 'm9', date: '2026-09-09', time: '11:00', kind: 'Advisor', attendees: 'Prof. A. Reyes', chapterIds: ['ch2', 'ch3'], agenda: 'Ch. 2 revisions, Ch. 3 draft', notes: 'Ch. 2 ready to send by end of month.', actionItems: [{ id: 'a8', text: 'Send revised Ch. 2 to advisor', done: true, due: '2026-09-30' }] },
  { id: 'm10', date: '2026-09-24', time: '14:00', kind: 'Workshop', attendees: 'Graduate job-market workshop', chapterIds: [], agenda: 'Job letter & writing sample', notes: 'Use Ch. 1 as writing sample.', actionItems: [{ id: 'a9', text: 'Trim Ch. 1 to 25 pp. writing sample', done: false, due: '2026-12-01' }] },
  { id: 'm11', date: '2026-10-21', time: '10:00', kind: 'Advisor', attendees: 'Prof. A. Reyes', chapterIds: ['ch3', 'ch4'], agenda: 'Ch. 3 restructure; Ch. 4 outline', notes: 'Cut the Poe digression. Ch. 4 outline approved.', actionItems: [{ id: 'a10', text: 'Circulate Ch. 3 restructure memo', done: true }, { id: 'a11', text: 'Request ledger scans from the library', done: false, due: '2026-11-25' }] },
  { id: 'm12', date: '2026-11-04', time: '13:00', kind: 'Writing group', attendees: 'Dissertation writing group', chapterIds: ['ch0'], agenda: 'Introduction opening pages', notes: '', actionItems: [{ id: 'a12', text: 'Draft 2-page intro abstract', done: false, due: '2026-11-20' }] },
  { id: 'm13', date: '2026-12-02', time: '10:00', kind: 'Advisor', attendees: 'Prof. A. Reyes', chapterIds: ['ch2', 'ch3'], agenda: 'Comments on Ch. 2; Ch. 3 revision status', notes: '', actionItems: [{ id: 'a13', text: 'Bring list of questions on Ch. 2 comments', done: false, due: '2026-12-02' }] },
  { id: 'm14', date: '2027-01-27', time: '15:00', kind: 'Committee', attendees: 'Prof. A. Reyes, Prof. M. Okafor, Prof. L. Brandt, Prof. S. Iyer', chapterIds: ['ch2', 'ch3', 'ch4'], agenda: 'Mid-year committee meeting', notes: '', actionItems: [] },
];

const publications: Publication[] = [
  { id: 'p1', title: 'Scissors and Sentiment: Clipping Practices in Antebellum Albums', venue: 'Early American Literature', type: 'Journal article', status: 'under_review', coauthors: '', relatedChapterId: 'ch1', submittedOn: '2026-08-30', decisionOn: '', notes: 'Expected decision ~3–4 months.' },
  { id: 'p2', title: 'Reprinting the Dead: Newspaper Elegy and the Exchange System', venue: 'C19 Conference', type: 'Conference paper', status: 'accepted', coauthors: '', relatedChapterId: 'ch3', submittedOn: '2026-09-15', decisionOn: '2026-11-02', notes: 'Panel on periodical poetry.' },
  { id: 'p3', title: 'Paper Monuments: Mourning Scrapbooks after 1865', venue: 'J19: The Journal of Nineteenth-Century Americanists', type: 'Journal article', status: 'revise_resubmit', coauthors: '', relatedChapterId: 'ch2', submittedOn: '2026-03-01', decisionOn: '2026-07-10', notes: 'R&R due Jan 15. Reader 2 wants more on material form.' },
  { id: 'p4', title: 'Review of a recent study of newspaper poetry', venue: 'American Periodicals', type: 'Book review', status: 'published', coauthors: '', relatedChapterId: '', submittedOn: '2026-02-10', decisionOn: '2026-05-01', notes: '' },
  { id: 'p5', title: 'What Our Grandmothers Clipped', venue: 'Department public humanities blog', type: 'Public humanities', status: 'published', coauthors: '', relatedChapterId: 'ch1', submittedOn: '2026-04-20', decisionOn: '2026-04-28', notes: '' },
  { id: 'p6', title: 'Borrowers’ Ledgers and Black Reading Publics', venue: '', type: 'Journal article', status: 'idea', coauthors: '', relatedChapterId: 'ch4', submittedOn: '', decisionOn: '', notes: 'After the January archive trip.' },
  { id: 'p7', title: 'Clipping the Nation', venue: 'American Literature', type: 'Journal article', status: 'rejected', coauthors: '', relatedChapterId: 'ch1', submittedOn: '2025-10-01', decisionOn: '2026-01-20', notes: 'Reworked into “Scissors and Sentiment.”' },
  { id: 'p8', title: 'Teaching with Scrapbooks', venue: 'Edited collection on archival pedagogy', type: 'Book chapter', status: 'drafting', coauthors: 'J. Park', relatedChapterId: 'ch2', submittedOn: '', decisionOn: '', notes: 'Abstract accepted; full chapter due March.' },
];

export function sampleData(): AppData {
  return {
    version: 1,
    profile: {
      name: '',
      dissertationTitle: 'Paper Afterlives: Print, Memory, and the Archive in the Nineteenth-Century Atlantic World',
      department: 'Department of English',
      advisor: 'Prof. A. Reyes',
      committee: 'Prof. M. Okafor, Prof. L. Brandt, Prof. S. Iyer (outside reader)',
      targetWords: chapters.reduce((s, ch) => s + ch.targetWords, 0),
      programStart: '2021-08-20',
      defenseDate: '2027-08-20',
    },
    chapters: structuredClone(chapters),
    sessions: buildSessions(),
    citations: structuredClone(citations),
    meetings: structuredClone(meetings),
    publications: structuredClone(publications),
  };
}

export function emptyData(): AppData {
  const t = today();
  return {
    version: 1,
    profile: {
      name: '',
      dissertationTitle: 'Untitled dissertation',
      department: '',
      advisor: '',
      committee: '',
      targetWords: 70000,
      programStart: t,
      defenseDate: addDays(t, 365),
    },
    chapters: [],
    sessions: [],
    citations: [],
    meetings: [],
    publications: [],
  };
}

/** Keep sort stable by date where it matters. */
export function byDate<T extends { date: string }>(a: T, b: T): number {
  return toTime(a.date) - toTime(b.date);
}
