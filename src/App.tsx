import { useState, useCallback, useMemo } from 'react';
import { Zap } from 'lucide-react';
import { Player, LadderResult, LadderRung, LadderDensity, SpeedMode } from './types';
import { generateLadderRungs } from './utils/ladder';
import {
  PLAYER_COLORS,
  PLAYER_AVATARS,
  DEFAULT_PLAYER_NAMES,
} from './utils/presets';
import { sound } from './utils/audio';
import { TopBar } from './components/TopBar';
import { Controls } from './components/Controls';
import { LadderCanvas } from './components/LadderCanvas';
import { ResultModal } from './components/ResultModal';

export default function App() {
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [density, setDensity] = useState<LadderDensity>('normal');
  const [speed, setSpeed] = useState<SpeedMode>('normal');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Players state
  const [players, setPlayers] = useState<Player[]>(() => {
    return Array.from({ length: 4 }, (_, i) => ({
      id: `player-${i}`,
      name: DEFAULT_PLAYER_NAMES[i] || `참가자 ${i + 1}`,
      avatar: PLAYER_AVATARS[i % PLAYER_AVATARS.length],
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      hasFinished: false,
      isTraveling: false,
    }));
  });

  // Results state: 기본 결과 1, 2, 3, 4 등으로 깔끔하게 초기화되며 자유롭게 직접 수정 가능
  const [results, setResults] = useState<LadderResult[]>(() => {
    return Array.from({ length: 4 }, (_, i) => ({
      id: `result-${i}`,
      text: `결과 ${i + 1}`,
      isRevealed: false,
    }));
  });

  // Rungs state
  const [rungs, setRungs] = useState<LadderRung[]>(() => generateLadderRungs(4, 'normal'));

  // Animation triggers & active selection
  const [isAllTraveling, setIsAllTraveling] = useState(false);
  const [isRemainingTraveling, setIsRemainingTraveling] = useState(false);
  const [isAnyRunning, setIsAnyRunning] = useState(false);
  const [activePathPlayerId, setActivePathPlayerId] = useState<string | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isLadderHidden, setIsLadderHidden] = useState(false);

  // Check if any player has finished or all finished
  const allFinished = useMemo(() => {
    return players.length > 0 && players.every((p) => p.hasFinished);
  }, [players]);

  const finishedCount = useMemo(() => {
    return players.filter((p) => p.hasFinished).length;
  }, [players]);

  // Remaining un-finished players
  const remainingPlayers = useMemo(() => {
    return players.filter((p) => !p.hasFinished);
  }, [players]);

  const remainingCount = remainingPlayers.length;

  // Handle Player Count change (Min 2 to Max 12)
  const handleUpdatePlayerCount = useCallback(
    (newCount: number) => {
      if (newCount < 2 || newCount > 12) return;
      setPlayerCount(newCount);

      // Re-adjust players array
      setPlayers((prev) => {
        if (newCount > prev.length) {
          const added: Player[] = [];
          for (let i = prev.length; i < newCount; i++) {
            added.push({
              id: `player-${Date.now()}-${i}`,
              name: DEFAULT_PLAYER_NAMES[i] || `참가자 ${i + 1}`,
              avatar: PLAYER_AVATARS[i % PLAYER_AVATARS.length],
              color: PLAYER_COLORS[i % PLAYER_COLORS.length],
              hasFinished: false,
              isTraveling: false,
            });
          }
          return [...prev, ...added];
        } else {
          return prev.slice(0, newCount).map((p) => ({
            ...p,
            hasFinished: false,
            resultId: undefined,
          }));
        }
      });

      // Re-adjust results array keeping existing values if available
      setResults((prev) => {
        if (newCount > prev.length) {
          const added: LadderResult[] = [];
          for (let i = prev.length; i < newCount; i++) {
            added.push({
              id: `result-${Date.now()}-${i}`,
              text: `결과 ${i + 1}`,
              isRevealed: false,
            });
          }
          return [...prev, ...added];
        } else {
          return prev.slice(0, newCount).map((r) => ({
            ...r,
            isRevealed: false,
          }));
        }
      });

      // Regenerate rungs for new column count
      setRungs(generateLadderRungs(newCount, density));
      setIsAllTraveling(false);
      setActivePathPlayerId(null);
    },
    [density]
  );

  // Shuffle results
  const handleShuffleResults = useCallback(() => {
    setResults((prev) => {
      const shuffledTexts = prev.map((r) => r.text).sort(() => Math.random() - 0.5);
      return prev.map((r, i) => ({
        ...r,
        text: shuffledTexts[i],
        isRevealed: false,
      }));
    });
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, hasFinished: false, resultId: undefined }))
    );
    setActivePathPlayerId(null);
  }, []);

  // Regenerate ladder bridges
  const handleRegenerateLadder = useCallback(() => {
    setRungs(generateLadderRungs(playerCount, density));
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, hasFinished: false, resultId: undefined }))
    );
    setResults((prev) => prev.map((r) => ({ ...r, isRevealed: false })));
    setIsAllTraveling(false);
    setActivePathPlayerId(null);
  }, [playerCount, density]);

  // Density change
  const handleSetDensity = useCallback(
    (newDensity: LadderDensity) => {
      setDensity(newDensity);
      setRungs(generateLadderRungs(playerCount, newDensity));
      setPlayers((prev) =>
        prev.map((p) => ({ ...p, hasFinished: false, resultId: undefined }))
      );
      setActivePathPlayerId(null);
    },
    [playerCount]
  );

  // Toggle rung on ladder (click to add/remove)
  const handleToggleRung = useCallback((col: number, yRatio: number) => {
    setRungs((prev) => {
      // Check if existing rung near here (within 0.05 height)
      const existingIdx = prev.findIndex(
        (r) => r.col === col && Math.abs(r.yRatio - yRatio) < 0.05
      );

      if (existingIdx !== -1) {
        // Remove it
        return prev.filter((_, idx) => idx !== existingIdx);
      } else {
        // Add new rung
        const newRung: LadderRung = {
          id: `rung-${col}-${Date.now()}`,
          col,
          yRatio,
        };
        return [...prev, newRung].sort((a, b) => a.yRatio - b.yRatio);
      }
    });

    // Invalidate previous finished runs since ladder geometry changed
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, hasFinished: false, resultId: undefined }))
    );
    setActivePathPlayerId(null);
  }, []);

  // Update single player name
  const handleUpdatePlayerName = useCallback((id: string, newName: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
  }, []);

  // Update single result text
  const handleUpdateResultText = useCallback((id: string, newText: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, text: newText } : r))
    );
  }, []);

  // When a player finishes traversing
  const handlePlayerFinished = useCallback(
    (playerId: string, resultIndex: number) => {
      const matchedResult = results[resultIndex];
      if (!matchedResult) return;

      setPlayers((prev) => {
        const next = prev.map((p) =>
          p.id === playerId
            ? { ...p, hasFinished: true, resultId: matchedResult.id }
            : p
        );
        // If all players have finished now
        if (next.every((p) => p.hasFinished)) {
          sound.playAllFinished();
        }
        return next;
      });

      setResults((prev) =>
        prev.map((r, idx) => (idx === resultIndex ? { ...r, isRevealed: true } : r))
      );
    },
    [results]
  );

  // Mute toggle
  const handleToggleMute = useCallback(() => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
  }, []);

  // Start all
  const handleStartAll = useCallback(() => {
    // Reset any finished status first
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, hasFinished: false, resultId: undefined }))
    );
    setResults((prev) => prev.map((r) => ({ ...r, isRevealed: false })));
    setIsAllTraveling(true);
    // Reset flag after triggered
    setTimeout(() => setIsAllTraveling(false), 200);
  }, []);

  // Start only remaining un-finished players
  const handleStartRemaining = useCallback(() => {
    if (remainingCount === 0 || isAnyRunning) return;
    setIsRemainingTraveling(true);
    setTimeout(() => setIsRemainingTraveling(false), 200);
  }, [remainingCount, isAnyRunning]);

  // Toggle ladder curtain
  const handleToggleLadderCurtain = useCallback(() => {
    setIsLadderHidden((prev) => !prev);
  }, []);

  // Shuffle participant positions
  const handleShufflePlayers = useCallback(() => {
    setPlayers((prev) => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.map((p) => ({
        ...p,
        hasFinished: false,
        resultId: undefined,
      }));
    });
    setResults((prev) => prev.map((r) => ({ ...r, isRevealed: false })));
    setIsAllTraveling(false);
    setIsRemainingTraveling(false);
    setActivePathPlayerId(null);
  }, []);

  // Drag & drop or arrow reordering of participants
  const handleReorderPlayers = useCallback((sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    sound.playClick();
    setPlayers((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((p) => ({
        ...p,
        hasFinished: false,
        resultId: undefined,
      }));
    });
    setResults((prev) => prev.map((r) => ({ ...r, isRevealed: false })));
    setIsAllTraveling(false);
    setIsRemainingTraveling(false);
    setActivePathPlayerId(null);
  }, []);

  // Reset entire game
  const handleResetGame = useCallback(() => {
    sound.playShuffle();
    handleRegenerateLadder();
  }, [handleRegenerateLadder]);

  const isBusyTraveling = isAllTraveling || isRemainingTraveling || isAnyRunning;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/60 text-slate-800">
      {/* 3-Zone Clean Top Bar */}
      <TopBar
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onResetGame={handleResetGame}
        onStartAll={handleStartAll}
        onStartRemaining={handleStartRemaining}
        remainingCount={remainingCount}
        totalCount={playerCount}
        onShowResults={() => setIsResultModalOpen(true)}
        isAnyTraveling={isBusyTraveling}
        allFinished={allFinished}
      />

      {/* Main Play Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 flex flex-col items-center">
        {/* Progress & Quick Stats */}
        <div className="w-full max-w-5xl flex items-center justify-between text-xs text-slate-500 mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">진행 상황</span>
            <span aria-hidden="true">·</span>
            <span>
              완료 {finishedCount} / {playerCount}명
            </span>
            {allFinished && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 font-bold">전원 도착 완료!</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>참가자를 드래그하여 자리를 바꾸거나, 사다리를 커튼으로 가릴 수 있습니다</span>
          </div>
        </div>

        {/* Dynamic Remaining Players Quick Action Banner */}
        {remainingCount >= 2 && remainingCount < playerCount && (
          <div className="w-full max-w-5xl mb-4 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 border border-amber-300/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white font-black text-sm shadow-xs animate-bounce">
                <Zap className="w-5 h-5 fill-white" />
              </span>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                  <span>
                    마지막 <strong className="text-amber-700 font-black text-sm sm:text-base">{remainingCount}명</strong> 남았습니다!
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    ({remainingPlayers.map((p) => p.name).join(', ')})
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  남은 참가자들을 한 번에 출발시켜 긴장감 넘치는 결말을 확인해보세요.
                </div>
              </div>
            </div>

            <button
              onClick={handleStartRemaining}
              disabled={isBusyTraveling}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                isBusyTraveling
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/50 shadow-amber-600/25'
              }`}
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>마지막 {remainingCount}명 동시 출발</span>
            </button>
          </div>
        )}

        {/* Controls Card */}
        <Controls
          playerCount={playerCount}
          onUpdatePlayerCount={handleUpdatePlayerCount}
          density={density}
          onSetDensity={handleSetDensity}
          speed={speed}
          onSetSpeed={setSpeed}
          onShufflePlayers={handleShufflePlayers}
          onShuffleResults={handleShuffleResults}
          onRegenerateLadder={handleRegenerateLadder}
          isLadderHidden={isLadderHidden}
          onToggleLadderCurtain={handleToggleLadderCurtain}
          isAnyTraveling={isBusyTraveling}
        />

        {/* Interactive Ladder Canvas */}
        <LadderCanvas
          players={players}
          results={results}
          rungs={rungs}
          speed={speed}
          onUpdatePlayerName={handleUpdatePlayerName}
          onUpdateResultText={handleUpdateResultText}
          onToggleRung={handleToggleRung}
          onPlayerFinished={handlePlayerFinished}
          activePathPlayerId={activePathPlayerId}
          setActivePathPlayerId={setActivePathPlayerId}
          isAllTraveling={isAllTraveling}
          isRemainingTraveling={isRemainingTraveling}
          onTravelingChange={setIsAnyRunning}
          remainingCount={remainingCount}
          onReorderPlayers={handleReorderPlayers}
          isLadderHidden={isLadderHidden}
          onToggleLadderCurtain={handleToggleLadderCurtain}
        />
      </main>

      {/* Final Results Modal */}
      <ResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        players={players}
        results={results}
        onRestart={handleResetGame}
      />
    </div>
  );
}
