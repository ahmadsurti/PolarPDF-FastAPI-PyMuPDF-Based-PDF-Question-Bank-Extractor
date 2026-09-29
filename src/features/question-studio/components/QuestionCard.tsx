import * as React from 'react';
import type { Question } from '../types';
import { OptionsGrid } from './OptionsGrid';
import { HighlightText } from './HighlightText';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QuestionCardProps {
  question: Question;
  isSelected: boolean;
  isFocused: boolean;
  isRevealed: boolean;
  showAnswers: boolean;
  isEditMode: boolean;
  quizAttempt?: string;
  onSelect: (e: React.MouseEvent) => void;
  onQuizClick: (opt: string) => void;
  onClearQuiz: () => void;
  onReveal: () => void;
  onHide: () => void;
  onUpdateQuestion: (text: string) => void;
  onUpdateOption: (letter: string, text: string) => void;
  onUpdateCorrectOption: (letter: string) => void;
  onUpdateDirectAnswer: (text: string) => void;
}

export const QuestionCard = React.memo(function QuestionCard({
  question,
  isSelected,
  isFocused,
  isRevealed,
  showAnswers,
  isEditMode,
  quizAttempt,
  onSelect,
  onQuizClick,
  onClearQuiz,
  onReveal,
  onHide,
  onUpdateQuestion,
  onUpdateOption,
  onUpdateCorrectOption,
  onUpdateDirectAnswer,
}: QuestionCardProps) {
  const isCorrectGuess = quizAttempt !== undefined && quizAttempt === question.correct_option;

  return (
    <div
      className={`q-card${isSelected ? ' selected' : ''}${isFocused ? ' active-focus' : ''}`}
      data-sr-no={question.sr_no}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="q-card-header">
        <div className="q-meta-badges">
          <span className="num-tag">Q{question.sr_no}</span>
          <span className="marks-tag">
            {question.marks} mark{question.marks > 1 ? 's' : ''}
          </span>
        </div>
        <span
          className="page-indicator"
          title={`Source: PDF Page ${question.page || 1}`}
        >
          Page {question.page || 1}
        </span>
      </div>

      {/* Question Body */}
      {!question.question && !isEditMode ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 italic py-1.5 px-2.5 rounded-lg bg-muted/30 border border-dashed border-border/60 select-none">
          <span>[No question text extracted — click Edit to add text]</span>
        </div>
      ) : (
        <div
          className={`q-body-text${isEditMode ? ' editable' : ''}`}
          contentEditable={isEditMode}
          suppressContentEditableWarning
          data-placeholder="Click here to type / add question text…"
          onClick={(e) => {
            if (isEditMode) e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (isEditMode && e.key === 'Escape') {
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            if (isEditMode) {
              onUpdateQuestion(e.currentTarget.innerText.trim());
            }
          }}
        >
          {isEditMode ? question.question : <HighlightText text={question.question} />}
        </div>
      )}

      {/* Diagrams Grid */}
      {question.images && question.images.length > 0 && (
        <div className="q-diagrams-grid">
          {question.images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`Diagram for Q${question.sr_no}`}
              className="q-diagram-img"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* MCQ Options */}
      {question.type === 'mcq' && (
        <OptionsGrid
          question={question}
          isRevealed={isRevealed}
          quizAttempt={quizAttempt}
          isEditMode={isEditMode}
          onQuizClick={onQuizClick}
          onUpdateOption={onUpdateOption}
        />
      )}

      {/* Answer Footer */}
      {question.type === 'mcq' && (
        <div className="answer-footer" onClick={(e) => e.stopPropagation()}>
          {isRevealed || isEditMode ? (
            <>
              <div className="ans-display">
                <span>Correct Option:</span>
                <span className="ans-badge">{question.correct_option || ''}</span>
                <span className="text-muted-foreground font-normal">
                  <HighlightText text={question.correct_answer_text || ''} />
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!showAnswers && !isEditMode && (
                  <button
                    type="button"
                    className="btn-reveal cursor-pointer"
                    onClick={onHide}
                  >
                    Hide
                  </button>
                )}
                {isEditMode && (
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Key:
                    </span>
                    <Select
                      value={question.correct_option || 'A'}
                      onValueChange={(val) => onUpdateCorrectOption(val)}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-[5.25rem] rounded-lg border-border/80 bg-muted/80 hover:bg-muted font-mono text-xs font-bold px-2 py-0 transition-all hover:border-primary/50 focus:ring-1 focus:ring-primary/30"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="min-w-[6.5rem] rounded-xl border-border/80 bg-popover/95 backdrop-blur-md shadow-xl z-[100] p-1.5">
                        {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                          <SelectItem
                            key={opt}
                            value={opt}
                            className="rounded-lg font-mono text-xs font-semibold py-1.5 px-3 cursor-pointer focus:bg-primary/15 focus:text-primary transition-colors"
                          >
                            Option {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          ) : quizAttempt !== undefined ? (
            <>
              <div
                className="ans-display font-semibold"
                style={{
                  color: isCorrectGuess ? 'var(--quiz-correct)' : 'var(--quiz-wrong)',
                }}
              >
                {isCorrectGuess ? (
                  'Correct!'
                ) : (
                  <>
                    Wrong — correct is
                    <span
                      className="ans-badge"
                      style={{
                        background:
                          'color-mix(in oklch, var(--quiz-correct) 15%, transparent)',
                        color: 'var(--quiz-correct)',
                        border: '1px solid var(--quiz-correct)',
                      }}
                    >
                      {question.correct_option}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                className="btn-reveal cursor-pointer"
                onClick={onClearQuiz}
              >
                Try Again
              </button>
            </>
          ) : (
            <>
              <span className="text-[11px] text-muted-foreground">
                Click an option to self-test
              </span>
              <button
                type="button"
                className="btn-reveal cursor-pointer"
                onClick={onReveal}
              >
                Reveal
              </button>
            </>
          )}
        </div>
      )}

      {question.type === 'short_answer' && (
        <div className="answer-footer" onClick={(e) => e.stopPropagation()}>
          {isRevealed ? (
            <>
              <div className="ans-display">
                <span>Key / Solution:</span>
                <span
                  className={`solution-text${isEditMode ? ' editable' : ''}`}
                  contentEditable={isEditMode}
                  suppressContentEditableWarning
                  onKeyDown={(e) => {
                    if (isEditMode && e.key === 'Escape') {
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => {
                    if (isEditMode) {
                      onUpdateDirectAnswer(e.currentTarget.innerText);
                    }
                  }}
                >
                  {isEditMode ? (
                    question.correct_answer_text || ''
                  ) : (
                    <HighlightText text={question.correct_answer_text || ''} />
                  )}
                </span>
              </div>
              {!showAnswers && (
                <button
                  type="button"
                  className="btn-reveal cursor-pointer"
                  onClick={onHide}
                >
                  Hide
                </button>
              )}
            </>
          ) : (
            <>
              <span className="text-[11px] text-muted-foreground">Answer hidden</span>
              <button
                type="button"
                className="btn-reveal cursor-pointer"
                onClick={onReveal}
              >
                Reveal Solution
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});
