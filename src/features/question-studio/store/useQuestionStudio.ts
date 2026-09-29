import { create } from 'zustand';
import type { FilterType, FormatTab, Project, ProjectData, Question } from '../types';
import { storageRepo } from '../services/storage';
import { SEED_PROJECTS } from '../data/seed-projects';
import { FormatEngine } from '../services/format-engine';
import { searchEngine } from '../services/search-engine';

// ponytail: dumb seed helper — only run on 1st visit or explicit user restore
async function seedDefaultProjects() {
  for (const p of Object.values(SEED_PROJECTS) as unknown as Project[]) {
    await storageRepo.saveProject(p);
  }
}

// ponytail: shared helper — find, mutate (immutable), save, rebuild, toast
async function patchQuestion(
  projects: Project[],
  getProject: () => Project | undefined,
  setProjects: (p: Project[]) => void,
  toast: (m: string) => void,
  srNo: number,
  mutate: (q: Question) => Partial<Question>,
  toastMsg: string,
  rebuildSearch = true,
) {
  const project = getProject();
  if (!project) return;

  let found = false;
  const updatedChapters = project.data.chapters.map(ch => {
    if (!ch.questions.some(q => q.sr_no === srNo)) return ch;
    found = true;
    return {
      ...ch,
      questions: ch.questions.map(q =>
        q.sr_no === srNo ? { ...q, ...mutate(q) } : q,
      ),
    };
  });

  if (!found) return;

  project.data.chapters = updatedChapters;
  FormatEngine.updateMetrics(project.data);
  await storageRepo.saveProject(project);
  if (rebuildSearch) searchEngine.rebuild(projects);
  setProjects([...projects]);
  toast(toastMsg);
}

interface QuestionStudioState {
  projects: Project[];
  activeProjectId: string | null;
  activeUnitId: string;
  currentFilter: FilterType;
  currentFormatTab: FormatTab;
  searchQuery: string;
  showAnswers: boolean;
  isEditMode: boolean;
  selectedQuestions: Set<number>;
  lastFocusedSrNo: number | null;
  selectionAnchorSrNo: number | null;
  revealedAnswers: Set<number>;
  quizAttempts: Record<number, string>;
  isLoading: boolean;
  toastMessage: string | null;

  // Computed helper getters
  getActiveProject: () => Project | undefined;
  getFlatQuestions: () => Question[];
  getFilteredQuestions: () => Question[];

  // Core Actions
  init: () => Promise<void>;
  setActiveProject: (id: string) => void;
  setActiveUnit: (unitId: string) => void;
  setFilter: (filter: FilterType) => void;
  setFormatTab: (tab: FormatTab) => void;
  setSearchQuery: (query: string) => void;
  toggleShowAnswers: (forced?: boolean) => void;
  toggleEditMode: (forced?: boolean) => void;

  // Selection Actions
  toggleSelectQuestion: (srNo: number, isMulti?: boolean, isRange?: boolean) => void;
  addQuestionsToSelection: (srNos: number[]) => void;
  selectAllQuestions: () => void;
  clearSelection: () => void;
  selectNextQuestion: (direction: 'up' | 'down') => void;
  cycleFilteredQuestion: (direction?: 'next' | 'prev') => void;
  setSelectionRange: (fromSr: number, toSr: number) => void;

  // Quiz Mode Actions
  recordQuizAttempt: (srNo: number, optionLetter: string) => void;
  clearQuizAttempt: (srNo: number) => void;
  revealAnswer: (srNo: number) => void;
  hideAnswer: (srNo: number) => void;

  // Inline Edits
  updateQuestionText: (srNo: number, text: string) => Promise<void>;
  updateOptionText: (srNo: number, letter: string, text: string) => Promise<void>;
  updateCorrectOption: (srNo: number, letter: string) => Promise<void>;
  updateDirectAnswer: (srNo: number, text: string) => Promise<void>;

