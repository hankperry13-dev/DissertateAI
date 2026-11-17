import type {
  ChapterStatus,
  CitationStatus,
  CitationType,
  MeetingKind,
  PublicationStatus,
  PublicationType,
  StageKey,
} from '../types';

/**
 * Chart colours are CSS custom properties defined in styles.css (light + dark steps).
 * Stage hues follow the validated categorical order: blue, orange, aqua, violet.
 */
export const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: 'drafting', label: 'Drafting', color: 'var(--series-1)' },
  { key: 'revising', label: 'Revising', color: 'var(--series-2)' },
  { key: 'review', label: 'Advisor review', color: 'var(--series-3)' },
];

export const STAGE_LABEL: Record<StageKey, string> = {
  drafting: 'Drafting',
  revising: 'Revising',
  review: 'Advisor review',
};

export const CHAPTER_STATUSES: { key: ChapterStatus; label: string; color: string }[] = [
  { key: 'not_started', label: 'Not started', color: 'var(--neutral-mark)' },
  { key: 'drafting', label: 'Drafting', color: 'var(--series-1)' },
  { key: 'revising', label: 'Revising', color: 'var(--series-2)' },
  { key: 'review', label: 'Advisor review', color: 'var(--series-3)' },
  { key: 'complete', label: 'Complete', color: 'var(--series-7)' },
];

export const CHAPTER_STATUS_LABEL = Object.fromEntries(
  CHAPTER_STATUSES.map((s) => [s.key, s.label]),
) as Record<ChapterStatus, string>;

export const CHAPTER_STATUS_COLOR = Object.fromEntries(
  CHAPTER_STATUSES.map((s) => [s.key, s.color]),
) as Record<ChapterStatus, string>;

/** Ordered states → single-hue ordinal ramp (validated light & dark). */
export const CITATION_STATUSES: { key: CitationStatus; label: string; color: string }[] = [
  { key: 'to_read', label: 'To read', color: 'var(--ord-1)' },
  { key: 'read', label: 'Read', color: 'var(--ord-2)' },
  { key: 'annotated', label: 'Annotated', color: 'var(--ord-3)' },
  { key: 'cited', label: 'Cited', color: 'var(--ord-4)' },
];

export const CITATION_STATUS_LABEL = Object.fromEntries(
  CITATION_STATUSES.map((s) => [s.key, s.label]),
) as Record<CitationStatus, string>;

export const CITATION_TYPES: CitationType[] = [
  'Monograph',
  'Journal article',
  'Book chapter',
  'Edited volume',
  'Archival source',
  'Primary text',
  'Dissertation',
  'Digital resource',
];

export const MEETING_KINDS: { key: MeetingKind; color: string }[] = [
  { key: 'Advisor', color: 'var(--series-1)' },
  { key: 'Committee', color: 'var(--series-2)' },
  { key: 'Workshop', color: 'var(--series-3)' },
  { key: 'Writing group', color: 'var(--series-4)' },
];

export const PUBLICATION_STATUSES: { key: PublicationStatus; label: string }[] = [
  { key: 'idea', label: 'Idea' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under review' },
  { key: 'revise_resubmit', label: 'Revise & resubmit' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Declined' },
];

export const PUBLICATION_STATUS_LABEL = Object.fromEntries(
  PUBLICATION_STATUSES.map((s) => [s.key, s.label]),
) as Record<PublicationStatus, string>;

export const PUBLICATION_TYPES: PublicationType[] = [
  'Journal article',
  'Book chapter',
  'Conference paper',
  'Book review',
  'Public humanities',
];

/** Statuses that count as "in the pipeline" (submitted, awaiting a decision). */
export const PUB_PENDING: PublicationStatus[] = ['submitted', 'under_review', 'revise_resubmit'];
