import * as React from 'react';
import { Search, X, Layers, Code2, AlignLeft, Table } from 'lucide-react';
import { Switch } from '@/dashboard-shell/components/ui/switch';
import { useQuestionStudio } from '../store/useQuestionStudio';
import type { FilterType, FormatTab } from '../types';

export function Subtoolbar() {
  const {
    currentFormatTab,
    setFormatTab,
    currentFilter,
    setFilter,
    searchQuery,
    setSearchQuery,
    cycleFilteredQuestion,
    getFilteredQuestions,
    lastFocusedSrNo,
    clearSelection,
    showAnswers,
    toggleShowAnswers,
    isEditMode,
    toggleEditMode,
    getActiveProject,
    activeUnitId,
  } = useQuestionStudio();

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local state for instant input feedback; debounce store update to avoid
  // triggering queue recomputation + 35-card reconciliation on every keystroke.
  const [localSearch, setLocalSearch] = React.useState(searchQuery);

  // Sync local state when searchQuery is cleared externally (Escape key, X button from parent)
  React.useEffect(() => {
    if (!searchQuery) setLocalSearch('');
  }, [searchQuery]);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(val), 150);
  };

  const handleSearchClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLocalSearch('');
    setSearchQuery('');
    clearSelection();
    inputRef.current?.focus();
  };

  const activeProject = getActiveProject();

  const filterCounts = React.useMemo(() => {
    if (!activeProject?.data?.chapters) {
      return { all: 0, mcq: 0, short_answer: 0, descriptive: 0 };
    }

    let chapters = activeProject.data.chapters;
    if (activeUnitId !== 'all') {
      chapters = chapters.filter((ch) => String(ch.unit_id) === String(activeUnitId));
    }

    let all = 0;
    let mcq = 0;
    let short_answer = 0;
    let descriptive = 0;

    chapters.forEach((ch) => {
      (ch.questions || []).forEach((q) => {
        all++;
        if (q.type === 'mcq') mcq++;
        else if (q.type === 'short_answer') short_answer++;
        else descriptive++;
      });
    });

    return { all, mcq, short_answer, descriptive };
  }, [activeProject, activeUnitId]);

  const formatTabs: { id: FormatTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'stream', label: 'Stream', icon: Layers },
    { id: 'structured', label: 'Structured JSON', icon: Code2 },
    { id: 'flat', label: 'Flat JSON', icon: Code2 },
    { id: 'markdown', label: 'Markdown', icon: AlignLeft },
    { id: 'csv', label: 'CSV', icon: Table },
  ];

  const filterChips: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: filterCounts.all },
    { id: 'mcq', label: 'MCQs', count: filterCounts.mcq },
    { id: 'short_answer', label: 'Short Answer', count: filterCounts.short_answer },
    { id: 'descriptive', label: 'Descriptive', count: filterCounts.descriptive },
  ];

  const trimmedSearch = searchQuery.trim();
  const filteredQuestions = trimmedSearch ? getFilteredQuestions() : [];
  const currentIndex =
    lastFocusedSrNo && filteredQuestions.length
      ? filteredQuestions.findIndex((q) => q.sr_no === lastFocusedSrNo)
      : -1;
  const matchInfo = trimmedSearch
    ? filteredQuestions.length === 0
      ? '0 matches'
      : currentIndex >= 0
      ? `${currentIndex + 1}/${filteredQuestions.length}`
      : `${filteredQuestions.length}`
    : null;

  return (
    <div className="flex flex-col gap-2.5 pb-3 border-b border-border/70 select-none">
      {/* Top row: Format Tabs & Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Format Tabs */}
        <div className="inline-flex items-center rounded-lg bg-muted/70 p-0.5 border border-border/60">
          {formatTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentFormatTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFormatTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  isActive
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Controls: Show Answers & Edit Mode */}
        <div className="flex items-center gap-5 ml-auto">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">
            <span>Show Answers</span>
            <Switch
              checked={showAnswers}
              onCheckedChange={(checked) => toggleShowAnswers(checked)}
              aria-label="Toggle Show Answers"
            />
          </label>

          <div className="w-[1px] h-4 bg-border/80" />

          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">
            <span>Edit Mode</span>
            <Switch
              checked={isEditMode}
              onCheckedChange={(checked) => toggleEditMode(checked)}
              aria-label="Toggle Edit Mode"
            />
          </label>
        </div>
      </div>

      {/* Bottom row: Filter Chips & In-stream Search Filter (active in stream view) */}
      {currentFormatTab === 'stream' && (
        <div className="flex items-center justify-between gap-3 flex-wrap pt-0.5">
          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterChips.map((chip) => {
              const isActive = currentFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border/70 bg-card text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <span>{chip.label}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-semibold">
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick search input */}
          <div className="relative flex items-center min-w-[210px] max-w-xs flex-1">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  cycleFilteredQuestion(e.shiftKey ? 'prev' : 'next');
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleSearchClear();
                  inputRef.current?.blur();
                }
              }}
              placeholder="Filter current view…"
              className="w-full pl-8 pr-16 py-1 text-xs rounded-md bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {localSearch && (
              <div className="absolute right-1.5 flex items-center gap-1.5 pointer-events-auto">
                {matchInfo && (
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground/85 bg-muted px-1.5 py-0.2 rounded border border-border/50 select-none">
                    {matchInfo}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear search (Esc)"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


