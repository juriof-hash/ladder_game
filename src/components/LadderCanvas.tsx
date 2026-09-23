import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Player, LadderResult, LadderRung, Point, SpeedMode, LadderDensity } from '../types';
import { calculatePlayerPath, pointsToSvgPath } from '../utils/ladder';
import { sound } from '../utils/audio';
import { Play, Sparkles, Check, Edit2, GripHorizontal, Eye, EyeOff, Compass } from 'lucide-react';

interface LadderCanvasProps {
  players: Player[];
  results: LadderResult[];
  rungs: LadderRung[];
  density?: LadderDensity;
  speed: SpeedMode;
  onUpdatePlayerName: (id: string, newName: string) => void;
  onUpdateResultText: (id: string, newText: string) => void;
  onToggleRung: (col: number, yRatio: number, y2Ratio?: number) => void;
  onPlayerFinished: (playerId: string, resultIndex: number) => void;
  activePathPlayerId: string | null;
  setActivePathPlayerId: (id: string | null) => void;
  isAllTraveling: boolean;
  isRemainingTraveling: boolean;
  onTravelingChange?: (isTraveling: boolean) => void;
  remainingCount?: number;
  onReorderPlayers: (sourceIndex: number, targetIndex: number) => void;
  isLadderHidden: boolean;
  onToggleLadderCurtain: () => void;
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
  density,
  speed,
  onUpdatePlayerName,
  onUpdateResultText,
  onToggleRung,
  onPlayerFinished,
  activePathPlayerId,
  setActivePathPlayerId,
  isAllTraveling,
  isRemainingTraveling,
  onTravelingChange,
  remainingCount,
  onReorderPlayers,
  isLadderHidden,
  onToggleLadderCurtain,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);

  // Drag & drop state for reordering participants
  const [draggedPlayerIndex, setDraggedPlayerIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Completed player trails { [playerId]: Point[] }
  const [completedTrails, setCompletedTrails] = useState<Record<string, Point[]>>({});
  
  // Currently animated runners
  const runnersRef = useRef<Map<string, ActiveRunner>>(new Map());
  const [runnersRenderState, setRunnersRenderState] = useState<ActiveRunner[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const wasRunningRef = useRef(false);

  // Hover state for interactive bridge addition (supports diagonal with Shift key)
  const [hoverRung, setHoverRung] = useState<{
    col: number;
    yRatio: number;
    y2Ratio: number;
    isDiagonal: boolean;
  } | null>(null);

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
    if (wasRunningRef.current) {
      wasRunningRef.current = false;
      onTravelingChange?.(false);
    }
  }, [rungs, players.length, onTravelingChange]);

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
    if (!wasRunningRef.current) {
      wasRunningRef.current = true;
      onTravelingChange?.(true);
    }
    setActivePathPlayerId(player.id);
  }, [players, rungs, colCount, dimensions, padX, padY, setActivePathPlayerId, onTravelingChange]);

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

    if (!wasRunningRef.current) {
      wasRunningRef.current = true;
      onTravelingChange?.(true);
    }
    setActivePathPlayerId(null);
  }, [players, rungs, colCount, dimensions, padX, padY, setActivePathPlayerId, onTravelingChange]);

  // Start only remaining un-finished players simultaneously
  const startRemainingTravel = useCallback(() => {
    const unstarted = players
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => !p.hasFinished && !runnersRef.current.has(p.id));

    if (unstarted.length === 0) return;

    sound.playLaunch(true);

    unstarted.forEach(({ p, idx }) => {
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
        playerId: p.id,
        points: path.points,
        currentPointIndex: 0,
        progress: 0,
        currentPos: { ...path.points[0] },
        endCol: path.endCol,
        color: p.color,
        avatar: p.avatar,
        name: p.name,
        traveledPath: [{ ...path.points[0] }],
        lastTurnSoundIndex: -1,
        lastStepSoundTime: 0,
      };

      runnersRef.current.set(p.id, runner);
    });

    if (!wasRunningRef.current) {
      wasRunningRef.current = true;
      onTravelingChange?.(true);
    }
    setActivePathPlayerId(null);
  }, [players, rungs, colCount, dimensions, padX, padY, setActivePathPlayerId, onTravelingChange]);

  // Expose start trigger if triggered from parent
  useEffect(() => {
    if (isAllTraveling) {
      startAllTravel();
    }
  }, [isAllTraveling, startAllTravel]);

  useEffect(() => {
    if (isRemainingTraveling) {
      startRemainingTravel();
    }
  }, [isRemainingTraveling, startRemainingTravel]);

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
        if (updatedRunners.length === 0 && wasRunningRef.current) {
          wasRunningRef.current = false;
          onTravelingChange?.(false);
        }
      } else {
        if (runnersRenderState.length > 0) {
          setRunnersRenderState([]);
        }
        if (wasRunningRef.current) {
          wasRunningRef.current = false;
          onTravelingChange?.(false);
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
        const isExisting = rungs.find(
          r => r.col === nearestGap && (
            Math.abs(r.yRatio - yRatio) < 0.05 ||
            (r.y2Ratio !== undefined && Math.abs(r.y2Ratio - yRatio) < 0.05)
          )
        );
        if (isExisting) {
          sound.playRungRemove();
          onToggleRung(nearestGap, isExisting.yRatio, isExisting.y2Ratio);
        } else {
          sound.playRungAdd();
          let y2Ratio = yRatio;
          if (e.shiftKey) {
            y2Ratio = Math.min(0.92, yRatio + 0.055);
          } else if (e.altKey) {
            y2Ratio = Math.max(0.08, yRatio - 0.055);
          }
          onToggleRung(nearestGap, yRatio, y2Ratio);
        }
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
        let y2Ratio = yRatio;
        let isDiagonal = false;
        if (e.shiftKey) {
          y2Ratio = Math.min(0.92, yRatio + 0.055);
          isDiagonal = true;
        } else if (e.altKey) {
          y2Ratio = Math.max(0.08, yRatio - 0.055);
          isDiagonal = true;
        }
        setHoverRung({ col: nearestGap, yRatio, y2Ratio, isDiagonal });
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
        {/* Top Header / Drag Guide & Quick Curtain Toggle */}
        <div className="flex items-center justify-between mb-3 px-2 text-xs text-slate-500 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <GripHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="hidden sm:inline">참가자 카드를 드래그하여 순서 변경 (Shift+클릭 시 사선 다리 생성)</span>
              <span className="sm:hidden">드래그하여 참가자 위치 변경</span>
            </span>
            {density === 'complex' && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md shadow-2xs">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span>보라색 선: 사선·X자 사다리</span>
              </span>
            )}
          </div>

          <button
            onClick={() => {
              sound.playCurtain(!isLadderHidden);
              onToggleLadderCurtain();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all active:scale-95 shadow-2xs ${
              isLadderHidden
                ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700 shadow-rose-200'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700'
            }`}
            title={isLadderHidden ? '커튼을 열어 사다리를 확인합니다' : '커튼을 쳐서 사다리 경로를 가립니다'}
          >
            {isLadderHidden ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>커튼 제끼기 (사다리 보기)</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                <span>사다리 가리기 (커튼 치기)</span>
              </>
            )}
          </button>
        </div>

        {/* Top Participants Bar */}
        <div className="flex justify-between items-end mb-3 px-2 sm:px-4 min-w-[320px]">
          {players.map((player, idx) => {
            const isEditing = editingPlayerId === player.id;
            const isTraveling = runnersRenderState.some(r => r.playerId === player.id);
            const isSelected = activePathPlayerId === player.id;
            const isRemainingWaiting = 
              (remainingCount ?? colCount) >= 2 && 
              (remainingCount ?? colCount) < colCount && 
              !player.hasFinished && 
              !isTraveling;
            const isDragging = draggedPlayerIndex === idx;
            const isDropTarget = dropTargetIndex === idx && draggedPlayerIndex !== null && draggedPlayerIndex !== idx;

            return (
              <div
                key={player.id}
                draggable={!isTraveling}
                onDragStart={(e) => {
                  if (isTraveling) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData('text/plain', String(idx));
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedPlayerIndex(idx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropTargetIndex !== idx) {
                    setDropTargetIndex(idx);
                  }
                }}
                onDragLeave={() => {
                  if (dropTargetIndex === idx) {
                    setDropTargetIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceIdxStr = e.dataTransfer.getData('text/plain');
                  const sourceIdx = Number(sourceIdxStr);
                  if (!isNaN(sourceIdx) && sourceIdx !== idx) {
                    onReorderPlayers(sourceIdx, idx);
                  }
                  setDraggedPlayerIndex(null);
                  setDropTargetIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedPlayerIndex(null);
                  setDropTargetIndex(null);
                }}
                className={`flex flex-col items-center group relative transition-all duration-200 cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-30 scale-95' : ''
                } ${isDropTarget ? 'scale-105' : ''}`}
                style={{
                  width: `${100 / colCount}%`,
                  maxWidth: '120px',
                }}
              >
                {/* Drop Highlight Indicator */}
                {isDropTarget && (
                  <div className="absolute inset-0 -top-4 -bottom-3 border-2 border-dashed border-blue-500 bg-blue-50/85 rounded-2xl pointer-events-none z-30 flex items-center justify-center animate-pulse shadow-md">
                    <span className="text-[10px] font-black text-blue-700 bg-white px-2 py-0.5 rounded shadow-xs">
                      여기로 이동
                    </span>
                  </div>
                )}

                {/* Drag Grip Handle & Quick Reorder Arrows */}
                <div className="flex items-center justify-center gap-1 mb-1 w-full text-slate-400 group-hover:text-slate-600 transition-colors">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderPlayers(idx, idx - 1);
                      }}
                      disabled={isTraveling}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 p-0.5 rounded hover:bg-slate-100 text-[10px]"
                      title="왼쪽과 순서 바꾸기"
                    >
                      ◀
                    </button>
                  )}
                  <div title="드래그하여 참가자 위치 변경">
                    <GripHorizontal className="w-3.5 h-3.5" />
                  </div>
                  {idx < colCount - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderPlayers(idx, idx + 1);
                      }}
                      disabled={isTraveling}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 p-0.5 rounded hover:bg-slate-100 text-[10px]"
                      title="오른쪽과 순서 바꾸기"
                    >
                      ▶
                    </button>
                  )}
                </div>

                {/* Remaining player badge */}
                {isRemainingWaiting && (
                  <span className="absolute -top-3.5 px-1.5 py-0.2 text-[10px] font-extrabold bg-amber-500 text-white rounded-full shadow-xs animate-bounce z-10 whitespace-nowrap">
                    대기
                  </span>
                )}

                {/* Avatar Button / Click to start */}
                <button
                  onClick={() => startPlayerTravel(idx)}
                  disabled={isTraveling}
                  className={`relative flex items-center justify-center w-11 h-11 sm:w-13 sm:h-13 rounded-2xl text-2xl transition-all duration-150 transform group-hover:scale-105 active:scale-95 shadow-sm border-2 ${
                    isRemainingWaiting
                      ? 'ring-4 ring-amber-400/60 shadow-md scale-105'
                      : isSelected
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
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] shadow-xs transition-colors ${
                      isRemainingWaiting ? 'bg-amber-600' : 'bg-slate-900 group-hover:bg-amber-600'
                    }`}
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
                  className={`mt-1.5 text-[11px] px-2 py-0.5 rounded transition-colors whitespace-nowrap active:scale-95 ${
                    isRemainingWaiting
                      ? 'font-bold text-amber-800 bg-amber-100/90 hover:bg-amber-200'
                      : 'font-medium text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {player.hasFinished ? '완료' : '출발'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Central Ladder SVG Canvas & Curtain Stage Frame */}
        <div className="relative w-full flex justify-center py-1 overflow-hidden rounded-2xl bg-slate-50/40 border border-slate-100/80">
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

            {/* Rungs (Bridges - both horizontal and diagonal) */}
            {rungs.map((rung) => {
              const x1 = getColX(rung.col);
              const x2 = getColX(rung.col + 1);
              const y1 = getYPos(rung.yRatio);
              const y2 = getYPos(rung.y2Ratio ?? rung.yRatio);
              const isDiagonal = Math.abs(y1 - y2) > 3;

              return (
                <g
                  key={rung.id}
                  className="cursor-pointer group/rung"
                  onClick={(e) => {
                    e.stopPropagation();
                    sound.playRungRemove();
                    onToggleRung(rung.col, rung.yRatio, rung.y2Ratio);
                  }}
                >
                  {/* Hit target for easy clicking to remove */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="18"
                  />
                  {/* Main rung line */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isDiagonal ? '#6366F1' : '#475569'}
                    strokeWidth={isDiagonal ? '4.5' : '4'}
                    strokeLinecap="round"
                    className="transition-colors group-hover/rung:stroke-rose-500"
                  />
                  {/* If diagonal, highlight with inner shine and accent center */}
                  {isDiagonal && (
                    <>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#C7D2FE"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      <circle
                        cx={(x1 + x2) / 2}
                        cy={(y1 + y2) / 2}
                        r="2.5"
                        fill="#EEF2FF"
                        className="group-hover/rung:fill-rose-300"
                      />
                    </>
                  )}
                  {/* Decorative joints */}
                  <circle
                    cx={x1}
                    cy={y1}
                    r={isDiagonal ? 4 : 3}
                    fill={isDiagonal ? '#4338CA' : '#334155'}
                    className="group-hover/rung:fill-rose-500 transition-colors"
                  />
                  <circle
                    cx={x2}
                    cy={y2}
                    r={isDiagonal ? 4 : 3}
                    fill={isDiagonal ? '#4338CA' : '#334155'}
                    className="group-hover/rung:fill-rose-500 transition-colors"
                  />
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
                  y2={getYPos(hoverRung.y2Ratio)}
                  stroke={hoverRung.isDiagonal ? '#6366F1' : '#F59E0B'}
                  strokeWidth="3.5"
                  strokeDasharray="4 4"
                  opacity="0.85"
                />
                <circle
                  cx={getColX(hoverRung.col)}
                  cy={getYPos(hoverRung.yRatio)}
                  r="3.5"
                  fill={hoverRung.isDiagonal ? '#6366F1' : '#F59E0B'}
                />
                <circle
                  cx={getColX(hoverRung.col + 1)}
                  cy={getYPos(hoverRung.y2Ratio)}
                  r="3.5"
                  fill={hoverRung.isDiagonal ? '#6366F1' : '#F59E0B'}
                />
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

          {/* ================= THEATRICAL STAGE CURTAIN ================= */}
          {/* Left Curtain Drape (Slides to left) */}
          <div
            className={`absolute top-0 bottom-0 left-0 w-1/2 z-20 transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-auto ${
              isLadderHidden ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{
              background: 'repeating-linear-gradient(90deg, #881337 0px, #9f1239 14px, #be123c 28px, #e11d48 42px, #9f1239 56px, #881337 70px)',
              boxShadow: 'inset -14px 0 24px rgba(0,0,0,0.5), 6px 0 16px rgba(0,0,0,0.3)',
            }}
          >
            {/* Shadow depth & velvet texture */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/45" />
            {/* Center golden seam trim */}
            <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 shadow-md" />
            {/* Bottom Golden Fringe */}
            <div className="absolute bottom-0 left-0 right-0 h-3.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 border-t border-amber-200/90 shadow-md flex items-center justify-around overflow-hidden">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="w-1 h-3.5 bg-amber-700/60" />
              ))}
            </div>
          </div>

          {/* Right Curtain Drape (Slides to right) */}
          <div
            className={`absolute top-0 bottom-0 right-0 w-1/2 z-20 transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-auto ${
              isLadderHidden ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={{
              background: 'repeating-linear-gradient(90deg, #881337 0px, #9f1239 14px, #be123c 28px, #e11d48 42px, #9f1239 56px, #881337 70px)',
              boxShadow: 'inset 14px 0 24px rgba(0,0,0,0.5), -6px 0 16px rgba(0,0,0,0.3)',
            }}
          >
            {/* Shadow depth & velvet texture */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/45" />
            {/* Center golden seam trim */}
            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 shadow-md" />
            {/* Bottom Golden Fringe */}
            <div className="absolute bottom-0 left-0 right-0 h-3.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 border-t border-amber-200/90 shadow-md flex items-center justify-around overflow-hidden">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="w-1 h-3.5 bg-amber-700/60" />
              ))}
            </div>
          </div>

          {/* Top Drapery Valance (Pelmet banner) */}
          <div
            className={`absolute top-0 left-0 right-0 h-8 z-25 transition-opacity duration-500 pointer-events-none flex items-center justify-between px-4 bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 border-b-2 border-amber-400 shadow-lg ${
              isLadderHidden ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-black text-amber-300 tracking-wide">
              <span>🎭</span>
              <span>사다리 블라인드</span>
            </div>
            <span className="text-[11px] text-amber-200/90 hidden sm:inline font-medium">
              사다리 경로가 가려져 있습니다
            </span>
          </div>

          {/* Center Interactive Reveal Button Plaque */}
          <div
            className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-4 transition-all duration-500 ${
              isLadderHidden ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <button
              onClick={() => {
                sound.playCurtain(true);
                onToggleLadderCurtain();
              }}
              className="group flex flex-col items-center gap-2.5 bg-slate-950/85 hover:bg-slate-900 text-amber-100 border-2 border-amber-400/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-rose-950/40"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                <Eye className="w-6 h-6" />
              </div>
              <div className="text-center">
                <div className="text-sm sm:text-base font-extrabold text-amber-300 tracking-tight">
                  사다리가 가려져 있습니다
                </div>
                <div className="text-[11px] text-amber-200/80 mt-0.5">
                  참가자를 모두 고른 후 <strong className="text-white underline underline-offset-2">클릭하여 커튼 제끼기 🔓</strong>
                </div>
              </div>
            </button>
          </div>
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
