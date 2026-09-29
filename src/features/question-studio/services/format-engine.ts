import type { ProjectData, Question } from '../types';

export class FormatEngine {
  static toFlat(data?: ProjectData | null): Question[] {
    if (!data?.chapters) return [];
    return data.chapters.flatMap((ch) => ch.questions || []);
  }

  static toMarkdown(data?: ProjectData | null): string {
    if (!data?.chapters) return '';
    const meta = data.metadata || {};
    let md = `# Question Bank: ${meta.source_file || 'Export'}\n\n`;
    md += `- **Total Questions**: ${meta.total_questions || 0}\n`;
    md += `- **MCQs**: ${meta.total_mcqs || 0}\n`;
    md += `- **Short Answer**: ${meta.total_short_answers || 0}\n`;
    md += `- **Descriptive**: ${meta.total_descriptive || 0}\n\n---\n\n`;

    data.chapters.forEach((ch) => {
      md += `## ${ch.unit_title}\n\n`;
      (ch.questions || []).forEach((q) => {
        md += `### Q${q.sr_no}. ${q.question}\n\n`;
        md += `- **Marks**: ${q.marks} | **Type**: ${q.type.toUpperCase()}\n\n`;
        if (q.images?.length) {
          q.images.forEach((img) => {
            md += `![Fig](${img})\n\n`;
          });
        }
        if (q.type === 'mcq') {
          (['A', 'B', 'C', 'D'] as const).forEach((l) => {
            const cor = q.correct_option === l ? ' *(Correct)*' : '';
            md += `- **(${l})** ${q.options?.[l] || ''}${cor}\n`;
          });
          md += `\n> **Answer**: **${q.correct_option || ''}** ${q.correct_answer_text || ''}\n\n`;
        } else if (q.type === 'short_answer') {
          md += `> **Key**: \`${q.correct_answer_text || ''}\`\n\n`;
        } else {
          md += `*(Descriptive — no key in source)*\n\n`;
        }
        md += `---\n\n`;
      });
    });
    return md;
  }

  static toCSV(data?: ProjectData | null): string {
    const flat = this.toFlat(data);
    const esc = (v: unknown) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const headers = [
      'Sr_No',
      'Unit_Id',
      'Unit_Name',
      'Type',
      'Marks',
      'Question',
      'Option_A',
      'Option_B',
      'Option_C',
      'Option_D',
      'Answer_Key',
      'Answer_Text',
      'Images',
      'Page',
    ];
    const rows = [headers.join(',')];
    flat.forEach((q) => {
      rows.push(
        [
          q.sr_no,
          esc(q.unit_number),
          esc(q.unit_name || ''),
          esc(q.type),
          q.marks,
          esc(q.question),
          esc(q.options?.A || ''),
          esc(q.options?.B || ''),
          esc(q.options?.C || ''),
          esc(q.options?.D || ''),
          esc(q.correct_option || ''),
          esc(q.correct_answer_text || ''),
          esc((q.images || []).join(';')),
          q.page || 1,
        ].join(','),
      );
    });
    return rows.join('\n');
  }

  static updateMetrics(data: ProjectData): void {
    const flat = this.toFlat(data);
    let mcq = 0;
    let short = 0;
    let desc = 0;
    let imgs = 0;

    flat.forEach((q) => {
      if (q.type === 'mcq') mcq++;
      else if (q.type === 'short_answer') short++;
      else desc++;
      if (q.images) imgs += q.images.length;
    });

    data.metadata = {
      ...data.metadata,
      total_questions: flat.length,
      total_mcqs: mcq,
      total_short_answers: short,
      total_descriptive: desc,
      total_images: imgs,
      total_units: data.chapters.length,
    };
  }
}
