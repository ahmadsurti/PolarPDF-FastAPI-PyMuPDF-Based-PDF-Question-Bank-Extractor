import * as React from 'react';
import { Bot, FileDown, FileText, X, ChevronDown, Check, Sparkles, Pencil } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/dashboard-shell/components/ui/dropdown-menu';
import { useSidebar } from '@/dashboard-shell/components/ui/sidebar';
import { useQuestionStudio } from '../store/useQuestionStudio';
import { FormatEngine } from '../services/format-engine';
import { copyQuestionsForAI, copyPromptTextOnly, copyDiagramOnly } from '../services/clipboard';
import type { Question } from '../types';

export interface PromptTemplate {
  id: string;
  label: string;
  description: string;
  generatePrompt: (questions: Question[], projectTitle: string) => string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tutor-step-by-step',
    label: 'Step-by-Step Solution',
    description: 'Detailed explanation followed by clear solution steps',
    generatePrompt: (questions, projectTitle) => {
      let prompt = `You are an expert tutor and academic mentor. Provide detailed step-by-step solutions for the following ${questions.length} question(s) from "${projectTitle}":\n\n`;
      questions.forEach((q) => {
        prompt += `${'─'.repeat(50)}\n[Q${q.sr_no}] (${q.marks}M) • ${q.unit_name || ''}\n${q.question}\n`;
        if (q.images?.length) prompt += `[Visual Diagram / Figure attached with prompt]\n`;
        if (q.type === 'mcq') {
          prompt += 'Options:\n';
          (['A', 'B', 'C', 'D'] as const).forEach(
            (l) => (prompt += `  (${l}) ${q.options?.[l] || ''}\n`),
          );
          if (q.correct_option)
            prompt += `Given Official Key: ${q.correct_option} (${q.correct_answer_text || ''})\n`;
        } else if (q.type === 'short_answer' && q.correct_answer_text) {
          prompt += `Given Official Key: ${q.correct_answer_text}\n`;
        }
        prompt += '\n';
      });
      prompt +=
        'For each question:\n1. State the fundamental concept/formula.\n2. Walk through the reasoning step-by-step.\n3. State the final answer clearly.';
      return prompt;
    },
  },
  {
    id: 'quick-key',
    label: 'Direct Answer Key & Logic',
    description: 'Direct answer with concise 1-sentence verification',
    generatePrompt: (questions, projectTitle) => {
      let prompt = `You are an examination evaluator. Provide the direct correct answer key and a 1-sentence justification for each of the following ${questions.length} question(s) from "${projectTitle}":\n\n`;
      questions.forEach((q) => {
        prompt += `[Q${q.sr_no}] ${q.question}\n`;
        if (q.type === 'mcq') {
          (['A', 'B', 'C', 'D'] as const).forEach(
            (l) => (prompt += `  (${l}) ${q.options?.[l] || ''}\n`),
          );
        }
        prompt += '\n';
      });
      prompt += 'Format output as:\nQ[No]: [Option/Answer] — [1-sentence rationale]';
      return prompt;
    },
  },
  {
    id: 'concept-breakdown',
    label: 'Concept Analysis & Distractors',
    description: 'Examines why wrong options are wrong and why right is right',
    generatePrompt: (questions, projectTitle) => {
      let prompt = `You are a university professor. Analyze the pedagogical concept tested in the following ${questions.length} question(s) from "${projectTitle}":\n\n`;
      questions.forEach((q) => {
        prompt += `[Q${q.sr_no}] ${q.question}\n`;
        if (q.type === 'mcq') {
          (['A', 'B', 'C', 'D'] as const).forEach(
            (l) => (prompt += `  (${l}) ${q.options?.[l] || ''}\n`),
          );
        }
        prompt += '\n';
      });
      prompt +=
        'For each question:\n- Core Syllabus Topic\n- Why the correct answer is valid\n- Why each distractor/alternative is incorrect\n- Common misconceptions students have';
      return prompt;
    },
  },
  {
    id: 'code-implementation',
    label: 'Code & Algorithm Implementation',
    description: 'Generates clean, idiomatic executable code solutions',
    generatePrompt: (questions, projectTitle) => {
      let prompt = `You are a senior software engineer. Provide idiomatic, clean code implementations with brief inline comments for the following question(s) from "${projectTitle}":\n\n`;
      questions.forEach((q) => {
        prompt += `[Q${q.sr_no}] ${q.question}\n`;
        if (q.images?.length) prompt += `[Visual Diagram / Figure attached with prompt]\n`;
        prompt += '\n';
      });
      prompt +=
        'Provide clean runnable code blocks with comments explaining key lines and edge case handling.';
      return prompt;
    },
  },
];

