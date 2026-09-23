import React from 'react';
import { Player, LadderResult } from '../types';
import { Award, Copy, Check, RotateCcw, X } from 'lucide-react';
import { sound } from '../utils/audio';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  results: LadderResult[];
  onRestart: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  players,
  results,
  onRestart,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  // Pair up players and their results
  const matches = players.map((p) => {
    const result = results.find((r) => r.id === p.resultId);
    return {
      player: p,
      resultText: result ? result.text : '미완료',
    };
  });

  const handleCopyText = () => {
    sound.playClick();
    const summaryText = matches
      .map((m) => `[${m.player.name}] ➡️ ${m.resultText}`)
      .join('\n');
    const header = `🪜 [사다리타기 최종 결과]\n--------------------\n`;
    navigator.clipboard.writeText(header + summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">사다리타기 최종 결과</h2>
              <p className="text-xs text-slate-500">참가자 전원의 결과 매칭 결과입니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matches List */}
        <div className="p-6 overflow-y-auto divide-y divide-slate-100 flex-1 space-y-2">
          {matches.map((item) => (
            <div
              key={item.player.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-xs border"
                  style={{
                    backgroundColor: `${item.player.color}18`,
                    borderColor: `${item.player.color}60`,
                  }}
                >
                  {item.player.avatar}
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-900">{item.player.name}</div>
                  <div className="text-[11px] text-slate-400">참가자</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-extrabold text-amber-900 bg-amber-100/70 border border-amber-200/80 px-3 py-1 rounded-lg">
                  {item.resultText}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={handleCopyText}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-xs active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? '결과 복사 완료!' : '결과 텍스트 복사'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                onRestart();
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-xs active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>다시 하기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
