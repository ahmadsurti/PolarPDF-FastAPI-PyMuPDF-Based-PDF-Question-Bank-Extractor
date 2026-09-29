import type { Question } from '../types';

/**
 * Loads an image from a URL or data URI and returns an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (!src.startsWith('/') && !src.startsWith('http') && !src.startsWith('data:')) {
        const retry = new Image();
        retry.crossOrigin = 'anonymous';
        retry.onload = () => resolve(retry);
        retry.onerror = () => resolve(null);
        retry.src = '/' + src;
        return;
      }
      resolve(null);
    };
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paras = (text || '').split('\n');
  for (const para of paras) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Renders a high-resolution, pixel-perfect Question Card PNG
 * containing the prompt task, question text, options, and diagram image.
 * This is the silver bullet for Claude.ai and vision LLMs that only accept image paste.
 */
async function createCompositeCardBlob(
  questions: Question[],
  taskLabel: string,
): Promise<Blob | null> {
  const loadedImgs = new Map<string, HTMLImageElement>();
  for (const q of questions) {
    if (q.images) {
      for (const src of q.images) {
        if (!loadedImgs.has(src)) {
          const im = await loadImage(src);
          if (im) loadedImgs.set(src, im);
        }
      }
    }
  }

  const dpr = 2; // Retina sharpness
  const width = 840;
  const padding = 28;
  const contentWidth = width - padding * 2;

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) return null;

  mctx.font = 'bold 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  let totalHeight = padding;
  totalHeight += 44; // header row

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi]!;
    if (qi > 0) totalHeight += 32;

    totalHeight += 20; // meta line
    mctx.font = 'bold 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const qLines = wrapText(mctx, `Q${q.sr_no}. ${q.question || '[Diagram / Visual Question]'}`, contentWidth);
    totalHeight += qLines.length * 28 + 14;

    if (q.images?.length) {
      for (const src of q.images) {
        const im = loadedImgs.get(src);
        if (im && im.naturalHeight > 0) {
          const scale = Math.min(1, contentWidth / im.naturalWidth);
          totalHeight += im.naturalHeight * scale + 18;
        }
      }
    }

    if (q.type === 'mcq' && q.options) {
      for (const optText of Object.values(q.options)) {
        if (!optText) continue;
        totalHeight += 34;
      }
      totalHeight += 10;
    }
  }

  totalHeight += 52; // footer directive box
  totalHeight += padding;

  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = totalHeight * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, totalHeight - 2);

  let curY = padding;

  // Header badges
  ctx.fillStyle = '#4f46e5';
  ctx.beginPath();
  ctx.roundRect(padding, curY, 130, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('QUESTION STUDIO', padding + 10, curY + 18);

  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.roundRect(padding + 138, curY, Math.min(320, width - padding * 2 - 146), 28, 6);
  ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`TASK: ${taskLabel.toUpperCase()}`, padding + 148, curY + 18);

  curY += 44;

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi]!;

    if (qi > 0) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, curY);
      ctx.lineTo(width - padding, curY);
      ctx.stroke();
      curY += 24;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(
      `${q.unit_name ? q.unit_name + ' • ' : ''}${q.marks} Mark${q.marks > 1 ? 's' : ''} • ${q.type.toUpperCase()}`,
      padding,
      curY,
    );
    curY += 20;

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const qLines = wrapText(ctx, `Q${q.sr_no}. ${q.question || '[Diagram / Visual Question]'}`, contentWidth);
    for (const line of qLines) {
      ctx.fillText(line, padding, curY);
      curY += 28;
    }
    curY += 8;

    if (q.images?.length) {
      for (const src of q.images) {
        const im = loadedImgs.get(src);
        if (im && im.naturalHeight > 0) {
          const scale = Math.min(1, contentWidth / im.naturalWidth);
          const dw = Math.round(im.naturalWidth * scale);
          const dh = Math.round(im.naturalHeight * scale);
          const dx = padding + Math.round((contentWidth - dw) / 2);

          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.strokeRect(dx - 4, curY - 4, dw + 8, dh + 8);

          ctx.drawImage(im, dx, curY, dw, dh);
          curY += dh + 18;
        }
      }
    }

    if (q.type === 'mcq' && q.options) {
      for (const [letter, optText] of Object.entries(q.options)) {
        if (!optText) continue;
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(padding, curY - 16, contentWidth, 26, 6);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.stroke();

        ctx.fillStyle = '#4f46e5';
        ctx.font = 'bold 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`(${letter})`, padding + 10, curY + 2);

        ctx.fillStyle = '#1e293b';
        ctx.font = '13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(optText, padding + 38, curY + 2);

        curY += 34;
      }
      curY += 6;
    }
  }

  // Footer Instructions Box
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.roundRect(padding, curY, contentWidth, 42, 8);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('👉 Please analyze the visual diagram and question above, then provide the complete solution.', padding + 16, curY + 26);

  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

