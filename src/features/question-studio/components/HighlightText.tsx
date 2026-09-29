import * as React from 'react';
import { useQuestionStudio } from '../store/useQuestionStudio';

interface HighlightTextProps {
  text?: string;
  query?: string;
  className?: string;
}

export const HighlightText = React.memo(function HighlightText({
  text = '',
  query,
  className,
}: HighlightTextProps) {
  const storeQuery = useQuestionStudio((s) => s.searchQuery);
  const activeQuery = query !== undefined ? query : storeQuery;

  if (!text) return null;
  const trimmed = activeQuery.trim();
  if (!trimmed) {
    return className ? <span className={className}>{text}</span> : <>{text}</>;
  }

  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return className ? <span className={className}>{text}</span> : <>{text}</>;
  }

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        tokens.includes(part.toLowerCase()) ? (
          <mark key={i} className="qs-highlight">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
});
