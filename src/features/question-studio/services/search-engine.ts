import type { Project, SearchIndexEntry } from '../types';

export class SearchEngine {
  private index: SearchIndexEntry[] = [];

  rebuild(projects: Project[]): void {
    this.index = [];
    projects.forEach((proj) => {
      (proj.data.chapters || []).forEach((ch) => {
        (ch.questions || []).forEach((q) => {
          const haystack = [
            q.question || '',
            q.correct_answer_text || '',
            Object.values(q.options || {}).join(' '),
            `q${q.sr_no}`,
            String(q.sr_no),
            String(ch.unit_title),
            String(proj.title),
          ]
            .join(' ')
            .toLowerCase();

          this.index.push({
            projectId: proj.id,
            projectTitle: proj.title,
            chapterTitle: ch.unit_title,
            q,
            normalizedText: haystack,
          });
        });
      });
    });
  }

  search(rawQuery: string, limit = 80): SearchIndexEntry[] {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return [];

    const tokens = query.split(/\s+/).filter(Boolean);
    const results: SearchIndexEntry[] = [];

    for (const entry of this.index) {
      if (tokens.every((t) => entry.normalizedText.includes(t))) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }

    return results;
  }
}

export const searchEngine = new SearchEngine();
