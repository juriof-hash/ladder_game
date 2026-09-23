import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Player, LadderResult, LadderRung, Point, SpeedMode } from '../types';
import { calculatePlayerPath, pointsToSvgPath } from '../utils/ladder';
import { sound } from '../utils/audio';
import { Play, Sparkles, Check, Edit2 } from 'lucide-react';

interface LadderCanvasProps {
  players: Player[];
  results: LadderResult[];
  rungs: LadderRung[];
  speed: SpeedMode;
  onUpdatePlayerName: (id: string, newName: string) => void;
  onUpdateResultText: (id: string, newText: string) => void;
  onToggleRung: (col: number, yRatio: number) => void;
  onPlayerFinished: (playerId: string, resultIndex: number) => void;
  activePathPlayerId: string | null;
  setActivePathPlayerId: (id: string | null) => void;
  isAllTraveling: boolean;
}

interface ActiveRunner {
  playerId: string;
  points: Point[];
  currentPointIndex: number;
  progress: number; // 0 to 1 between points[i] and points[i+1]
  currentPos: Point;
  endCol: number;
  color: string;
  avatar: string;
  name: string;
  traveledPath: Point[];
  lastTurnSoundIndex: number;
  lastStepSoundTime: number;
}

export const LadderCanvas: React.FC<LadderCanvasProps> = ({
  players,
  results,
  rungs,
  speed,
  onUpdatePlayerName,
  onUpdateResultText,
  onToggleRung,
  onPlayerFinished,
  activePathPlayerId,
  setActivePathPlayerId,
  isAllTraveling,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);

  // Completed player trails { [playerId]: Point[] }
  const [completedTrails, setCompletedTrails] = useState<Record<string, Point[]>>({});
  
  // Currently animated runners
  const runnersRef = useRef<Map<string, ActiveRunner>>(new Map());
  const [runnersRenderState, setRunnersRenderState] = useState<ActiveRunner[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Hover state for interactive bridge addition
  const [hoverRung, setHoverRung] = useState<{ col: number; yRatio: number } | null>(null);

  // Padding
  const padX = Math.max(50, Math.min(80, dimensions.width / (players.length * 1.5)));
  const padY = 24;
  const colCount = players.length;
  const colSpacing = colCount > 1 ? (dimensions.width - padX * 2) / (colCount - 1) : 0;

  const getColX = useCallback((col: number) => padX + col * colSpacing, [padX, colSpacing]);
  const getYPos = useCallback((yRatio: number) => padY + yRatio * (dimensions.height - padY * 2), [padY, dimensions.height]);

  // Responsive resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const w = Math.max(340, rect.width);
        // Adaptive height based on player count and aspect
        const h = Math.max(420, Math.min(580, window.innerHeight * 0.55));
        setDimensions({ width: w, height: h });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [players.length]);

  // Speed multiplier
  const speedSpeedFactor = speed === 'slow' ? 0.6 : speed === 'fast' ? 1.8 : 1.0;

  // Clear trails on rungs/players count change
  useEffect(() => {
    setCompletedTrails({});
    runnersRef.current.clear();
    setRunnersRenderState([]);
  }, [rungs, players.length]);

  // Start single player animation
  const startPlayerTravel = useCallback((playerIndex: number) => {
    const player = players[playerIndex];
    if (!player) return;

    // Play energetic launch sound
    sound.playLaunch(false);

    // Calculate path
    const path = calculatePlayerPath(
      playerIndex,
      rungs,
      colCount,
      dimensions.width,
      dimensions.height,
      padX,
      padY
    );

    const runner: ActiveRunner = {
      playerId: player.id,
      points: path.points,
      currentPointIndex: 0,
      progress: 0,
      currentPos: { ...path.points[0] },
      endCol: path.endCol,
      color: player.color,
      avatar: player.avatar,
      name: player.name,
      traveledPath: [{ ...path.points[0] }],
      lastTurnSoundIndex: -1,
      lastStepSoundTime: 0,
    };

    runnersRef.current.set(player.id, runner);
    setActivePathPlayerId(player.id);
  }, [players, rungs, colCount, dimensions, padX, padY, setActivePathPlayerId]);

  // Start all players travel
  const startAllTravel = useCallback(() => {
    sound.playLaunch(true);
    players.forEach((_, idx) => {
      // Calculate path
      const player = players[idx];
      if (!player) return;
      const path = calculatePlayerPath(
        idx,
        rungs,
        colCount,
        dimensions.width,
        dimensions.height,
        padX,
        padY
      );

      const runner: ActiveRunner = {
        playerId: player.id,
        points: path.points,
        currentPointIndex: 0,
        progress: 0,
        currentPos: { ...path.points[0] },
        endCol: path.endCol,
        color: player.color,
        avatar: player.avatar,
        name: player.name,
        traveledPath: [{ ...path.points[0] }],
        lastTurnSoundIndex: -1,
        lastStepSoundTime: 0,
      };

      runnersRef.current.set(player.id, runner);
    });
    setActivePathPlayerId(null);
  }, [players, rungs, colCount, dimensions, padX, padY, setActivePathPlayerId]);

  // Expose start trigger if triggered from parent
  useEffect(() => {
    if (isAllTraveling) {
      startAllTravel();
    }
  }, [isAllTraveling, startAllTravel]);

  // Main animation loop
  useEffect(() => {
    let lastTimestamp = performance.now();

    const stepAnimation = (now: number) => {
      const deltaMs = Math.min(50, now - lastTimestamp);
      lastTimestamp = now;

      const activeList = Array.from(runnersRef.current.values());
      if (activeList.length > 0) {
        // Base pixels per millisecond
        const baseSpeed = 0.55 * speedSpeedFactor;
        const distanceToMove = baseSpeed * deltaMs;

        const updatedRunners: ActiveRunner[] = [];

        for (const runner of activeList) {
          const ptA = runner.points[runner.currentPointIndex];
          const ptB = runner.points[runner.currentPointIndex + 1];

          if (!ptB) {
            // Reached destination!
            setCompletedTrails(prev => ({
              ...prev,
              [runner.playerId]: runner.points,
            }));
            runnersRef.current.delete(runner.playerId);
            onPlayerFinished(runner.playerId, runner.endCol);

            // Celebration sound & confetti
            sound.playFinish();
            try {
              confetti({
                particleCount: 40,
                spread: 60,
                origin: {
                  x: ptA.x / window.innerWidth,
                  y: (containerRef.current ? (containerRef.current.getBoundingClientRect().bottom - 60) / window.innerHeight : 0.8),
                },
                colors: [runner.color, '#F59E0B', '#10B981', '#3B82F6'],
              });
            } catch {
              // Confetti safe fallback
            }
            continue;
          }

          const dx = ptB.x - ptA.x;
          const dy = ptB.y - ptA.y;
          const segmentLen = Math.sqrt(dx * dx + dy * dy);

          if (segmentLen <= 0) {
            runner.currentPointIndex++;
            runner.progress = 0;
            continue;
          }

          const progressIncrement = distanceToMove / segmentLen;
          runner.progress += progressIncrement;

          // Sound triggers
          const isHorizontal = Math.abs(dx) > 1;
          if (isHorizontal && runner.lastTurnSoundIndex !== runner.currentPointIndex) {
            runner.lastTurnSoundIndex = runner.currentPointIndex;
            sound.playBridgeTurn(dx > 0 ? 'right' : 'left');
          } else if (!isHorizontal && now - runner.lastStepSoundTime > 95) {
            runner.lastStepSoundTime = now;
            // Dynamic pitch variation based on vertical position
            const pitch = 0.9 + (runner.currentPos.y / dimensions.height) * 0.35;
            sound.playStep(pitch);
          }

          if (runner.progress >= 1) {
            // Finished this segment
            runner.currentPos = { ...ptB };
            runner.currentPointIndex++;
            runner.progress = 0;
            runner.traveledPath.push({ ...ptB });
          } else {
            // Interpolate
            const curX = ptA.x + dx * runner.progress;
            const curY = ptA.y + dy * runner.progress;
            runner.currentPos = { x: curX, y: curY };
            runner.traveledPath[runner.traveledPath.length - 1] = { x: curX, y: curY };
          }

          updatedRunners.push(runner);
        }

        setRunnersRenderState([...updatedRunners]);
      } else {
        if (runnersRenderState.length > 0) {
          setRunnersRenderState([]);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(stepAnimation);
    };

    animFrameIdRef.current = requestAnimationFrame(stepAnimation);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [speedSpeedFactor, dimensions, onPlayerFinished, runnersRenderState.length]);

  // Interactive mouse click on ladder to add/remove bridge
  const handleLadderClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickY < padY || clickY > dimensions.height - padY) return;

    // Find nearest column gap
    const relX = clickX - padX;
    const gapFloat = relX / colSpacing;
    const nearestGap = Math.floor(gapFloat);

    if (nearestGap >= 0 && nearestGap < colCount - 1) {
      const yRatio = (clickY - padY) / (dimensions.height - padY * 2);
      if (yRatio >= 0.08 && yRatio <= 0.92) {
        const isExisting = rungs.some(
          r => r.col === nearestGap && Math.abs(r.yRatio - yRatio) < 0.05
        );
        if (isExisting) {
          sound.playRungRemove();
        } else {
          sound.playRungAdd();
        }
        onToggleRung(nearestGap, yRatio);
      }
    }
  };

  const handleLadderMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseY < padY || mouseY > dimensions.height - padY) {
      setHoverRung(null);
      return;
    }

    const relX = mouseX - padX;
    const gapFloat = relX / colSpacing;
    const nearestGap = Math.floor(gapFloat);

    if (nearestGap >= 0 && nearestGap < colCount - 1) {
      const yRatio = (mouseY - padY) / (dimensions.height - padY * 2);
      if (yRatio >= 0.08 && yRatio <= 0.92) {
        setHoverRung({ col: nearestGap, yRatio });
        return;
      }
    }
    setHoverRung(null);
  };

  const handleLadderMouseLeave = () => {
    setHoverRung(null);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Ladder Container Board */}
      <div
        ref={containerRef}
        className="w-full max-w-5xl bg-white/95 border border-slate-200/80 rounded-2xl shadow-sm p-4 sm:p-6 overflow-x-auto relative select-none"
      >
        {/* Top Participants Bar */}
        <div className="flex justify-between items-end mb-3 px-2 sm:px-4 min-w-[320px]">
          {players.map((player, idx) => {
            const isEditing = editingPlayerId === player.id;
            const isTraveling = runnersRenderState.some(r => r.playerId === player.id);
            const isSelected = activePathPlayerId === player.id;

            return (
              <div
                key={player.id}
                className="flex flex-col items-center group relative"
                style={{
                  width: `${100 / colCount}%`,
                  maxWidth: '120px',
                }}
              >
                {/* Avatar Button / Click to start */}
                <button
                  onClick={() => startPlayerTravel(idx)}
                  disabled={isTraveling}
                  className={`relative flex items-center justify-center w-11 h-11 sm:w-13 sm:h-13 rounded-2xl text-2xl transition-all duration-150 transform group-hover:scale-105 active:scale-95 shadow-sm border-2 ${
                    isSelected
                      ? 'ring-4 ring-amber-400/50 shadow-md scale-105'
                      : 'border-slate-200'
                  }`}
                  style={{
                    backgroundColor: `${player.color}15`,
                    borderColor: player.color,
                  }}
                  title={`${player.name} 클릭하여 사다리 타기`}
                >
                  <span>{player.avatar}</span>
                  {/* Small start badge */}
                  <span
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] shadow-xs group-hover:bg-amber-600 transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
                  </span>
                </button>

                {/* Editable Player Name */}
                <div className="mt-2 text-center w-full px-1">
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      maxLength={8}
                      defaultValue={player.name}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) onUpdatePlayerName(player.id, val);
                        setEditingPlayerId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) onUpdatePlayerName(player.id, val);
                          setEditingPlayerId(null);
                        }
                      }}
                      className="w-full text-center text-xs font-bold py-1 px-1.5 border border-amber-400 rounded-md bg-amber-50 text-slate-900 focus:outline-none ring-2 ring-amber-300"
                    />
                  ) : (
                    <div
                      onClick={() => setEditingPlayerId(player.id)}
                      className="cursor-pointer group/name inline-flex items-center justify-center gap-1 text-xs font-semibold text-slate-800 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 px-2 py-0.5 rounded-md transition-colors truncate max-w-full"
                      title="클릭하여 이름 수정"
                    >
                      <span className="truncate">{player.name}</span>
                      <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/name:opacity-100 text-amber-600 shrink-0" />
                    </div>
                  )}
                </div>

                {/* Individual Start Button */}
                <button
                  onClick={() => startPlayerTravel(idx)}
                  disabled={isTraveling}
                  className="mt-1.5 text-[11px] font-medium text-slate-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-0.5 rounded transition-colors whitespace-nowrap active:scale-95"
                >
                  {player.hasFinished ? '다시타기' : '출발'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Central Ladder SVG Canvas */}
        <div className="relative w-full flex justify-center py-1">
          <svg
            width={dimensions.width}
            height={dimensions.height}
            className="cursor-crosshair overflow-visible"
            onClick={handleLadderClick}
            onMouseMove={handleLadderMouseMove}
            onMouseLeave={handleLadderMouseLeave}
          >
            {/* Background grid / subtle guidance lines */}
            <defs>
              <linearGradient id="poleGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94A3B8" />
                <stop offset="50%" stopColor="#64748B" />
                <stop offset="100%" stopColor="#94A3B8" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Vertical Columns (Poles) */}
            {Array.from({ length: colCount }).map((_, col) => {
              const x = getColX(col);
              const isColActive = runnersRenderState.some(
                r => Math.abs(r.currentPos.x - x) < 4
              );

              return (
                <g key={`col-${col}`}>
                  {/* Vertical Base Line */}
                  <line
                    x1={x}
                    y1={padY}
                    x2={x}
                    y2={dimensions.height - padY}
                    stroke="#CBD5E1"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <line
                    x1={x}
                    y1={padY}
                    x2={x}
                    y2={dimensions.height - padY}
                    stroke={isColActive ? '#94A3B8' : '#E2E8F0'}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Column cap top */}
                  <circle cx={x} cy={padY} r="5" fill="#64748B" />
                  {/* Column cap bottom */}
                  <circle cx={x} cy={dimensions.height - padY} r="5" fill="#64748B" />
                </g>
              );
            })}

            {/* Horizontal Rungs (Bridges) */}
            {rungs.map((rung) => {
              const x1 = getColX(rung.col);
              const x2 = getColX(rung.col + 1);
              const y = getYPos(rung.yRatio);

              return (
                <g
                  key={rung.id}
                  className="cursor-pointer group/rung"
                  onClick={(e) => {
                    e.stopPropagation();
                    sound.playRungRemove();
                    onToggleRung(rung.col, rung.yRatio);
                  }}
                >
                  {/* Hit target for easy clicking to remove */}
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="transparent"
                    strokeWidth="16"
                  />
                  {/* Rung line */}
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="#475569"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="transition-colors group-hover/rung:stroke-rose-500"
                  />
                  {/* Decorative joints */}
                  <circle cx={x1} cy={y} r="3" fill="#334155" />
                  <circle cx={x2} cy={y} r="3" fill="#334155" />
                </g>
              );
            })}

            {/* Hover Guide for Adding Rung */}
            {hoverRung && (
              <g pointerEvents="none">
                <line
                  x1={getColX(hoverRung.col)}
                  y1={getYPos(hoverRung.yRatio)}
                  x2={getColX(hoverRung.col + 1)}
                  y2={getYPos(hoverRung.yRatio)}
                  stroke="#F59E0B"
                  strokeWidth="3"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />
                <circle cx={getColX(hoverRung.col)} cy={getYPos(hoverRung.yRatio)} r="3" fill="#F59E0B" />
                <circle cx={getColX(hoverRung.col + 1)} cy={getYPos(hoverRung.yRatio)} r="3" fill="#F59E0B" />
              </g>
            )}

            {/* Completed Static Trails */}
            {Object.entries(completedTrails).map(([pId, pts]) => {
              const player = players.find(p => p.id === pId);
              if (!player) return null;
              const isSelected = activePathPlayerId === pId;

              return (
                <path
                  key={`trail-${pId}`}
                  d={pointsToSvgPath(pts)}
                  fill="none"
                  stroke={player.color}
                  strokeWidth={isSelected ? 5 : 3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isSelected ? 0.95 : 0.45}
                  filter={isSelected ? 'url(#glow)' : undefined}
                />
              );
            })}

            {/* Active Moving Trails */}
            {runnersRenderState.map((runner) => (
              <path
                key={`active-trail-${runner.playerId}`}
                d={pointsToSvgPath(runner.traveledPath)}
                fill="none"
                stroke={runner.color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
              />
            ))}

            {/* Active Moving Runners (Pucks / Avatars) */}
            {runnersRenderState.map((runner) => (
              <g
                key={`runner-marker-${runner.playerId}`}
                transform={`translate(${runner.currentPos.x}, ${runner.currentPos.y})`}
                className="transition-transform duration-75 ease-linear pointer-events-none"
              >
                {/* Glowing Outer Ring */}
                <circle
                  r="18"
                  fill="white"
                  stroke={runner.color}
                  strokeWidth="3"
                  filter="url(#glow)"
                />
                {/* Runner Avatar */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="16"
                  className="select-none"
                >
                  {runner.avatar}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Bottom Results Bar */}
        <div className="flex justify-between items-start mt-3 px-2 sm:px-4 min-w-[320px]">
          {results.map((result, idx) => {
            const isEditing = editingResultId === result.id;
            // Find if any player finished here
            const matchedPlayer = players.find(p => p.hasFinished && p.resultId === result.id);

            return (
              <div
                key={result.id}
                className="flex flex-col items-center group relative"
                style={{
                  width: `${100 / colCount}%`,
                  maxWidth: '120px',
                }}
              >
                {/* Result Card Box */}
                <div
                  className={`w-full rounded-xl p-2 sm:p-2.5 text-center transition-all duration-300 border ${
                    matchedPlayer
                      ? 'bg-amber-50 border-amber-300 shadow-md ring-2 ring-amber-400/40'
                      : 'bg-slate-50 border-slate-200/90 shadow-xs'
                  }`}
                >
                  {/* Matched player badge if revealed */}
                  {matchedPlayer && (
                    <div
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded mb-1 text-white shadow-xs max-w-full truncate"
                      style={{ backgroundColor: matchedPlayer.color }}
                    >
                      <span className="text-xs">{matchedPlayer.avatar}</span>
                      <span className="truncate">{matchedPlayer.name}</span>
                    </div>
                  )}

                  {/* Result text / Editable */}
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      maxLength={14}
                      defaultValue={result.text}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) onUpdateResultText(result.id, val);
                        setEditingResultId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) onUpdateResultText(result.id, val);
                          setEditingResultId(null);
                        }
                      }}
                      className="w-full text-center text-xs font-bold py-1 px-1 border border-amber-400 rounded bg-white text-slate-900 focus:outline-none ring-2 ring-amber-300"
                    />
                  ) : (
                    <div
                      onClick={() => setEditingResultId(result.id)}
                      className="cursor-pointer group/res flex items-center justify-center gap-1 text-xs font-bold text-slate-800 hover:text-amber-700 transition-colors py-0.5 truncate"
                      title="클릭하여 결과 수정"
                    >
                      <span className="truncate">{result.text}</span>
                      <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/res:opacity-100 text-amber-600 shrink-0" />
                    </div>
                  )}
                </div>

                <div className="mt-1 text-[10px] text-slate-400 font-mono">
                  {idx + 1}번 자리
                </div>
              </div>
            );
          })}
        </div>

        {/* Helper Hint beneath ladder */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>상단 참가자나 사다리를 클릭하면 시작됩니다. 선을 클릭하여 가로선을 추가/삭제할 수도 있습니다.</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>참가자 {players.length}명</span>
            <span>·</span>
            <span>가로선 {rungs.length}개</span>
          </div>
        </div>
      </div>
    </div>
  );
};