  // Project Management
  renameProject: (id: string, newTitle: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addProject: (id: string, title: string, data: ProjectData) => Promise<void>;
  restoreSeedProjects: () => Promise<void>;

  // Feedback Toast
  showToast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useQuestionStudio = create<QuestionStudioState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeUnitId: 'all',
  currentFilter: 'all',
  currentFormatTab: 'stream',
  searchQuery: '',
  showAnswers: true,
  isEditMode: false,
  selectedQuestions: new Set<number>(),
  lastFocusedSrNo: null,
  selectionAnchorSrNo: null,
  revealedAnswers: new Set<number>(),
  quizAttempts: {},
  isLoading: true,
  toastMessage: null,

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId);
  },

  getFlatQuestions: () => {
    const activeProject = get().getActiveProject();
    if (!activeProject) return [];
    return FormatEngine.toFlat(activeProject.data);
  },

  getFilteredQuestions: () => {
    const activeProject = get().getActiveProject();
    if (!activeProject?.data?.chapters) return [];

    let chapters = activeProject.data.chapters;
    if (get().activeUnitId !== 'all') {
      chapters = chapters.filter((ch) => String(ch.unit_id) === String(get().activeUnitId));
    }

    const query = get().searchQuery.trim().toLowerCase();
    const filter = get().currentFilter;
    const result: Question[] = [];

    chapters.forEach((ch) => {
      (ch.questions || []).forEach((q) => {
        if (filter === 'mcq' && q.type !== 'mcq') return;
        if (filter === 'short_answer' && q.type !== 'short_answer') return;
        if (filter === 'descriptive' && q.type !== 'descriptive') return;

        if (query) {
          const inQ = (q.question || '').toLowerCase().includes(query);
          const inO = Object.values(q.options || {}).some((o) =>
            (o || '').toLowerCase().includes(query),
          );
          const inA = (q.correct_answer_text || '').toLowerCase().includes(query);
          const inN = String(q.sr_no).includes(query);
          if (!inQ && !inO && !inA && !inN) return;
        }

        result.push(q);
      });
    });

    return result;
  },

  init: async () => {
    try {
      const loaded = await storageRepo.getAllProjects();
      searchEngine.rebuild(loaded);

      // Restore persisted preferences
      const savedAnswers = localStorage.getItem('qs-show-answers');
      const showAnswers = savedAnswers !== null ? savedAnswers === 'true' : true;

      const savedEdit = localStorage.getItem('qs-edit-mode');
      const isEditMode = savedEdit !== null ? savedEdit === 'true' : false;

      const savedFilter = localStorage.getItem('qs-current-filter') as FilterType | null;
      const currentFilter: FilterType =
        savedFilter && ['all', 'mcq', 'short_answer', 'descriptive'].includes(savedFilter)
          ? savedFilter
          : 'all';

      const savedTab = localStorage.getItem('qs-format-tab') as FormatTab | null;
      const currentFormatTab: FormatTab =
        savedTab && ['stream', 'structured', 'flat', 'markdown', 'csv'].includes(savedTab)
          ? savedTab
          : 'stream';

      const savedProjId = localStorage.getItem('qs-active-project-id');
      const matched = loaded.find((p) => p.id === savedProjId);
      const activeProjectId = matched ? matched.id : loaded[0]?.id || null;

      const savedUnit = localStorage.getItem('qs-active-unit-id');
      let activeUnitId = 'all';
      if (savedUnit) {
        if (savedUnit === 'all') {
          activeUnitId = 'all';
        } else {
          const activeProj = loaded.find((p) => p.id === activeProjectId);
          if (activeProj?.data?.chapters?.some((c) => String(c.unit_id) === String(savedUnit))) {
            activeUnitId = savedUnit;
          }
        }
      }

      let quizAttempts: Record<number, string> = {};
      try {
        const savedQuiz = localStorage.getItem('qs-quiz-attempts');
        if (savedQuiz) quizAttempts = JSON.parse(savedQuiz);
      } catch {
        // ignore parse error
      }

      set({
        projects: loaded,
        activeProjectId,
        activeUnitId,
        currentFilter,
        currentFormatTab,
        showAnswers,
        isEditMode,
        quizAttempts,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to initialize QuestionStudio store', err);
      set({ isLoading: false });
    }
  },

  setActiveProject: (id: string) => {
    const proj = get().projects.find((p) => p.id === id);
    if (!proj) return;
    localStorage.setItem('qs-active-project-id', id);
    localStorage.setItem('qs-active-unit-id', 'all');
    set({
      activeProjectId: id,
      activeUnitId: 'all',
      selectedQuestions: new Set<number>(),
      lastFocusedSrNo: null,
      selectionAnchorSrNo: null,
      revealedAnswers: new Set<number>(),
    });
  },

  setActiveUnit: (unitId: string) => {
    localStorage.setItem('qs-active-unit-id', unitId);
    set({ activeUnitId: unitId });
  },

  setFilter: (filter: FilterType) => {
    localStorage.setItem('qs-current-filter', filter);
    set({ currentFilter: filter });
  },

  setFormatTab: (tab: FormatTab) => {
    localStorage.setItem('qs-format-tab', tab);
    set({ currentFormatTab: tab });
  },

  setSearchQuery: (searchQuery: string) => {
    set({ searchQuery });
  },

  toggleShowAnswers: (forced?: boolean) => {
    const nextVal = forced !== undefined ? forced : !get().showAnswers;
    localStorage.setItem('qs-show-answers', String(nextVal));
    set({ showAnswers: nextVal });
  },

  toggleEditMode: (forced?: boolean) => {
    const nextVal = forced !== undefined ? forced : !get().isEditMode;
    localStorage.setItem('qs-edit-mode', String(nextVal));
    set({ isEditMode: nextVal });
  },

  toggleSelectQuestion: (srNo: number, isMulti = false, isRange = false) => {
    const { selectedQuestions, lastFocusedSrNo, selectionAnchorSrNo, getFlatQuestions } = get();

    if (isRange) {
      const flat = getFlatQuestions();
      const anchorSr = selectionAnchorSrNo ?? lastFocusedSrNo ?? srNo;
      const i1 = flat.findIndex((q) => q.sr_no === anchorSr);
      const i2 = flat.findIndex((q) => q.sr_no === srNo);
      if (i1 !== -1 && i2 !== -1) {
        const next = new Set<number>();
        const [start, end] = i1 < i2 ? [i1, i2] : [i2, i1];
        for (let i = start; i <= end; i++) {
          const item = flat[i];
          if (item) next.add(item.sr_no);
        }
        set({ selectedQuestions: next, lastFocusedSrNo: srNo, selectionAnchorSrNo: anchorSr });
      }
      return;
    }

    if (isMulti) {
      const next = new Set<number>(selectedQuestions);
      if (next.has(srNo)) {
        next.delete(srNo);
        const remaining = Array.from(next);
        set({
          selectedQuestions: next,
          lastFocusedSrNo: remaining.length > 0 ? remaining[remaining.length - 1]! : null,
          selectionAnchorSrNo:
            remaining.length > 0
              ? selectionAnchorSrNo === srNo
                ? remaining[0]!
                : selectionAnchorSrNo
              : null,
        });
      } else {
        next.add(srNo);
        set({
          selectedQuestions: next,
          lastFocusedSrNo: srNo,
          selectionAnchorSrNo: selectionAnchorSrNo ?? srNo,
        });
      }
      return;
    }

    // Single click without modifier
    if (selectedQuestions.has(srNo) && selectedQuestions.size === 1) {
      // Clicking the only selected card toggles it off
      set({ selectedQuestions: new Set<number>(), lastFocusedSrNo: null, selectionAnchorSrNo: null });
    } else {
      set({ selectedQuestions: new Set<number>([srNo]), lastFocusedSrNo: srNo, selectionAnchorSrNo: srNo });
    }
  },

  addQuestionsToSelection: (srNos: number[]) => {
    if (!srNos.length) return;
    const next = new Set<number>(get().selectedQuestions);
    srNos.forEach((sr) => next.add(sr));
    const currentAnchor = get().selectionAnchorSrNo;
    set({
      selectedQuestions: next,
      selectionAnchorSrNo: currentAnchor ?? srNos[0] ?? null,
      lastFocusedSrNo: srNos[srNos.length - 1] ?? null,
    });
  },

  setSelectionRange: (fromSr: number, toSr: number) => {
    const flat = get().getFlatQuestions();
    const i1 = flat.findIndex((q) => q.sr_no === fromSr);
    const i2 = flat.findIndex((q) => q.sr_no === toSr);
    if (i1 === -1 || i2 === -1) return;
    const next = new Set<number>(get().selectedQuestions);
    const [start, end] = i1 < i2 ? [i1, i2] : [i2, i1];
    for (let i = start; i <= end; i++) {
      const item = flat[i];
      if (item) next.add(item.sr_no);
    }
    set({ selectedQuestions: next, selectionAnchorSrNo: fromSr, lastFocusedSrNo: toSr });
  },

  selectAllQuestions: () => {
    const flat = get().getFlatQuestions();
    const next = new Set<number>(flat.map((q) => q.sr_no));
    set({
      selectedQuestions: next,
      selectionAnchorSrNo: flat[0]?.sr_no ?? null,
      lastFocusedSrNo: flat[flat.length - 1]?.sr_no ?? null,
    });
    get().showToast(`Selected all ${flat.length} questions`);
  },

  clearSelection: () => {
    set({ selectedQuestions: new Set<number>(), lastFocusedSrNo: null, selectionAnchorSrNo: null });
  },

  selectNextQuestion: (direction: 'up' | 'down') => {
    const flat = get().getFlatQuestions();
    if (!flat.length) return;

    const { selectedQuestions, selectionAnchorSrNo, lastFocusedSrNo } = get();

    // 1. If nothing is currently selected: select first question as starting point
    if (selectedQuestions.size === 0) {
      const first = flat[0]?.sr_no;
      if (first !== undefined) {
        set({
          selectedQuestions: new Set<number>([first]),
          selectionAnchorSrNo: first,
          lastFocusedSrNo: first,
        });
        document
          .querySelector(`[data-sr-no="${first}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return;
    }

    // Find indices of all currently selected questions
    const selectedIndices: number[] = [];
    flat.forEach((q, idx) => {
      if (selectedQuestions.has(q.sr_no)) {
        selectedIndices.push(idx);
      }
    });

    if (selectedIndices.length === 0) return;

    const minSelIdx = Math.min(...selectedIndices);
    const maxSelIdx = Math.max(...selectedIndices);

    // 2. Resolve Anchor and Lead (cursor) indices
    let anchorIdx =
      selectionAnchorSrNo !== null
        ? flat.findIndex((q) => q.sr_no === selectionAnchorSrNo)
        : -1;
    let leadIdx =
      lastFocusedSrNo !== null
        ? flat.findIndex((q) => q.sr_no === lastFocusedSrNo)
        : -1;

    // Industry standard resolution for multiple selections:
    // If anchor is invalid or not among the selected items, or when starting range selection from multiple items:
    if (anchorIdx === -1 || !selectedQuestions.has(flat[anchorIdx]!.sr_no)) {
      if (direction === 'down') {
        anchorIdx = minSelIdx;
        leadIdx = maxSelIdx;
      } else {
        anchorIdx = maxSelIdx;
        leadIdx = minSelIdx;
      }
    } else if (leadIdx === -1 || !selectedQuestions.has(flat[leadIdx]!.sr_no)) {
      leadIdx = direction === 'down' ? maxSelIdx : minSelIdx;
    }

    // 3. Move the Lead (cursor) in the requested direction
    const targetLeadIdx = direction === 'down' ? leadIdx + 1 : leadIdx - 1;

    // Check boundary
    if (targetLeadIdx < 0 || targetLeadIdx >= flat.length) {
      return;
    }

    // 4. Industry Standard Range Selection:
    // The selection range strictly spans between anchorIdx and targetLeadIdx (expands or contracts)
    const startIdx = Math.min(anchorIdx, targetLeadIdx);
    const endIdx = Math.max(anchorIdx, targetLeadIdx);

    const nextSelection = new Set<number>();
    for (let i = startIdx; i <= endIdx; i++) {
      const q = flat[i];
      if (q) nextSelection.add(q.sr_no);
    }

    const newLeadSrNo = flat[targetLeadIdx]!.sr_no;
    const newAnchorSrNo = flat[anchorIdx]!.sr_no;

    set({
      selectedQuestions: nextSelection,
      selectionAnchorSrNo: newAnchorSrNo,
      lastFocusedSrNo: newLeadSrNo,
    });

    // Auto-scroll the newly selected lead card smoothly into view
    document
      .querySelector(`[data-sr-no="${newLeadSrNo}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },

  cycleFilteredQuestion: (direction: 'next' | 'prev' = 'next') => {
    const filtered = get().getFilteredQuestions();
    if (!filtered.length) return;

    const { lastFocusedSrNo, selectedQuestions } = get();
    let currentIdx = -1;
    if (lastFocusedSrNo !== null) {
      currentIdx = filtered.findIndex((q) => q.sr_no === lastFocusedSrNo);
    } else if (selectedQuestions.size === 1) {
      const selectedSr = Array.from(selectedQuestions)[0];
      currentIdx = filtered.findIndex((q) => q.sr_no === selectedSr);
    }

    let nextIdx = 0;
    if (currentIdx !== -1) {
      if (direction === 'next') {
        nextIdx = (currentIdx + 1) % filtered.length;
      } else {
        nextIdx = (currentIdx - 1 + filtered.length) % filtered.length;
      }
    } else {
      nextIdx = direction === 'next' ? 0 : filtered.length - 1;
    }

    const targetQ = filtered[nextIdx];
    if (!targetQ) return;

    set({
      selectedQuestions: new Set<number>([targetQ.sr_no]),
      lastFocusedSrNo: targetQ.sr_no,
      selectionAnchorSrNo: targetQ.sr_no,
    });

    // Auto-scroll the targeted card smoothly into view
    setTimeout(() => {
      const card = document.querySelector(`[data-sr-no="${targetQ.sr_no}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
  },

  recordQuizAttempt: (srNo: number, optionLetter: string) => {
    const current = { ...get().quizAttempts };
    // Deselect if clicking the same option again
    if (current[srNo] === optionLetter) {
      delete current[srNo];
    } else {
      current[srNo] = optionLetter;
    }
    localStorage.setItem('qs-quiz-attempts', JSON.stringify(current));
    set({ quizAttempts: current });
  },

  clearQuizAttempt: (srNo: number) => {
    const current = { ...get().quizAttempts };
    delete current[srNo];
    localStorage.setItem('qs-quiz-attempts', JSON.stringify(current));
    set({ quizAttempts: current });
  },

  revealAnswer: (srNo: number) => {
    const next = new Set(get().revealedAnswers);
    next.add(srNo);
    set({ revealedAnswers: next });
  },

  hideAnswer: (srNo: number) => {
    const next = new Set(get().revealedAnswers);
    next.delete(srNo);
    const quiz = { ...get().quizAttempts };
    delete quiz[srNo];
    localStorage.setItem('qs-quiz-attempts', JSON.stringify(quiz));
    set({ revealedAnswers: next, quizAttempts: quiz });
  },

  // ─── Inline Edit Actions (delegate to module-level patchQuestion helper) ──────
  updateQuestionText: async (srNo: number, text: string) =>
    patchQuestion(get().projects, get().getActiveProject, (p) => set({ projects: p }), get().showToast, srNo, () => ({ question: text.trim() }), `Updated Q${srNo}`),

  updateOptionText: async (srNo: number, letter: string, text: string) =>
    patchQuestion(get().projects, get().getActiveProject, (p) => set({ projects: p }), get().showToast, srNo, (q) => ({
      options: { ...(q.options || {}), [letter]: text.trim() },
      ...(q.correct_option === letter ? { correct_answer_text: text.trim() } : {}),
    }), `Updated Option ${letter} for Q${srNo}`, false),

  updateCorrectOption: async (srNo: number, letter: string) =>
    patchQuestion(get().projects, get().getActiveProject, (p) => set({ projects: p }), get().showToast, srNo, (q) => ({
      correct_option: letter,
      correct_answer_text: q.options?.[letter] || '',
    }), `Key for Q${srNo} → ${letter}`, false),

  updateDirectAnswer: async (srNo: number, text: string) =>
    patchQuestion(get().projects, get().getActiveProject, (p) => set({ projects: p }), get().showToast, srNo, () => ({ correct_answer_text: text.trim() }), `Updated solution for Q${srNo}`, false),

  renameProject: async (id: string, newTitle: string) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project || !newTitle.trim()) return;
    project.title = newTitle.trim();
    await storageRepo.saveProject(project);
    searchEngine.rebuild(get().projects);
    set({ projects: [...get().projects] });
    get().showToast(`Renamed project to "${newTitle.trim()}"`);
  },

  deleteProject: async (id: string) => {
    const { projects, activeProjectId } = get();
    await storageRepo.deleteProject(id);
    const remaining = projects.filter((p) => p.id !== id);
    searchEngine.rebuild(remaining);
    const nextActiveId = activeProjectId === id ? (remaining[0]?.id || null) : activeProjectId;
    if (nextActiveId) {
      localStorage.setItem('qs-active-project-id', nextActiveId);
    } else {
      localStorage.removeItem('qs-active-project-id');
      localStorage.removeItem('qs-active-unit-id');
      localStorage.removeItem('qs-quiz-attempts');
    }
    set({
      projects: remaining,
      activeProjectId: nextActiveId,
      activeUnitId: 'all',
      selectedQuestions: new Set<number>(),
      revealedAnswers: nextActiveId ? get().revealedAnswers : new Set<number>(),
      quizAttempts: nextActiveId ? get().quizAttempts : {},
    });
    get().showToast('Project deleted');
  },

  addProject: async (id: string, title: string, data: ProjectData) => {
    FormatEngine.updateMetrics(data);
    const newProject: Project = { id, title, data };
    await storageRepo.saveProject(newProject);
    const nextProjects = [newProject, ...get().projects.filter((p) => p.id !== id)];
    searchEngine.rebuild(nextProjects);
    localStorage.setItem('qs-active-project-id', id);
    localStorage.setItem('qs-active-unit-id', 'all');
    set({
      projects: nextProjects,
      activeProjectId: id,
      activeUnitId: 'all',
      selectedQuestions: new Set<number>(),
      revealedAnswers: new Set<number>(),
      currentFormatTab: 'stream',
    });
    get().showToast(`Loaded project: ${title}`);
  },

  restoreSeedProjects: async () => {
    await seedDefaultProjects();
    const loaded = await storageRepo.getAllProjects();
    searchEngine.rebuild(loaded);
    const activeId = loaded[0]?.id || null;
    if (activeId) {
      localStorage.setItem('qs-active-project-id', activeId);
      localStorage.setItem('qs-active-unit-id', 'all');
    }
    set({
      projects: loaded,
      activeProjectId: activeId,
      activeUnitId: 'all',
      selectedQuestions: new Set<number>(),
      revealedAnswers: new Set<number>(),
      quizAttempts: {},
      currentFormatTab: 'stream',
    });
    get().showToast('Restored sample question banks');
  },

  showToast: (msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: msg });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
    }, 2500);
  },
}));
