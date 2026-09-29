import * as React from 'react';
import { ArrowRight } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [mounted, setMounted] = React.useState(false);
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 280);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-white text-zinc-950 p-6 sm:p-10 select-none overflow-hidden transition-all duration-300 ease-out ${
        isExiting ? 'opacity-0 scale-[0.99] filter blur-sm pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top Header Row */}
      <header className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-zinc-400">
          <span>A Traction Product</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>100% Offline • Local IndexedDB</span>
        </div>
      </header>

      {/* Main Center Content */}
      <main className="flex flex-col items-center justify-center text-center max-w-lg mx-auto w-full my-auto">
        {/* Polar Bear Artwork with Blur-to-Focus entrance */}
        <div
          className={`relative transition-all duration-700 ease-out transform ${
            mounted
              ? 'opacity-100 blur-0 scale-100 translate-y-0'
              : 'opacity-0 blur-xl scale-95 translate-y-4'
          }`}
        >
          <img
            src="/polar-sitting.png"
            alt="Polar Bear Mascot"
            className="w-48 sm:w-60 md:w-68 h-auto object-contain pointer-events-none drop-shadow-sm mx-auto"
            loading="eager"
          />
        </div>

        {/* Brand Title & Logo */}
        <div
          className={`mt-6 flex flex-col items-center gap-2 transition-all duration-700 delay-100 ease-out transform ${
            mounted
              ? 'opacity-100 blur-0 translate-y-0'
              : 'opacity-0 blur-md translate-y-3'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="polarpdf logo" className="size-6 sm:size-7" />
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
              PolarPDF
            </h1>
          </div>
          <p className="text-sm sm:text-base text-zinc-500 max-w-sm font-normal leading-relaxed mt-1">
            Deterministic exam question bank studio with instant diagram cropping and zero cloud dependencies.
          </p>
        </div>

        {/* Enter CTA */}
        <div
          className={`mt-8 transition-all duration-700 delay-200 ease-out transform ${
            mounted
              ? 'opacity-100 blur-0 translate-y-0'
              : 'opacity-0 blur-md translate-y-3'
          }`}
        >
          <button
            type="button"
            onClick={handleStart}
            autoFocus
            className="group inline-flex items-center gap-2.5 rounded-full bg-zinc-950 px-8 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98] transition-all hover:gap-3.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
          >
            <span>Enter Studio</span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </main>

      {/* Bottom Footer Info */}
      <footer className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <span>PyMuPDF • FastAPI • React 19</span>
        <span>Zero Tokens • No Hallucinations</span>
      </footer>
    </div>
  );
}
