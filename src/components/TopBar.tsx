import React from 'react';
import { Volume2, VolumeX, Play, RotateCcw, Award } from 'lucide-react';

interface TopBarProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onResetGame: () => void;
  onStartAll: () => void;
  onShowResults: () => void;
  isAnyTraveling: boolean;
  allFinished: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  isMuted,
  onToggleMute,
  onResetGame,
  onStartAll,
  onShowResults,
  isAnyTraveling,
  allFinished,
}) => {
  return (
    <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200 bg-white/85 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2 select-none">
          <span className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-base font-black shadow-inner">
            🪜
          </span>
          사다리타기
        </span>
      </div>

      {/* Zone 2: Secondary utility actions */}
      <div className="flex items-center gap-2 sm:gap-3 text-sm font-medium text-slate-600">
        <button
          onClick={onToggleMute}
          title={isMuted ? '음소거 해제' : '사운드 끄기'}
          className={`p-2 rounded-lg transition-colors border ${
            isMuted
              ? 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          }`}
          aria-label={isMuted ? '음소거 해제' : '사운드 끄기'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onResetGame}
          title="사다리 새로 섞기 및 초기화"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">다시 섞기</span>
        </button>

        {allFinished && (
          <button
            onClick={onShowResults}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300 whitespace-nowrap"
          >
            <Award className="w-3.5 h-3.5 text-amber-700" />
            <span>결과 요약</span>
          </button>
        )}
      </div>

      {/* Zone 3: Primary action button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onStartAll}
          disabled={isAnyTraveling}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white rounded-lg transition-all shadow-sm whitespace-nowrap ${
            isAnyTraveling
              ? 'bg-slate-400 cursor-not-allowed opacity-80'
              : 'bg-amber-600 hover:bg-amber-700 active:scale-98'
          }`}
        >
          <Play className="w-4 h-4 fill-white" />
          <span>{allFinished ? '한 번 더 출발' : '모두 출발'}</span>
        </button>
      </div>
    </header>
  );
};
