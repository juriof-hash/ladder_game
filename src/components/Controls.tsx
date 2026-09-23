import React from 'react';
import { Plus, Minus, Shuffle, Sparkles } from 'lucide-react';
import { LadderDensity, SpeedMode } from '../types';
import { sound } from '../utils/audio';

interface ControlsProps {
  playerCount: number;
  onUpdatePlayerCount: (count: number) => void;
  density: LadderDensity;
  onSetDensity: (density: LadderDensity) => void;
  speed: SpeedMode;
  onSetSpeed: (speed: SpeedMode) => void;
  onShuffleResults: () => void;
  onRegenerateLadder: () => void;
  isAnyTraveling: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  playerCount,
  onUpdatePlayerCount,
  density,
  onSetDensity,
  speed,
  onSetSpeed,
  onShuffleResults,
  onRegenerateLadder,
  isAnyTraveling,
}) => {
  const minPlayers = 2;
  const maxPlayers = 12;

  const handleCountChange = (delta: number) => {
    const next = playerCount + delta;
    if (next >= minPlayers && next <= maxPlayers) {
      sound.playClick();
      onUpdatePlayerCount(next);
    }
  };

  return (
    <div className="w-full max-w-5xl bg-white/85 border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5 mb-5 select-none">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* 참가 인원수 조절 (최소 2인 이상) */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
            참가 인원
          </span>

          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={() => handleCountChange(-1)}
              disabled={playerCount <= minPlayers || isAnyTraveling}
              aria-label="인원 1명 줄이기"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all font-bold ${
                playerCount <= minPlayers || isAnyTraveling
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'bg-white text-slate-800 shadow-xs hover:bg-slate-50 active:scale-95'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="w-14 text-center font-extrabold text-slate-900 text-sm tabular-nums">
              {playerCount}명
            </div>

            <button
              onClick={() => handleCountChange(1)}
              disabled={playerCount >= maxPlayers || isAnyTraveling}
              aria-label="인원 1명 늘리기"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all font-bold ${
                playerCount >= maxPlayers || isAnyTraveling
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'bg-white text-slate-800 shadow-xs hover:bg-slate-50 active:scale-95'
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
            (최소 {minPlayers}명 ~ 최대 {maxPlayers}명)
          </span>
        </div>

        {/* 사다리 밀도 & 이동 속도 조절 */}
        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
          {/* 사다리 밀도 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">선 개수</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(['simple', 'normal', 'complex'] as LadderDensity[]).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    sound.playClick();
                    onSetDensity(d);
                  }}
                  disabled={isAnyTraveling}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    density === d
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {d === 'simple' ? '단순' : d === 'normal' ? '보통' : '복잡'}
                </button>
              ))}
            </div>
          </div>

          {/* 진행 속도 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">속도</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(['slow', 'normal', 'fast'] as SpeedMode[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    sound.playClick();
                    onSetSpeed(s);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    speed === s
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {s === 'slow' ? '느림' : s === 'normal' ? '보통' : '빠름'}
                </button>
              ))}
            </div>
          </div>

          {/* 결과 섞기 & 사다리 새로짜기 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playShuffle();
                onShuffleResults();
              }}
              disabled={isAnyTraveling}
              title="하단 결과 위치를 무작위로 섞습니다"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 border border-slate-200 rounded-lg transition-colors active:scale-95"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>결과 섞기</span>
            </button>

            <button
              onClick={() => {
                sound.playShuffle();
                onRegenerateLadder();
              }}
              disabled={isAnyTraveling}
              title="사다리 가로선 형태를 새로 생성합니다"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>사다리 새로짜기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
