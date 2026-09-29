import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, X } from 'lucide-react';
import { useQuestionStudio } from '../store/useQuestionStudio';
import { searchEngine } from '../services/search-engine';
import { HighlightText } from './HighlightText';
import type { SearchIndexEntry } from '../types';

interface SearchCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchCommandDialog({ open, onOpenChange }: SearchCommandDialogProps) {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const {
    setActiveProject,
    setActiveUnit,
    setFormatTab,
    toggleSelectQuestion,
    clearSelection,
  } = useQuestionStudio();

  // Perform search
  const results = React.useMemo(() => {
    if (!query.trim()) return [];
    return searchEngine.search(query, 80);
  }, [query]);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation within results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev <= 0 ? results.length - 1 : prev - 1) : -1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = selectedIndex >= 0 ? results[selectedIndex] : results[0];
      if (target) handleSelectResult(target);
    }
  };

  const handleSelectResult = (entry: SearchIndexEntry) => {
    setActiveProject(entry.projectId);
    setActiveUnit('all');
    clearSelection();
    toggleSelectQuestion(entry.q.sr_no, false, false);
    setFormatTab('stream');
    onOpenChange(false);

    // Scroll into view
    setTimeout(() => {
      const card = document.querySelector(`[data-sr-no="${entry.q.sr_no}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  // Scroll selected item into view when navigating via keyboard
  React.useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={handleKeyDown}
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Search Header */}
          <div className="flex items-center px-3.5 py-3 border-b border-border gap-2.5">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(-1);
              }}
              placeholder="Search all projects, questions, options, answer keys… (⌘K)"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono text-muted-foreground">
              Esc
            </kbd>
          </div>

          {/* Search Results List */}
          <div
            ref={listRef}
            className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1"
          >
            {!query.trim() ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Type tokens to search across all questions and chapters…
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No results found matching &quot;{query}&quot;
              </div>
            ) : (
              results.map((entry, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${entry.projectId}-${entry.q.sr_no}-${idx}`}
                    onClick={() => handleSelectResult(entry)}
                    className={`flex flex-col gap-1.5 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 text-foreground'
                        : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className={`font-semibold ${isSelected ? 'text-primary' : 'text-primary/80'}`}>
                        {entry.projectTitle}
                      </span>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="text-muted-foreground">{entry.chapterTitle}</span>
                      <span
                        className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          isSelected
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        Q{entry.q.sr_no}
                      </span>
                    </div>
                    <div className="text-xs text-foreground line-clamp-2 leading-relaxed">
                      <HighlightText text={entry.q.question} query={query} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
