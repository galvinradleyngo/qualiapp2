// Core project data model. Field names intentionally match the legacy app's
// IndexedDB `data` keys/shapes where behavior is being ported 1:1, so a
// project's records can be read directly out of `dataGetAll` without a
// translation layer.

export interface ActivityLogEntry {
  id: string;
  type: string;
  note: string;
  timestamp: string;
}

export interface AudioFileRef {
  id: string;
  key: string;
  name: string;
}

export interface AudioBookmark {
  id: string;
  timeSec: number;
  label: string;
}

export type Modality = '' | 'online' | 'onsite';

export interface Transcript {
  id: string;
  title: string;
  folder: string;
  modality: Modality;
  content: string;
  /** Rich-text mirror of `content` for the Edit tab (bold + interviewer-tag spans only —
   * never inserts/removes characters, so `content` stays valid for coding offsets). */
  contentHtml: string;
  notes: string;
  hasAudio: boolean;
  audioFiles: AudioFileRef[];
  bookmarks: AudioBookmark[];
  participantId: string | null;
  createdAt: string;
  activityLog: ActivityLogEntry[];
  playbackRate?: number;
}

/** An in-vivo coded excerpt in a transcript. Character offsets into `content`. */
export interface Tag {
  id: string;
  transcriptId: string;
  category: string;
  tagName: string;
  memo: string;
  textSnippet: string;
  start: number;
  end: number;
}

export interface Observation {
  id: string;
  title: string;
  location: string;
  date: string;
  folder: string;
  content: string;
  /** Rich-text mirror of `content` for the Field Notes tab — see Transcript.contentHtml. */
  contentHtml: string;
  notes: string;
  hasAudio: boolean;
  audioFiles: AudioFileRef[];
  bookmarks: AudioBookmark[];
  createdAt: string;
  playbackRate?: number;
}

/** Same shape/mechanics as Tag, keyed to an observation instead of a transcript. */
export interface ObservationTag {
  id: string;
  observationId: string;
  category: string;
  tagName: string;
  memo: string;
  textSnippet: string;
  start: number;
  end: number;
}

export interface ArtifactFileRef {
  id: string;
  key: string;
  name: string;
  type: string;
  size: number;
  lastModified: number | null;
}

export interface GlobalArtifact {
  id: string;
  name: string;
  type: string;
  date: string;
  notes: string;
  comments: string;
  codes: string[];
  folder: string;
  files: ArtifactFileRef[];
}

export interface Participant {
  id: string;
  pseudonym: string;
  actualName: string;
  interviewDate: string;
  notes: string;
  createdAt: string;
  consentFormId: string | null;
  consentFileName: string | null;
}

export interface CodeDefinitionRecord {
  definition: string;
  inclusion: string;
  exclusion: string;
  exemplars: string;
}

export type CodeDefinitions = Record<string, CodeDefinitionRecord>;
export type CategoryDefinitions = Record<string, CodeDefinitionRecord>;

export interface AnalysisCategory {
  id: string;
  name: string;
  code: string;
  codes: string[];
}

export interface AnalysisTheme {
  id: string;
  name: string;
  categories: string[];
}

export type ConnectionRationale = 'A' | 'B' | 'C' | '';

export interface AnalysisCanvas {
  id: string;
  name: string;
  categories: AnalysisCategory[];
  themes: AnalysisTheme[];
  connections: Record<string, Record<string, 0 | 1>>;
  connectionNotes: Record<string, string>;
  connectionRationales: Record<string, Record<string, ConnectionRationale>>;
}

export interface SourceFilterPreset {
  id: string;
  name: string;
  selectedIds: string[];
  availableIds: string[];
  updatedAt: string;
}

export interface TriangulationSession {
  id: string;
  coderId: string;
  packageId: string | null;
  projectFingerprint: string | null;
  importedAt: string;
  tags: Tag[];
  artifactCodes: Array<{ artifactId: string; artifactName: string; codes: string[] }>;
  analysisCanvases: AnalysisCanvas[];
}

export interface TriangulationAssignmentMeta {
  packageId: string;
  projectFingerprint: string;
  importedAt: string;
}

export const DEFAULT_ACTIVITY_TYPES = ['Edited', 'First Review', 'Coded', 'Member Checked'];

/** The full set of `data` keys a project's Dexie `data` table can hold. */
export interface ProjectData {
  transcripts: Transcript[];
  folders: string[];
  tags: Tag[];
  globalArtifacts: GlobalArtifact[];
  activityTypes: string[];
  participants: Participant[];
  analysisCanvases: AnalysisCanvas[];
  sourceFilterPresets: SourceFilterPreset[];
  triangulationSessions: TriangulationSession[];
  triangulationAssignmentMeta: TriangulationAssignmentMeta | null;
  codeDefinitions: CodeDefinitions;
  categoryDefinitions: CategoryDefinitions;
  observations: Observation[];
  observationTags: ObservationTag[];
}

export const EMPTY_PROJECT_DATA: ProjectData = {
  transcripts: [],
  folders: [],
  tags: [],
  globalArtifacts: [],
  activityTypes: [...DEFAULT_ACTIVITY_TYPES],
  participants: [],
  analysisCanvases: [],
  sourceFilterPresets: [],
  triangulationSessions: [],
  triangulationAssignmentMeta: null,
  codeDefinitions: {},
  categoryDefinitions: {},
  observations: [],
  observationTags: [],
};
