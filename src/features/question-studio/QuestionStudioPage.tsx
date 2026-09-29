import * as React from 'react';
import { Search } from 'lucide-react';
import { DashboardLayout } from '@/dashboard-shell/components/layout/DashboardLayout';
import { Button } from '@/dashboard-shell/components/ui/button';
import { useQuestionStudio } from './store/useQuestionStudio';
import { Subtoolbar } from './components/Subtoolbar';
import { StreamView } from './components/StreamView';
import { CodeView } from './components/CodeView';
import { FloatingActionBar, PROMPT_TEMPLATES } from './components/FloatingActionBar';
import { SearchCommandDialog } from './components/SearchCommandDialog';
import { ProjectModals } from './components/ProjectModals';
import { SidebarContentSection } from './components/SidebarContentSection';
import { useMarqueeSelection } from './hooks/useMarqueeSelection';
import { FormatEngine } from './services/format-engine';
import { copyQuestionsForAI } from './services/clipboard';
import { PolarLogo } from '@/components/PolarLogo';

export function QuestionStudioPage() {
  const {
    init,
    getActiveProject,
    activeUnitId,
    currentFormatTab,
    selectedQuestions,
    selectAllQuestions,
    clearSelection,
    selectNextQuestion,
    searchQuery,
    setSearchQuery,
    cycleFilteredQuestion,
    toastMessage,
    showToast,
    isEditMode,
    toggleEditMode,
  } = useQuestionStudio();

  const [searchModalOpen, setSearchModalOpen] = React.useState(false);
  const [renameModalOpen, setRenameModalOpen] = React.useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);

  const mainRef = React.useRef<HTMLDivElement | null>(null);

  // Initialize store on mount
  React.useEffect(() => {
    init();
  }, [init]);

  // Hook up marquee rubberband selection
  useMarqueeSelection(mainRef);

  // Global Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const code = e.code;

      // ── Priority 1: Escape (Universal) ──────────────────────────
      // Exits edit mode, closes open modals, or clears card selections
      if (e.key === 'Escape') {
        if (searchModalOpen) {
          e.preventDefault();
          setSearchModalOpen(false);
          return;
        }
        if (renameModalOpen) {
          e.preventDefault();
          setRenameModalOpen(false);
          return;
        }
        if (deleteModalOpen) {
          e.preventDefault();
          setDeleteModalOpen(false);
          return;
        }
        if (isEditMode) {
          e.preventDefault();
          (document.activeElement as HTMLElement)?.blur();
          toggleEditMode(false);
          showToast('Edit mode exited');
          return;
        }
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
          clearSelection();
          (document.activeElement as HTMLElement)?.blur();
          return;
        }
        if (selectedQuestions.size > 0) {
          e.preventDefault();
          clearSelection();
          return;
        }
        return;
      }

      // If a modal is open, don't intercept typing inside its inputs
      if (searchModalOpen || renameModalOpen || deleteModalOpen) return;

      // ── Priority 2: Ctrl+K / Cmd+K — Search Modal (Universal) ───
      if (isCmdOrCtrl && (key === 'k' || code === 'KeyK')) {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        setSearchModalOpen(true);
        return;
      }

      // ── Priority 3: Ctrl+B / Cmd+B — Toggle Sidebar (Universal) ──
      if (isCmdOrCtrl && (key === 'b' || code === 'KeyB')) {
        e.preventDefault();
        const trigger = document.querySelector<HTMLButtonElement>('[data-sidebar="trigger"]');
        trigger?.click();
        return;
      }

      // ── Priority 4: Ctrl+E / Cmd+E — Toggle Edit Mode (Universal)
      if (isCmdOrCtrl && (key === 'e' || code === 'KeyE')) {
        e.preventDefault();
        const next = !isEditMode;
        toggleEditMode(next);
        showToast(next ? 'Edit mode enabled (Esc to exit)' : 'Edit mode disabled');
        return;
      }

      // ── Priority 5: Protect typing inside inputs / contentEditable
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))) {
        return;
      }

      // ── Priority 6: Canvas Card Selection & Action Shortcuts ────
      // Shift+ArrowDown / Shift+ArrowUp — Select next/prev question
      if (e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        selectNextQuestion('down');
        return;
      }
      if (e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        selectNextQuestion('up');
        return;
      }

      // Enter / Shift+Enter with active search query — cycle through matching questions
      if (searchQuery && e.key === 'Enter') {
        e.preventDefault();
        cycleFilteredQuestion(e.shiftKey ? 'prev' : 'next');
        return;
      }

      // Ctrl+A / Cmd+A — Select all questions
      if (isCmdOrCtrl && (key === 'a' || code === 'KeyA')) {
        e.preventDefault();
        selectAllQuestions();
        return;
      }

      // Ctrl+C / Cmd+C with active selection — Copy for AI prompt
      if (isCmdOrCtrl && (key === 'c' || code === 'KeyC') && selectedQuestions.size > 0) {
        e.preventDefault();
        const activeProj = getActiveProject();
        if (!activeProj) return;
        const flat = FormatEngine.toFlat(activeProj.data);
        const sel = flat.filter((q) => selectedQuestions.has(q.sr_no));
        if (!sel.length) return;
        const prompt = PROMPT_TEMPLATES[0]!.generatePrompt(sel, activeProj.title);
        copyQuestionsForAI(sel, prompt, PROMPT_TEMPLATES[0]!.label).then((res) => {
          if (res.hasCompositeCard) {
            showToast(`Copied Visual Card + Diagram for Claude & ChatGPT! Ready for 1-shot paste.`);
          } else {
            showToast(`Copied ${sel.length} question(s) for AI prompt`);
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    searchModalOpen,
    renameModalOpen,
    deleteModalOpen,
    isEditMode,
    selectedQuestions,
    clearSelection,
    selectAllQuestions,
    selectNextQuestion,
    toggleEditMode,
    getActiveProject,
    showToast,
    searchQuery,
    setSearchQuery,
    cycleFilteredQuestion,
  ]);

  const activeProject = getActiveProject();

  // Header Title / Breadcrumbs
  const headerTitle = React.useMemo(() => {
    if (!activeProject) return 'polarpdf';
    const projTitle = activeProject.title;
    if (activeUnitId === 'all') return projTitle;
    const currentChapter = activeProject.data?.chapters?.find(
      (c) => String(c.unit_id) === String(activeUnitId),
    );
    return currentChapter ? `${projTitle} / ${currentChapter.unit_title}` : projTitle;
  }, [activeProject, activeUnitId]);

  return (
    <DashboardLayout
      contentLayout="fluid"
      sidebarProps={{
        brand: {
          name: 'polarpdf',
          subtitle: 'Offline Question Bank',
          logo: <PolarLogo />,
        },
        customContent: (
          <SidebarContentSection
            onOpenRename={() => setRenameModalOpen(true)}
            onOpenDelete={() => setDeleteModalOpen(true)}
          />
        ),
      }}
      headerProps={{
        title: headerTitle,
        actions: (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchModalOpen(true)}
              className="h-8 px-2.5 text-xs text-muted-foreground gap-2 font-normal hover:text-foreground border-border/80 bg-background/50 cursor-pointer"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search questions…</span>
              <kbd className="pointer-events-none hidden sm:inline-flex h-4 select-none items-center rounded border border-border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
          </div>
        ),
      }}
      contentClassName="p-3 sm:p-5 flex flex-col flex-1 h-full min-h-0"
      footerOverlay={<FloatingActionBar />}
    >
      <div ref={mainRef} className="flex flex-col flex-1 h-full min-h-0 relative">
        {/* Subtoolbar for format tabs, filter chips, answer toggles */}
        <Subtoolbar />

        {/* Viewport Content */}
        <div className="flex-1 mt-3 min-h-0">
          {currentFormatTab === 'stream' ? (
            <StreamView />
          ) : (
            <CodeView tab={currentFormatTab} />
          )}
        </div>

        {/* Ctrl+K Search Modal */}
        <SearchCommandDialog
          open={searchModalOpen}
          onOpenChange={setSearchModalOpen}
        />

        {/* Rename & Delete Dialogs */}
        <ProjectModals
          renameOpen={renameModalOpen}
          onRenameOpenChange={setRenameModalOpen}
          deleteOpen={deleteModalOpen}
          onDeleteOpenChange={setDeleteModalOpen}
        />

        {/* Quick Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2 rounded-lg bg-card text-foreground border border-border shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-150">
            {toastMessage}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