export function FloatingActionBar() {
  const {
    selectedQuestions,
    getActiveProject,
    clearSelection,
    showToast,
    isEditMode,
    toggleEditMode,
  } = useQuestionStudio();

  const { state, isMobile } = useSidebar();
  const [activeTemplateId, setActiveTemplateId] = React.useState('tutor-step-by-step');

  const dynamicStyle = React.useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return {
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - 2rem)',
      };
    }
    if (state === 'expanded') {
      return {
        left: 'calc(50% + var(--sidebar-width, 16rem) / 2)',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - var(--sidebar-width, 16rem) - 2rem)',
      };
    }
    return {
      left: 'calc(50% + var(--sidebar-width-icon, 3rem) / 2)',
      transform: 'translateX(-50%)',
      maxWidth: 'calc(100vw - var(--sidebar-width-icon, 3rem) - 2rem)',
    };
  }, [state, isMobile]);

  const hasSelectedImages = React.useMemo(() => {
    const project = getActiveProject();
    if (!project) return false;
    const flat = FormatEngine.toFlat(project.data);
    return flat.some((q) => selectedQuestions.has(q.sr_no) && q.images && q.images.length > 0);
  }, [getActiveProject, selectedQuestions]);

  const count = selectedQuestions.size;
  if (count === 0) return null;

  const activeTemplate =
    PROMPT_TEMPLATES.find((t) => t.id === activeTemplateId) || PROMPT_TEMPLATES[0]!;

  const handleCopyForAI = async (template?: PromptTemplate) => {
    const project = getActiveProject();
    if (!project) return;
    const flat = FormatEngine.toFlat(project.data);
    const sel = flat.filter((q) => selectedQuestions.has(q.sr_no));
    if (!sel.length) return;

    const tpl = template || activeTemplate;
    const prompt = tpl.generatePrompt(sel, project.title);

    const result = await copyQuestionsForAI(sel, prompt, tpl.label);
    if (result.hasCompositeCard) {
      showToast(
        `Copied Visual Card + Diagram for Claude & ChatGPT! Ready for 1-shot paste.`,
      );
    } else {
      showToast(`Copied ${sel.length} question(s) with prompt: "${tpl.label}"`);
    }
  };

  const handleCopyMarkdown = () => {
    const project = getActiveProject();
    if (!project) return;
    const flat = FormatEngine.toFlat(project.data);
    const sel = flat.filter((q) => selectedQuestions.has(q.sr_no));

    let md = '';
    sel.forEach((q) => {
      md += `### Q${q.sr_no}. ${q.question}\n\n- **Marks**: ${q.marks} | **Type**: ${q.type.toUpperCase()}\n`;
      if (q.type === 'mcq') {
        (['A', 'B', 'C', 'D'] as const).forEach((l) => {
          md += `- (${l}) ${q.options?.[l] || ''}${q.correct_option === l ? ' *(Correct)*' : ''}\n`;
        });
        md += `\n> **Answer**: ${q.correct_option || ''} (${q.correct_answer_text || ''})\n\n`;
      } else if (q.correct_answer_text) {
        md += `\n> **Key**: \`${q.correct_answer_text}\`\n\n`;
      }
      md += `---\n\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      showToast(`Copied ${sel.length} question(s) as Markdown`);
    });
  };

  const handleExportJSON = () => {
    const project = getActiveProject();
    if (!project) return;
    const flat = FormatEngine.toFlat(project.data);
    const sel = flat.filter((q) => selectedQuestions.has(q.sr_no));

    const blob = new Blob([JSON.stringify(sel, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `${project.id}_selected_${sel.length}.json`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${sel.length} questions as JSON`);
  };

  return (
    <aside
      id="floating-selection-bar"
      aria-label="Batch actions toolbar"
      style={dynamicStyle}
      className="fixed bottom-6 z-50 flex items-center gap-1.5 p-1.5 px-3 w-max rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.35)] text-xs animate-in fade-in slide-in-from-bottom-4 duration-200 select-none overflow-x-auto pointer-events-auto transition-[left,max-width] duration-200 ease-linear"
    >
      {/* Counter */}
      <div className="flex items-center gap-1.5 font-bold text-primary px-1.5 font-mono">
        <Check className="size-3.5 stroke-[2.5]" />
        <span>{count} selected</span>
      </div>

      <div className="w-[1px] h-4 bg-border/80 mx-1" />

      {/* Edit Mode Toggle Button */}
      <button
        type="button"
        onClick={() => {
          const next = !isEditMode;
          toggleEditMode(next);
          if (next) {
            showToast('Edit mode enabled — edit question text or answers directly');
            const project = getActiveProject();
            if (project) {
              const flat = FormatEngine.toFlat(project.data);
              const sel = flat.filter((q) => selectedQuestions.has(q.sr_no));
              const first = sel[0];
              if (first) {
                const sr = first.sr_no;
                setTimeout(() => {
                  const card = document.querySelector(`[data-sr-no="${sr}"]`);
                  card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  const el = card?.querySelector('.q-body-text') as HTMLElement | null;
                  el?.focus();
                }, 100);
              }
            }
          } else {
            showToast('Edit mode disabled');
          }
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
          isEditMode
            ? 'bg-primary/20 text-primary border border-primary/40 font-semibold shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
        }`}
        title={isEditMode ? 'Exit Edit Mode' : 'Edit selected question text & answers'}
      >
        <Pencil className="size-3.5" />
        <span>{isEditMode ? 'Editing' : 'Edit'}</span>
      </button>

      <div className="w-[1px] h-4 bg-border/80 mx-1" />

      {/* Main Copy For AI Button Group with Split Prompt Selector */}
      <div className="flex items-center rounded-lg border border-primary/30 bg-primary/10 overflow-hidden">
        <button
          type="button"
          onClick={() => handleCopyForAI()}
          className="flex items-center gap-1.5 px-3 py-1 font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
          title={`Copy selected questions with: ${activeTemplate.label}`}
        >
          <Bot className="size-3.5" />
          <span>Copy for AI</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center px-1.5 py-1 border-l border-primary/25 text-primary hover:bg-primary/25 transition-colors cursor-pointer"
              title="Select AI prompt preset"
              aria-label="Select AI prompt preset"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-72 p-1.5 rounded-xl border border-border bg-card shadow-2xl z-[10000]"
          >
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              <span>Prompt Presets</span>
            </div>
            {PROMPT_TEMPLATES.map((tpl) => {
              const isSelected = tpl.id === activeTemplate.id;
              return (
                <DropdownMenuItem
                  key={tpl.id}
                  onClick={() => {
                    setActiveTemplateId(tpl.id);
                    handleCopyForAI(tpl);
                  }}
                  className={`flex flex-col items-start gap-0.5 p-2 rounded-lg cursor-pointer ${
                    isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold">{tpl.label}</span>
                    {isSelected && <Check className="size-3 text-primary" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground line-clamp-1">
                    {tpl.description}
                  </span>
                </DropdownMenuItem>
              );
            })}

            <div className="my-1 border-t border-border/60" />
            <DropdownMenuItem
              onClick={async () => {
                const project = getActiveProject();
                if (!project) return;
                const flat = FormatEngine.toFlat(project.data);
                const sel = flat.filter((q) => selectedQuestions.has(q.sr_no));
                const prompt = activeTemplate.generatePrompt(sel, project.title);
                await copyPromptTextOnly(prompt);
                showToast(`Copied prompt text only (for ChatGPT)`);
              }}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted"
            >
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="text-xs">Copy Text Prompt Only</span>
            </DropdownMenuItem>

            {hasSelectedImages && (
              <DropdownMenuItem
                onClick={async () => {
                  const project = getActiveProject();
                  if (!project) return;
                  const flat = FormatEngine.toFlat(project.data);
                  const sel = flat.filter((q) => selectedQuestions.has(q.sr_no));
                  const res = await copyDiagramOnly(sel);
                  if (res.success) {
                    showToast(
                      res.count > 1
                        ? `Copied ${res.count} diagrams (stitched) to clipboard!`
                        : 'Copied diagram image to clipboard!',
                    );
                  }
                }}
                className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted"
              >
                <FileDown className="size-3.5 text-muted-foreground" />
                <span className="text-xs">Copy Diagram Image Only</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Copy Markdown */}
      <button
        type="button"
        onClick={handleCopyMarkdown}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
        title="Copy questions formatted in clean Markdown"
      >
        <FileText className="size-3.5" />
        <span>Copy MD</span>
      </button>

      {/* Export JSON */}
      <button
        type="button"
        onClick={handleExportJSON}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
        title="Export selected questions as a JSON file"
      >
        <FileDown className="size-3.5" />
        <span>Export JSON</span>
      </button>

      <div className="w-[1px] h-4 bg-border/80 mx-1" />

      {/* Clear Selection */}
      <button
        type="button"
        onClick={clearSelection}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
        title="Clear selection (Esc)"
        aria-label="Clear selection"
      >
        <X className="size-3.5" />
      </button>
    </aside>
  );
}
