import * as React from 'react';
import { useQuestionStudio } from '../store/useQuestionStudio';
import { QuestionCard } from './QuestionCard';
import type { Question } from '../types';

type StreamItem =
  | { type: 'sep'; title: string; count: number }
  | { type: 'card'; question: Question };

const BATCH_SIZE = 35;

/**
 * CardRow — memoized per-card wrapper with fine-grained Zustand subscriptions.
 * Only re-renders when THIS card's own state changes. Decouples card interaction
 * from StreamView's layout state, eliminating the React.memo defeat from inline callbacks.
 */
const CardRow = React.memo(function CardRow({ question }: { question: Question }) {
  const srNo = question.sr_no;

  // Fine-grained selectors — each only re-renders this card when ITS state changes
  const isSelected    = useQuestionStudio(s => s.selectedQuestions.has(srNo));
  const isFocused     = useQuestionStudio(s => s.lastFocusedSrNo === srNo);
  const isRevealed    = useQuestionStudio(s => s.showAnswers || s.revealedAnswers.has(srNo));
  const showAnswers   = useQuestionStudio(s => s.showAnswers);
  const isEditMode    = useQuestionStudio(s => s.isEditMode);
  const quizAttempt   = useQuestionStudio(s => s.quizAttempts[srNo]);

  // Stable action references — Zustand never recreates these, so these selectors
  // return the same function reference every render and never cause re-renders.
  const toggleSelectQuestion = useQuestionStudio(s => s.toggleSelectQuestion);
  const recordQuizAttempt    = useQuestionStudio(s => s.recordQuizAttempt);
  const clearQuizAttempt     = useQuestionStudio(s => s.clearQuizAttempt);
  const revealAnswer         = useQuestionStudio(s => s.revealAnswer);
  const hideAnswer           = useQuestionStudio(s => s.hideAnswer);
  const updateQuestionText   = useQuestionStudio(s => s.updateQuestionText);
  const updateOptionText     = useQuestionStudio(s => s.updateOptionText);
  const updateCorrectOption  = useQuestionStudio(s => s.updateCorrectOption);
  const updateDirectAnswer   = useQuestionStudio(s => s.updateDirectAnswer);

  return (
    <QuestionCard
      question={question}
      isSelected={isSelected}
      isFocused={isFocused}
      isRevealed={isRevealed}
      showAnswers={showAnswers}
      isEditMode={isEditMode}
      quizAttempt={quizAttempt}
      onSelect={(e) => {
        if (isEditMode && (e.target as HTMLElement).isContentEditable) return;
        toggleSelectQuestion(srNo, e.ctrlKey || e.metaKey, e.shiftKey);
      }}
      onQuizClick={(opt) => recordQuizAttempt(srNo, opt)}
      onClearQuiz={() => clearQuizAttempt(srNo)}
      onReveal={() => revealAnswer(srNo)}
      onHide={() => hideAnswer(srNo)}
      onUpdateQuestion={(text) => updateQuestionText(srNo, text)}
      onUpdateOption={(letter, text) => updateOptionText(srNo, letter, text)}
      onUpdateCorrectOption={(letter) => updateCorrectOption(srNo, letter)}
      onUpdateDirectAnswer={(text) => updateDirectAnswer(srNo, text)}
    />
  );
});

export function StreamView() {
  // StreamView only subscribes to queue-relevant state.
  // Per-card interaction state (selected, revealed, quiz, etc.) lives in CardRow.
  const activeUnitId        = useQuestionStudio(s => s.activeUnitId);
  const currentFilter       = useQuestionStudio(s => s.currentFilter);
  const searchQuery         = useQuestionStudio(s => s.searchQuery);
  const lastFocusedSrNo     = useQuestionStudio(s => s.lastFocusedSrNo);
  const projects            = useQuestionStudio(s => s.projects);
  const activeProjectId     = useQuestionStudio(s => s.activeProjectId);
  const restoreSeedProjects = useQuestionStudio(s => s.restoreSeedProjects);

  const activeProject = React.useMemo(
    () => projects.find(p => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  // Compute stream queue (chapter separators + visible questions)
  const queue = React.useMemo((): StreamItem[] => {
    if (!activeProject?.data?.chapters) return [];

    let chapters = activeProject.data.chapters;
    if (activeUnitId !== 'all') {
      chapters = chapters.filter(ch => String(ch.unit_id) === String(activeUnitId));
    }

    const query = searchQuery.trim().toLowerCase();
    const items: StreamItem[] = [];

    chapters.forEach(ch => {
      const visible = (ch.questions || []).filter(q => {
        if (currentFilter === 'mcq'          && q.type !== 'mcq')          return false;
        if (currentFilter === 'short_answer' && q.type !== 'short_answer') return false;
        if (currentFilter === 'descriptive'  && q.type !== 'descriptive')  return false;
        if (query) {
          const inQ = (q.question || '').toLowerCase().includes(query);
          const inO = Object.values(q.options || {}).some(o => (o || '').toLowerCase().includes(query));
          const inA = (q.correct_answer_text || '').toLowerCase().includes(query);
          const inN = String(q.sr_no).includes(query);
          if (!inQ && !inO && !inA && !inN) return false;
        }
        return true;
      });

      if (!visible.length) return;
      items.push({ type: 'sep', title: ch.unit_title, count: visible.length });
      visible.forEach(q => items.push({ type: 'card', question: q }));
    });

    return items;
  }, [activeProject, activeUnitId, currentFilter, searchQuery]);

  // Progressive batch rendering
  const [renderedCount, setRenderedCount] = React.useState(BATCH_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setRenderedCount(BATCH_SIZE);
  }, [activeProject?.id, activeUnitId, currentFilter, searchQuery]);

  React.useEffect(() => {
    if (renderedCount >= queue.length) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setRenderedCount(prev => Math.min(prev + BATCH_SIZE, queue.length));
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [renderedCount, queue.length]);

  // Ensure focused question is within the rendered batch
  React.useEffect(() => {
    if (lastFocusedSrNo !== null) {
      const idx = queue.findIndex(
        item => item.type === 'card' && item.question.sr_no === lastFocusedSrNo,
      );
      if (idx !== -1 && idx >= renderedCount) {
        setRenderedCount(Math.min(idx + BATCH_SIZE, queue.length));
      }
    }
  }, [lastFocusedSrNo, queue, renderedCount]);

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground text-sm gap-2">
        <p>No question bank loaded. Drop a PDF or JSON file to begin.</p>
        <button
          type="button"
          onClick={() => restoreSeedProjects()}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          Or reload sample question banks
        </button>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground text-sm">
        No matching questions found for this filter.
      </div>
    );
  }

  const visibleSlice = queue.slice(0, renderedCount);

  return (
    <div id="view-stream" className="flex flex-col gap-1 pb-20">
      {visibleSlice.map((item, idx) => {
        if (item.type === 'sep') {
          return (
            <div key={`sep-${item.title}-${idx}`} className="chapter-separator">
              <div className="chapter-title">{item.title}</div>
              <div className="chapter-count">{item.count} questions</div>
            </div>
          );
        }
        return <CardRow key={item.question.sr_no} question={item.question} />;
      })}

      {renderedCount < queue.length && (
        <div ref={sentinelRef} className="h-10 w-full" />
      )}
    </div>
  );
}


