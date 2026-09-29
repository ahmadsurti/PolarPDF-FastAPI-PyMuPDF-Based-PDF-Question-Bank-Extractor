import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQuestionStudio } from '../store/useQuestionStudio';

interface ProjectModalsProps {
  renameOpen: boolean;
  onRenameOpenChange: (open: boolean) => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
}

export function ProjectModals({
  renameOpen,
  onRenameOpenChange,
  deleteOpen,
  onDeleteOpenChange,
}: ProjectModalsProps) {
  const { getActiveProject, renameProject, deleteProject } = useQuestionStudio();
  const activeProject = getActiveProject();

  const [titleInput, setTitleInput] = React.useState('');

  React.useEffect(() => {
    if (activeProject && renameOpen) {
      setTitleInput(activeProject.title);
    }
  }, [activeProject, renameOpen]);

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !titleInput.trim()) return;
    await renameProject(activeProject.id, titleInput.trim());
    onRenameOpenChange(false);
  };

  const handleConfirmDelete = async () => {
    if (!activeProject) return;
    await deleteProject(activeProject.id);
    onDeleteOpenChange(false);
  };

  return (
    <>
      {/* Rename Dialog */}
      <DialogPrimitive.Root open={renameOpen} onOpenChange={onRenameOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
              Rename Project
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-xs text-muted-foreground mt-1">
              Give this question collection a distinct name.
            </DialogPrimitive.Description>

            <form onSubmit={handleConfirmRename} className="mt-4 flex flex-col gap-4">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 text-xs rounded-md bg-muted/60 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onRenameOpenChange(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!titleInput.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Delete Dialog */}
      <DialogPrimitive.Root open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
            <DialogPrimitive.Title className="text-sm font-semibold text-destructive">
              Delete Project
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Are you sure you want to delete &quot;{activeProject?.title}&quot;? This will remove all questions and cached exports from offline storage.
            </DialogPrimitive.Description>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onDeleteOpenChange(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