/**
 * Copies question prompt text AND attached diagram images to clipboard in one shot.
 * Compatible with Claude.ai (receives visual card + diagram) & ChatGPT (receives text prompt).
 */
export async function copyQuestionsForAI(
  questions: Question[],
  promptText: string,
  taskLabel = 'Step-by-Step Solution',
): Promise<{ success: boolean; imageCount: number; hasCompositeCard: boolean }> {
  const hasImages = questions.some((q) => q.images && q.images.length > 0);

  // If no images exist: standard fast text copy
  if (!hasImages) {
    try {
      await navigator.clipboard.writeText(promptText);
      return { success: true, imageCount: 0, hasCompositeCard: false };
    } catch {
      return { success: false, imageCount: 0, hasCompositeCard: false };
    }
  }

  // Questions contain diagram images:
  // Render high-res Composite Card containing Question Text + Diagram + Options + Prompt
  try {
    const cardBlob = await createCompositeCardBlob(questions, taskLabel);

    if (cardBlob && typeof ClipboardItem !== 'undefined') {
      const textBlob = new Blob([promptText], { type: 'text/plain' });

      // 1. Write plain text first so Windows History (Win + V) stores pure text as an accessible item
      try {
        await navigator.clipboard.writeText(promptText);
      } catch {
        // ignore
      }

      await new Promise((r) => setTimeout(r, 60));

      // 2. Write multi-type clipboard item:
      // Claude.ai will pick 'image/png' (giving it the full question card + diagram in 1 shot)
      // ChatGPT will pick 'text/plain'
      const clipboardData: Record<string, Blob> = {
        'text/plain': textBlob,
        'image/png': cardBlob,
      };

      await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
      const imgCount = questions.reduce((sum, q) => sum + (q.images?.length || 0), 0);
      return { success: true, imageCount: imgCount, hasCompositeCard: true };
    }
  } catch (err) {
    console.warn('Composite card generation failed, falling back to text copy', err);
  }

  await navigator.clipboard.writeText(promptText);
  return { success: true, imageCount: 0, hasCompositeCard: false };
}

/**
 * Copies ONLY the pure text prompt (guaranteed text paste on Claude/ChatGPT)
 */
export async function copyPromptTextOnly(promptText: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(promptText);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies diagram images directly to clipboard as PNG.
 * If multiple diagrams exist across selected questions, stitches them cleanly with question labels.
 */
export async function copyDiagramOnly(
  questions: Question[],
): Promise<{ success: boolean; count: number }> {
  const imageEntries: { srNo: number; src: string }[] = [];
  questions.forEach((q) => {
    if (q.images && Array.isArray(q.images)) {
      q.images.forEach((src) => {
        if (src) imageEntries.push({ srNo: q.sr_no, src });
      });
    }
  });

  if (!imageEntries.length) return { success: false, count: 0 };

  const loaded = await Promise.all(
    imageEntries.map(async (entry) => ({
      srNo: entry.srNo,
      img: await loadImage(entry.src),
    })),
  );

  const valid = loaded.filter(
    (item): item is { srNo: number; img: HTMLImageElement } =>
      item.img !== null && item.img.naturalWidth > 0,
  );

  if (!valid.length) return { success: false, count: 0 };

  // Single diagram: fast direct copy
  if (valid.length === 1) {
    const { img } = valid[0]!;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { success: false, count: 0 };
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return { success: false, count: 0 };

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return { success: true, count: 1 };
    } catch {
      return { success: false, count: 0 };
    }
  }

  // Multiple diagrams: stitch vertically with clean labeling & padding
  const padding = 20;
  const labelHeight = 28;
  const maxWidth = Math.max(...valid.map((v) => v.img.naturalWidth), 400);

  let totalHeight = padding;
  for (const item of valid) {
    totalHeight += labelHeight + item.img.naturalHeight + padding;
  }

  const canvas = document.createElement('canvas');
  canvas.width = maxWidth + padding * 2;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { success: false, count: 0 };

  // Clean background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let curY = padding;
  for (const item of valid) {
    // Pill label for the question diagram
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.roundRect(padding, curY, 130, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(`DIAGRAM • Q${item.srNo}`, padding + 10, curY + 15);
    curY += labelHeight;

    // Centered image
    const x = Math.round((canvas.width - item.img.naturalWidth) / 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 2, curY - 2, item.img.naturalWidth + 4, item.img.naturalHeight + 4);

    ctx.drawImage(item.img, x, curY);
    curY += item.img.naturalHeight + padding;
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return { success: false, count: 0 };

  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return { success: true, count: valid.length };
  } catch {
    return { success: false, count: 0 };
  }
}
