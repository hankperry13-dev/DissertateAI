/** ISO calendar date, `YYYY-MM-DD`. */
export type ISODate = string;

export type StageKey = 'drafting' | 'revising' | 'review';
export type ChapterStatus = 'not_started' | StageKey | 'complete';

export interface DateSpan {
  start: ISODate;
  end: ISODate;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  status: ChapterStatus;
  wordCount: number;
  targetWords: number;
  /** The date the chapter is due to the committee. */
  deadline: ISODate;
  stages: Record<StageKey, DateSpan>;
  notes: string;
}

export interface WritingSession {
  id: string;
  date: ISODate;
  chapterId: string;
  words: number;
  minutes: number;
  kind: 'drafting' | 'revising';
  note: string;
}

export type CitationType =
  | 'Monograph'
  | 'Journal article'
  | 'Book chapter'
  | 'Edited volume'
  | 'Archival source'
  | 'Primary text'
  | 'Dissertation'
  | 'Digital resource';

export type CitationStatus = 'to_read' | 'read' | 'annotated' | 'cited';

export interface Citation {
  id: string;
  authors: string;
  title: string;
  year: string;
  type: CitationType;
  /** Journal, edited volume or archive/collection name. */
  container: string;
  /** Volume/issue for articles, e.g. `12, no. 2`. */
  volume: string;
  publisher: string;
  place: string;
  pages: string;
  chapterIds: string[];
  status: CitationStatus;
  tags: string[];
  notes: string;
  addedOn: ISODate;
}

export type MeetingKind = 'Advisor' | 'Committee' | 'Workshop' | 'Writing group';

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
  due?: ISODate;
}

export interface Meeting {
  id: string;
  date: ISODate;
  time: string;
  kind: MeetingKind;
  attendees: string;
  chapterIds: string[];
  agenda: string;
  notes: string;
  actionItems: ActionItem[];
}

export type PublicationType =
  | 'Journal article'
  | 'Book chapter'
  | 'Conference paper'
  | 'Book review'
  | 'Public humanities';

export type PublicationStatus =
  | 'idea'
  | 'drafting'
  | 'submitted'
  | 'under_review'
  | 'revise_resubmit'
  | 'accepted'
  | 'published'
  | 'rejected';

export interface Publication {
  id: string;
  title: string;
  venue: string;
  type: PublicationType;
  status: PublicationStatus;
  coauthors: string;
  relatedChapterId: string;
  submittedOn: ISODate;
  decisionOn: ISODate;
  notes: string;
}

export interface Profile {
  name: string;
  dissertationTitle: string;
  department: string;
  advisor: string;
  committee: string;
  targetWords: number;
  programStart: ISODate;
  defenseDate: ISODate;
}

export interface AppData {
  version: 1;
  profile: Profile;
  chapters: Chapter[];
  sessions: WritingSession[];
  citations: Citation[];
  meetings: Meeting[];
  publications: Publication[];
}

/** Metadata for an uploaded third-party Gantt chart. The file itself lives in IndexedDB. */
export interface GanttUpload {
  id: string;
  name: string;
  mime: string;
  size: number;
  chapterId: string;
  note: string;
  source: string;
  uploadedAt: string;
}
