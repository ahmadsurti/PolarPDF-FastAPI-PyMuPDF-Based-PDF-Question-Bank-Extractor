export type QuestionType = 'mcq' | 'short_answer' | 'descriptive';

export interface MCQOptions {
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  [key: string]: string | undefined;
}

export interface Question {
  sr_no: number;
  unit_number: number | string;
  unit_name?: string;
  type: QuestionType;
  marks: number;
  question: string;
  options?: MCQOptions;
  correct_option?: string | null;
  correct_answer_text?: string | null;
  images?: string[];
  page?: number;
}

export interface Chapter {
  unit_id: string | number;
  unit_title: string;
  questions: Question[];
}

export interface ProjectMetadata {
  source_file?: string;
  source_path?: string;
  extracted_at?: string;
  total_questions?: number;
  total_mcqs?: number;
  total_short_answers?: number;
  total_descriptive?: number;
  total_images?: number;
  total_units?: number;
  parser?: string;
}

export interface ProjectData {
  metadata: ProjectMetadata;
  chapters: Chapter[];
}

export interface Project {
  id: string;
  title: string;
  data: ProjectData;
  updated_at?: string;
}

export type FilterType = 'all' | 'mcq' | 'short_answer' | 'descriptive';
export type FormatTab = 'stream' | 'structured' | 'flat' | 'markdown' | 'csv';

export interface SearchIndexEntry {
  projectId: string;
  projectTitle: string;
  chapterTitle: string;
  q: Question;
  normalizedText: string;
}
