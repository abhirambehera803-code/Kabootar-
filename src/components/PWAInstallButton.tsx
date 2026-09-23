import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'button' | 'sidebar' }> = ({ variant = 'button' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          onClick={install}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/50 transition"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Install Aether App
          </span>
          <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-sky-500 text-white rounded">
            PWA
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg transition"
        title="Install Aether Messenger to your home screen or desktop"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        {variant === 'sidebar' ? (
          <button
            onClick={() => setShowIOSGuide(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/50 transition"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Install on iOS
            </span>
            <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-sky-500 text-white rounded">
              PWA
            </span>
          </button>
        ) : (
          <button
            onClick={() => setShowIOSGuide(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install on iOS</span>
          </button>
        )}

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-sky-500/30">
                <Download className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Install Aether on iPhone / iPad</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Add Aether to your home screen for full-screen view, offline support, and faster messaging:
              </p>

              <div className="mt-4 space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
                  <span>Tap the <Share className="w-3.5 h-3.5 inline mx-1 text-sky-500" /> <strong>Share</strong> button in Safari toolbar</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
                  <span>Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-sky-500" /> <strong>Add to Home Screen</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-[11px] shrink-0">3</span>
                  <span>Tap <strong>Add</strong> in the top right</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-sky-600 hover:bg-sky-500 py-2.5 text-xs font-semibold text-white transition shadow-sm"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
