import { useState, useCallback, useMemo } from 'react';
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
  const [activePathPlayerId, setActivePathPlayerId] = useState<string | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Check if any player has finished or all finished
  const allFinished = useMemo(() => {
    return players.length > 0 && players.every((p) => p.hasFinished);
  }, [players]);

  const finishedCount = useMemo(() => {
    return players.filter((p) => p.hasFinished).length;
  }, [players]);

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

  // Reset entire game
  const handleResetGame = useCallback(() => {
    sound.playShuffle();
    handleRegenerateLadder();
  }, [handleRegenerateLadder]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/60 text-slate-800">
      {/* 3-Zone Clean Top Bar */}
      <TopBar
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onResetGame={handleResetGame}
        onStartAll={handleStartAll}
        onShowResults={() => setIsResultModalOpen(true)}
        isAnyTraveling={isAllTraveling}
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
            <span>참가자 이름이나 하단 결과를 클릭하여 변경할 수 있습니다</span>
          </div>
        </div>

        {/* Controls Card */}
        <Controls
          playerCount={playerCount}
          onUpdatePlayerCount={handleUpdatePlayerCount}
          density={density}
          onSetDensity={handleSetDensity}
          speed={speed}
          onSetSpeed={setSpeed}
          onShuffleResults={handleShuffleResults}
          onRegenerateLadder={handleRegenerateLadder}
          isAnyTraveling={isAllTraveling}
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
