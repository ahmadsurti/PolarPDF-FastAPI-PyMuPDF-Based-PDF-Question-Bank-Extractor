import * as React from 'react';
import {
  BookMarked,
  FolderPlus,
  Pencil,
  Trash2,
  UploadCloud,
  Layers,
  CircleDot,
  AlignLeft,
  FileText,
  ListFilter,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/dashboard-shell/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/dashboard-shell/components/ui/tooltip';
import { useSidebar } from '@/dashboard-shell/components/ui/sidebar';
import { useQuestionStudio } from '../store/useQuestionStudio';
import type { ProjectData } from '../types';

interface SidebarContentSectionProps {
  onOpenRename: () => void;
  onOpenDelete: () => void;
}

export function SidebarContentSection({
  onOpenRename,
  onOpenDelete,
}: SidebarContentSectionProps) {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    activeUnitId,
    setActiveUnit,
    currentFilter,
    setFilter,
    getActiveProject,
    addProject,
    showToast,
  } = useQuestionStudio();

  const { state } = useSidebar();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isExtracting, setIsExtracting] = React.useState(false);

  const activeProject = getActiveProject();
  const meta = activeProject?.data?.metadata || {};
  const chapters = activeProject?.data?.chapters || [];

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as ProjectData;
        if (parsed.chapters) {
          const id = file.name.replace('.json', '').replace(/\s+/g, '_');
          await addProject(id, file.name.replace('.json', ''), parsed);
          showToast(`Imported: ${file.name}`);
        } else {
          alert("Invalid project format. Missing 'chapters' property.");
        }
      } catch (err: unknown) {
        alert(`JSON parse error: ${(err as Error).message}`);
      }
    } else if (ext === 'pdf') {
      setIsExtracting(true);
      showToast(`Extracting questions from ${file.name}…`);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('pdf', file);
      try {
        const res = await fetch('/api/extract', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Extractor server error ${res.status}`);
        const parsed = (await res.json()) as ProjectData;
        const id = file.name.replace('.pdf', '').replace(/\s+/g, '_');
        await addProject(id, file.name.replace('.pdf', ''), parsed);
        showToast(
          `Extracted ${parsed.metadata?.total_questions || 0} questions from PDF`,
        );
      } catch (err: unknown) {
        alert(
          `Extractor error: ${(err as Error).message}\n\nEnsure python server.py is running on localhost:5000, or import a JSON export instead.`,
        );
      } finally {
        setIsExtracting(false);
      }
    }
  };

  // ── Hidden File Input (shared across expanded & collapsed modes) ──
  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".json,.pdf"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
        e.target.value = '';
      }}
    />
  );

  // ══════════════════════════════════════════════════════════════════
  // COLLAPSED RAIL MODE (Ctrl+B / 48px width)
  // Clean, dedicated icon buttons with instant tooltips
  // ══════════════════════════════════════════════════════════════════
  if (state === 'collapsed') {
    return (
      <div className="flex flex-col items-center gap-3 py-3 w-full select-none">
        {hiddenFileInput}

        {/* Active Bank Quick Switcher */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-8 rounded-lg flex items-center justify-center bg-sidebar-accent/70 hover:bg-sidebar-accent text-sidebar-foreground border border-sidebar-border/80 transition-colors cursor-pointer shadow-2xs"
                >
                  <BookMarked className="size-4 text-primary" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span className="font-semibold block">{activeProject?.title || 'No Bank Selected'}</span>
              <span className="text-[10px] text-muted-foreground">Click to switch bank</span>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="start" className="min-w-52 max-h-72 overflow-y-auto rounded-xl p-1.5 z-[100]">
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className={`text-xs cursor-pointer ${
                  p.id === activeProjectId ? 'bg-primary/15 text-primary font-semibold' : ''
                }`}
              >
                <span className="truncate">{p.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-5 h-[1px] bg-sidebar-border/60" />

        {/* Question Type Filter Icons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                currentFilter === 'all'
                  ? 'bg-primary/20 text-primary border border-primary/40 font-bold'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <Layers className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">All Questions ({meta.total_questions || 0})</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setFilter('mcq')}
              className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                currentFilter === 'mcq'
                  ? 'bg-primary/20 text-primary border border-primary/40 font-bold'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <CircleDot className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">MCQs ({meta.total_mcqs || 0})</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setFilter('short_answer')}
              className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                currentFilter === 'short_answer'
                  ? 'bg-primary/20 text-primary border border-primary/40 font-bold'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <AlignLeft className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Short Answers ({meta.total_short_answers || 0})</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setFilter('descriptive')}
              className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                currentFilter === 'descriptive'
                  ? 'bg-primary/20 text-primary border border-primary/40 font-bold'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <FileText className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Descriptive ({meta.total_descriptive || 0})</TooltipContent>
        </Tooltip>

        <div className="w-5 h-[1px] bg-sidebar-border/60" />

        {/* Chapters Menu Popover */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-8 rounded-lg flex items-center justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors cursor-pointer"
                >
                  <ListFilter className="size-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">Chapters & Units ({chapters.length})</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="start" className="min-w-60 max-h-72 overflow-y-auto rounded-xl p-1.5 z-[100]">
            <DropdownMenuItem
              onClick={() => setActiveUnit('all')}
              className={`text-xs cursor-pointer ${
                activeUnitId === 'all' ? 'bg-primary/15 text-primary font-semibold' : ''
              }`}
            >
              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-muted font-bold mr-2 border border-border/60">
                ALL
              </span>
              <span>All Chapters</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">{meta.total_questions || 0}</span>
            </DropdownMenuItem>
            {chapters.map((ch, idx) => {
              const unitNum = String(idx + 1).padStart(2, '0');
              const isCurrent = String(ch.unit_id) === String(activeUnitId);
              return (
                <DropdownMenuItem
                  key={ch.unit_id}
                  onClick={() => setActiveUnit(String(ch.unit_id))}
                  className={`text-xs cursor-pointer ${
                    isCurrent ? 'bg-primary/15 text-primary font-semibold' : ''
                  }`}
                >
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted font-bold mr-2 border border-border/60">
                    {unitNum}
                  </span>
                  <span className="truncate">{ch.unit_title}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">{ch.questions?.length || 0}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Upload Trigger in Collapsed Mode */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="size-8 rounded-lg flex items-center justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-primary transition-colors cursor-pointer mt-auto"
            >
              <UploadCloud className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Import PDF / JSON</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // EXPANDED STUDIO WORKFLOW
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col gap-4 p-3 select-none">
      {hiddenFileInput}

      {/* Project Selector & Actions */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
          Active Question Bank
        </label>
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="flex-1 min-w-0 overflow-hidden">
            <Select
              value={activeProjectId || undefined}
              onValueChange={(val) => {
                if (val) setActiveProject(val);
              }}
              disabled={projects.length === 0}
            >
              <SelectTrigger className="h-9 w-full min-w-0 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent/80 border-sidebar-border/80 text-sidebar-foreground text-xs font-medium transition-all shadow-2xs focus:ring-2 focus:ring-primary/25 overflow-hidden">
                <SelectValue placeholder="No Question Bank" className="truncate text-left block min-w-0 w-full" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                sideOffset={6}
                className="max-h-80 w-max min-w-[var(--radix-select-trigger-width)] max-w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-sidebar-border/80 bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 z-[100] overflow-hidden"
              >
                {projects.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="rounded-xl py-2 px-3.5 text-xs cursor-pointer focus:bg-primary/15 focus:text-primary transition-colors"
                  >
                    <span className="whitespace-nowrap truncate block w-full text-left" title={p.title}>
                      {p.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            onClick={onOpenRename}
            disabled={!activeProject}
            title={activeProject ? "Rename active project" : "No project to rename"}
            className="size-9 rounded-xl border border-sidebar-border/80 bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs hover:border-sidebar-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Pencil className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenDelete}
            disabled={!activeProject}
            title={activeProject ? "Delete active project" : "No project to delete"}
            className="size-9 rounded-xl border border-sidebar-border/80 bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-destructive transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs hover:border-destructive/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Type Filter Metrics */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
          Filter by Type
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex flex-col p-2 rounded-lg border text-left transition-all cursor-pointer ${
              currentFilter === 'all'
                ? 'border-primary bg-primary/10 text-primary shadow-2xs font-semibold'
                : 'bg-sidebar-accent/30 border-sidebar-border/60 hover:bg-sidebar-accent/60 hover:border-sidebar-foreground/30 text-sidebar-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium opacity-80">
              <Layers className="size-3" />
              <span>Total</span>
            </div>
            <span className="text-base font-bold font-mono mt-0.5">
              {meta.total_questions || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('mcq')}
            className={`flex flex-col p-2 rounded-lg border text-left transition-all cursor-pointer ${
              currentFilter === 'mcq'
                ? 'border-primary bg-primary/10 text-primary shadow-2xs font-semibold'
                : 'bg-sidebar-accent/30 border-sidebar-border/60 hover:bg-sidebar-accent/60 hover:border-sidebar-foreground/30 text-sidebar-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium opacity-80">
              <CircleDot className="size-3" />
              <span>MCQs</span>
            </div>
            <span className="text-base font-bold font-mono mt-0.5">
              {meta.total_mcqs || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('short_answer')}
            className={`flex flex-col p-2 rounded-lg border text-left transition-all cursor-pointer ${
              currentFilter === 'short_answer'
                ? 'border-primary bg-primary/10 text-primary shadow-2xs font-semibold'
                : 'bg-sidebar-accent/30 border-sidebar-border/60 hover:bg-sidebar-accent/60 hover:border-sidebar-foreground/30 text-sidebar-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium opacity-80">
              <AlignLeft className="size-3" />
              <span>Short Ans</span>
            </div>
            <span className="text-base font-bold font-mono mt-0.5">
              {meta.total_short_answers || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('descriptive')}
            className={`flex flex-col p-2 rounded-lg border text-left transition-all cursor-pointer ${
              currentFilter === 'descriptive'
                ? 'border-primary bg-primary/10 text-primary shadow-2xs font-semibold'
                : 'bg-sidebar-accent/30 border-sidebar-border/60 hover:bg-sidebar-accent/60 hover:border-sidebar-foreground/30 text-sidebar-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium opacity-80">
              <FileText className="size-3" />
              <span>Descriptive</span>
            </div>
            <span className="text-base font-bold font-mono mt-0.5">
              {meta.total_descriptive || 0}
            </span>
          </button>
        </div>
      </div>

      {/* Chapters Navigation (Numbered Unit Badges) */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
          Chapters & Units
        </span>

        <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => setActiveUnit('all')}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeUnitId === 'all'
                ? 'bg-primary/15 text-primary font-semibold'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                  activeUnitId === 'all'
                    ? 'border-primary/40 bg-primary/20 text-primary'
                    : 'border-sidebar-border/80 bg-sidebar-accent text-sidebar-foreground/70'
                }`}
              >
                ALL
              </span>
              <span className="truncate">All Chapters</span>
            </div>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sidebar-accent text-sidebar-foreground/70 shrink-0">
              {meta.total_questions || 0}
            </span>
          </button>

          {chapters.map((ch, idx) => {
            const isCurrent = String(ch.unit_id) === String(activeUnitId);
            const unitNumber = String(idx + 1).padStart(2, '0');
            return (
              <button
                key={ch.unit_id}
                type="button"
                onClick={() => setActiveUnit(String(ch.unit_id))}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`font-mono text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                      isCurrent
                        ? 'border-primary/40 bg-primary/20 text-primary'
                        : 'border-sidebar-border/80 bg-sidebar-accent text-sidebar-foreground/70'
                    }`}
                  >
                    {unitNumber}
                  </span>
                  <span className="truncate" title={ch.unit_title}>
                    {ch.unit_title}
                  </span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sidebar-accent text-sidebar-foreground/70 shrink-0">
                  {ch.questions?.length || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center p-3 rounded-lg border border-dashed transition-all cursor-pointer text-center ${
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-sidebar-border/80 hover:border-sidebar-foreground/30 bg-sidebar-accent/20'
        }`}
      >
        {isExtracting ? (
          <div className="flex items-center gap-2 text-xs font-medium text-primary animate-pulse py-1">
            <UploadCloud className="size-4 animate-bounce" />
            <span>Extracting PDF…</span>
          </div>
        ) : (
          <>
            <FolderPlus className="size-4 text-sidebar-foreground/60 mb-1" />
            <span className="text-[11px] font-semibold text-sidebar-foreground">
              Drop PDF or JSON here
            </span>
            <span className="text-[10px] text-sidebar-foreground/50 mt-0.5">
              or click to browse files
            </span>
          </>
        )}
      </div>
    </div>
  );
}
