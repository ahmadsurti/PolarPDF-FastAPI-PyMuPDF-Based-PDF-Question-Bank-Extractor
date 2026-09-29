import * as React from 'react';
import { useQuestionStudio } from '../store/useQuestionStudio';

export function useMarqueeSelection(containerRef: React.RefObject<HTMLDivElement | null>) {
  const { clearSelection, addQuestionsToSelection } = useQuestionStudio();

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let marquee = document.getElementById('marquee-box');
    if (!marquee) {
      marquee = document.createElement('div');
      marquee.id = 'marquee-box';
      document.body.appendChild(marquee);
    }

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let lastScrolledSrNo: number | null = null;
    let autoScrollRafId: number | null = null;

    const getScrollViewport = (): HTMLElement | null => {
      return (
        container.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ||
        container.closest<HTMLElement>('.overflow-y-auto') ||
        container
      );
    };

    const updateSelection = (clientX: number, clientY: number) => {
      if (!dragging || !marquee) return;

      const x = Math.min(startX, clientX);
      const y = Math.min(startY, clientY);
      const w = Math.abs(clientX - startX);
      const h = Math.abs(clientY - startY);

      marquee.style.left = `${x}px`;
      marquee.style.top = `${y}px`;
      marquee.style.width = `${w}px`;
      marquee.style.height = `${h}px`;

      const newlySelected: number[] = [];
      const cards = container.querySelectorAll<HTMLElement>('.q-card');

      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const overlap = !(r.right < x || r.left > x + w || r.bottom < y || r.top > y + h);
        const srNo = Number(card.dataset.srNo);
        if (overlap && srNo) {
          newlySelected.push(srNo);
        }
      });

      if (newlySelected.length > 0) {
        addQuestionsToSelection(newlySelected);

        // Determine active card based on drag direction (leading edge)
        const isDraggingDown = clientY >= startY;
        const activeSrNo = isDraggingDown
          ? newlySelected[newlySelected.length - 1]
          : newlySelected[0];

        if (activeSrNo && activeSrNo !== lastScrolledSrNo) {
          lastScrolledSrNo = activeSrNo;
          const activeCard = container.querySelector<HTMLElement>(`[data-sr-no="${activeSrNo}"]`);
          if (activeCard) {
            activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }
    };

    const autoScrollLoop = () => {
      if (!dragging) return;

      const viewport = getScrollViewport();
      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        const edgeThreshold = 65;
        const maxSpeed = 18;

        if (lastClientY > rect.bottom - edgeThreshold && lastClientY <= rect.bottom + 40) {
          const intensity = Math.min(
            1,
            (lastClientY - (rect.bottom - edgeThreshold)) / edgeThreshold,
          );
          viewport.scrollTop += Math.ceil(maxSpeed * intensity);
          updateSelection(lastClientX, lastClientY);
        } else if (lastClientY < rect.top + edgeThreshold && lastClientY >= rect.top - 40) {
          const intensity = Math.min(
            1,
            (rect.top + edgeThreshold - lastClientY) / edgeThreshold,
          );
          viewport.scrollTop -= Math.ceil(maxSpeed * intensity);
          updateSelection(lastClientX, lastClientY);
        }
      }

      autoScrollRafId = requestAnimationFrame(autoScrollLoop);
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.q-card') && !e.shiftKey) return;
      if (target.isContentEditable || target.closest('button, input, select, a, textarea')) return;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      lastScrolledSrNo = null;

      marquee!.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:0;height:0;display:block`;

      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        clearSelection();
      }

      e.preventDefault();

      if (autoScrollRafId) cancelAnimationFrame(autoScrollRafId);
      autoScrollRafId = requestAnimationFrame(autoScrollLoop);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      updateSelection(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      lastScrolledSrNo = null;
      if (autoScrollRafId) {
        cancelAnimationFrame(autoScrollRafId);
        autoScrollRafId = null;
      }
      if (marquee) marquee.style.display = 'none';
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (autoScrollRafId) {
        cancelAnimationFrame(autoScrollRafId);
      }
    };
  }, [containerRef, clearSelection, addQuestionsToSelection]);
}
