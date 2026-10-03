'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  const [useFrame, setUseFrame] = useState(true);
  const [timeStr, setTimeStr] = useState('21:37');
  const pathname = usePathname();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setTimeStr(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center relative font-sans">
      {/* Desktop presentation header & toggle (hidden on actual small screens) */}
      <div className="hidden md:flex items-center justify-between w-full max-w-4xl px-6 py-3 mb-2 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center text-lg font-bold shadow-lg shadow-violet-900/40">
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">Lumina</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-950 text-violet-300 border border-violet-800">
                Podgląd Aplikacji Mobilnej
              </span>
            </div>
            <p className="text-xs text-gray-400">ImpactHer · Bezpieczny powrót do domu</p>
          </div>
        </div>

        {/* Frame Toggle */}
        <div className="flex items-center gap-2 bg-gray-900/90 border border-gray-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setUseFrame(true)}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              useFrame
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>📱 Ramka Smartfona</span>
          </button>
          <button
            onClick={() => setUseFrame(false)}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              !useFrame
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>💻 Pełny Ekran</span>
          </button>
        </div>
      </div>

      {/* Desktop Background Ambient Glow */}
      <div className="hidden md:block absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Mockup Frame Wrapper for Desktop */}
      {useFrame ? (
        <div className="relative z-10 w-full flex items-center justify-center p-0 md:p-4">
          {/* Phone Shell (desktop view) */}
          <div className="hidden md:block relative w-[390px] h-[820px] max-h-[88vh] bg-gray-950 rounded-[50px] border-[12px] border-gray-900 shadow-[0_0_60px_rgba(124,58,237,0.25),0_25px_50px_-12px_rgba(0,0,0,0.95)] ring-1 ring-white/10 overflow-hidden transform-gpu">
            
            {/* Side Buttons (Visual decoration) */}
            <div className="absolute -left-[16px] top-28 w-[4px] h-10 bg-gray-800 rounded-l-md" /> {/* Volume Up */}
            <div className="absolute -left-[16px] top-42 w-[4px] h-10 bg-gray-800 rounded-l-md" /> {/* Volume Down */}
            <div className="absolute -right-[16px] top-32 w-[4px] h-16 bg-gray-800 rounded-r-md" /> {/* Power Button */}

            {/* Top Status Bar & Dynamic Island */}
            <div className="absolute top-0 left-0 right-0 h-11 px-6 flex items-center justify-between text-[11px] font-semibold text-white/90 z-50 pointer-events-none select-none bg-gradient-to-b from-gray-950/90 to-transparent">
              {/* Clock */}
              <span>{timeStr}</span>

              {/* Dynamic Island Notch */}
              <div className="w-26 h-5 bg-black rounded-full flex items-center justify-between px-2 border border-white/10 shadow-md">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-blue-950" />
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <span>5G</span>
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 18.9C2.9 17.01 2 14.61 2 12c0-5.52 4.48-10 10-10s10 4.48 10 10c0 2.61-.9 5.01-2.35 6.9l-.62-1.29C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z"/>
                  <path d="M12 7c-2.76 0-5 2.24-5 5 0 1.29.49 2.47 1.3 3.36l.66-1.37C8.42 13.38 8 12.73 8 12c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .73-.42 1.38-.96 1.99l.66 1.37C16.51 14.47 17 13.29 17 12c0-2.76-2.24-5-5-5z"/>
                </svg>
                <div className="flex items-center border border-white/60 rounded px-1 py-0.2 text-[9px] font-bold">
                  94%
                </div>
              </div>
            </div>

            {/* Inner Phone Screen Content */}
            <div className="relative w-full h-full pt-10 overflow-y-auto flex flex-col scrollbar-none transform-gpu">
              {children}
            </div>

            {/* Bottom Home Indicator Pill */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/40 rounded-full z-50 pointer-events-none" />
          </div>

          {/* Native Mobile Display (Fallback for small screens when desktop frame wrapper is active) */}
          <div className="block md:hidden w-full min-h-screen">
            {children}
          </div>
        </div>
      ) : (
        /* Full Screen Mode (when frame toggle is switched off) */
        <div className="w-full min-h-screen">
          {children}
        </div>
      )}
    </div>
  );
}
