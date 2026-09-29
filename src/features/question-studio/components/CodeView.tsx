import * as React from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { useQuestionStudio } from '../store/useQuestionStudio';
import { FormatEngine } from '../services/format-engine';
import type { FormatTab } from '../types';

interface CodeViewProps {
  tab: Exclude<FormatTab, 'stream'>;
}

export function CodeView({ tab }: CodeViewProps) {
  const { getActiveProject, getFlatQuestions, showToast } = useQuestionStudio();
  const activeProject = getActiveProject();
  const [copied, setCopied] = React.useState(false);

  const { content, mimeType, filename, title } = React.useMemo(() => {
    if (!activeProject) {
      return { content: '', mimeType: 'text/plain', filename: 'export.txt', title: 'Export' };
    }

    const baseId = activeProject.id;
    switch (tab) {
      case 'structured':
        return {
          content: JSON.stringify(activeProject.data, null, 2),
          mimeType: 'application/json',
          filename: `${baseId}_structured.json`,
          title: 'Structured JSON Representation',
        };
      case 'flat':
        return {
          content: JSON.stringify(getFlatQuestions(), null, 2),
          mimeType: 'application/json',
          filename: `${baseId}_flat.json`,
          title: 'Flat Question Array (Denormalized)',
        };
      case 'markdown':
        return {
          content: FormatEngine.toMarkdown(activeProject.data),
          mimeType: 'text/markdown',
          filename: `${baseId}.md`,
          title: 'Markdown Documentation Export',
        };
      case 'csv':
        return {
          content: FormatEngine.toCSV(activeProject.data),
          mimeType: 'text/csv',
          filename: `${baseId}.csv`,
          title: 'Comma Separated Values (CSV)',
        };
    }
  }, [activeProject, tab, getFlatQuestions]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      showToast(`Copied ${tab.toUpperCase()} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!content) return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: filename,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  };

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground text-sm">
        No project loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 border border-border/80 rounded-lg bg-card/60 overflow-hidden shadow-xs">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            ({content.length.toLocaleString()} bytes)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer"
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export File</span>
          </button>
        </div>
      </div>

      {/* Code Content */}
      <pre className="flex-1 p-4 font-mono text-xs text-foreground/90 overflow-auto whitespace-pre select-text leading-relaxed">
        {content}
      </pre>
    </div>
  );
}
