import * as React from 'react';
import type { Question } from '../types';
import { HighlightText } from './HighlightText';

interface OptionsGridProps {
  question: Question;
  isRevealed: boolean;
  quizAttempt?: string;
  isEditMode: boolean;
  onQuizClick: (opt: string) => void;
  onUpdateOption: (letter: string, text: string) => void;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

export const OptionsGrid = React.memo(function OptionsGrid({
  question,
  isRevealed,
  quizAttempt,
  isEditMode,
  onQuizClick,
  onUpdateOption,
}: OptionsGridProps) {
  if (question.type !== 'mcq') return null;

  return (
    <div className="options-container" onClick={(e) => e.stopPropagation()}>
      {OPTION_KEYS.map((l) => {
        const text = question.options?.[l] || '';
        let cls = 'opt-box';

        if (isRevealed) {
          if (question.correct_option === l) cls += ' is-correct';
        } else if (quizAttempt !== undefined) {
          if (quizAttempt === l) {
            cls += l === question.correct_option ? ' quiz-correct' : ' quiz-wrong';
          } else if (l === question.correct_option && quizAttempt !== question.correct_option) {
            cls += ' quiz-reveal-correct';
          }
          cls += ' quiz-clickable';
        } else {
          cls += ' quiz-clickable';
        }

        return (
          <div
            key={l}
            className={cls}
            data-opt={l}
            onClick={() => {
              if (!isRevealed && !isEditMode) {
                onQuizClick(l);
              }
            }}
          >
            <span className="opt-indicator">{l}</span>
            <div
              className={`opt-text${isEditMode ? ' editable' : ''}`}
              contentEditable={isEditMode}
              suppressContentEditableWarning
              onBlur={(e) => {
                if (isEditMode) {
                  onUpdateOption(l, e.currentTarget.innerText);
                }
              }}
            >
              {isEditMode ? text : <HighlightText text={text} />}
            </div>
          </div>
        );
      })}
    </div>
  );
});
