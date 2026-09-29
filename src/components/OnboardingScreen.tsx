import * as React from 'react';
import { FlowButton } from './ui/flow-button';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [isExiting, setIsExiting] = React.useState(false);

  const handleStart = React.useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 200);
  }, [onComplete]);

  // Press Enter key to enter studio immediately
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStart]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white text-neutral-900 p-6 select-none transition-opacity duration-200 ease-out ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <main className="flex flex-col items-center text-center max-w-xl mx-auto">
        {/* Line 1: Sitting polar bear flat WebP logo + lowercase polarpdf in the same line */}
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <img
            src="/polar-sitting.webp"
            alt="polarpdf logo"
            className="h-12 sm:h-16 md:h-20 w-auto object-contain select-none border-0 shadow-none ring-0 outline-none"
            loading="eager"
          />
          <h1 className="font-power text-4xl sm:text-5xl md:text-6xl text-neutral-900 tracking-tight leading-none select-none">
            PolarPDF
          </h1>
        </div>

        {/* Line 2: Subtext */}
        <p className="mt-3.5 text-sm sm:text-base text-neutral-500 font-sans font-normal tracking-normal max-w-md leading-relaxed">
          Deterministic offline question bank &amp; exam intelligence studio
        </p>

        {/* CTA Button */}
        <div className="mt-8 flex justify-center">
          <FlowButton text="Enter Studio" onClick={handleStart} autoFocus />
        </div>
      </main>

      {/* Brand attribution anchored to the right corner with interactive hover expansion */}
      <aside
        aria-label="Brand attribution"
        className="group absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center rounded-full border border-neutral-200/90 bg-neutral-50/90 hover:bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-neutral-600 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer select-none"
      >
        {/* Left: 'a' */}
        <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:max-w-8 group-hover:opacity-100 group-hover:mr-1.5">
          a
        </span>

        {/* Center: Traction Logo */}
        <img
          src="/traction_t_logo.svg"
          alt="Traction Logo"
          className="h-3.5 sm:h-4 w-auto object-contain flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
        />

        {/* Right: 'Traction product' */}
        <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:max-w-40 group-hover:opacity-100 group-hover:ml-1.5">
          Traction product
        </span>
      </aside>
    </div>
  );
}
