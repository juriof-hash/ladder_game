import { LadderRung, Point, LadderPath, LadderDensity } from '../types';

/**
 * Generates random horizontal rungs for N columns.
 * Amidakuji standard rules:
 * - A rung connects column c and c+1 at relative height yRatio (between 0.08 and 0.92).
 * - On the same column c, rungs must maintain a minimum vertical gap.
 * - At any column c, a left bridge (c-1, c) and a right bridge (c, c+1) should not be at the exact same y,
 *   to avoid ambiguous choices.
 */
export function generateLadderRungs(
  columnCount: number,
  density: LadderDensity = 'normal'
): LadderRung[] {
  const rungs: LadderRung[] = [];
  if (columnCount < 2) return rungs;

  const gapsCount = columnCount - 1;
  // Determine target rungs per gap
  const rungsPerGap = density === 'simple' ? 2 : density === 'normal' ? 3.5 : 5;
  const totalRungsTarget = Math.round(gapsCount * rungsPerGap);

  // Divide the vertical space (0.08 to 0.92) into discrete slots to ensure well-spaced bridges
  const numSlots = Math.max(8, Math.round(rungsPerGap * 3.5));
  const slotHeight = (0.92 - 0.08) / numSlots;

  // Track used slot heights per column to prevent collisions
  // columnOccupation[c] stores slot indices used on column c (either left or right)
  const colOccupied = Array.from({ length: columnCount }, () => new Set<number>());

  // Guarantee at least 1 or 2 bridges per column gap so no player just drops straight without crossing
  for (let gap = 0; gap < gapsCount; gap++) {
    const minGuaranteed = density === 'simple' ? 1 : 2;
    const availableSlots = Array.from({ length: numSlots }, (_, i) => i).filter(
      slot => !colOccupied[gap].has(slot) && !colOccupied[gap + 1].has(slot)
    );

    // Shuffle and pick
    availableSlots.sort(() => Math.random() - 0.5);
    const pickCount = Math.min(minGuaranteed, availableSlots.length);
    for (let i = 0; i < pickCount; i++) {
      const slot = availableSlots[i];
      colOccupied[gap].add(slot);
      colOccupied[gap + 1].add(slot);

      // Add a slight jitter within slot
      const jitter = (Math.random() - 0.5) * 0.4;
      const yRatio = 0.08 + (slot + 0.5 + jitter) * slotHeight;
      rungs.push({
        id: `rung-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
        col: gap,
        yRatio: Math.min(0.92, Math.max(0.08, yRatio)),
      });
    }
  }

  // Add additional random rungs up to target
  let attempts = 0;
  while (rungs.length < totalRungsTarget && attempts < 150) {
    attempts++;
    const gap = Math.floor(Math.random() * gapsCount);
    const slot = Math.floor(Math.random() * numSlots);

    // Ensure not adjacent collision
    if (
      !colOccupied[gap].has(slot) &&
      !colOccupied[gap + 1].has(slot) &&
      !colOccupied[gap].has(slot - 1) &&
      !colOccupied[gap + 1].has(slot - 1)
    ) {
      colOccupied[gap].add(slot);
      colOccupied[gap + 1].add(slot);

      const jitter = (Math.random() - 0.5) * 0.4;
      const yRatio = 0.08 + (slot + 0.5 + jitter) * slotHeight;
      rungs.push({
        id: `rung-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
        col: gap,
        yRatio: Math.min(0.92, Math.max(0.08, yRatio)),
      });
    }
  }

  // Sort rungs by yRatio ascending
  rungs.sort((a, b) => a.yRatio - b.yRatio);
  return rungs;
}

/**
 * Calculates the exact discrete traversal path for a player starting at column `startCol`.
 * Returns waypoints where the player moves down and across bridges.
 */
export function calculatePlayerPath(
  startCol: number,
  rungs: LadderRung[],
  totalColumns: number,
  canvasWidth: number,
  canvasHeight: number,
  paddingX = 40,
  paddingY = 40
): LadderPath {
  const colSpacing = totalColumns > 1 ? (canvasWidth - paddingX * 2) / (totalColumns - 1) : 0;
  const usableHeight = canvasHeight - paddingY * 2;

  const getX = (col: number) => paddingX + col * colSpacing;
  const getY = (yRatio: number) => paddingY + yRatio * usableHeight;

  let currentCol = startCol;
  let currentYRatio = 0;

  const points: Point[] = [
    { x: getX(currentCol), y: getY(0) } // Start at top of column
  ];

  // Sort rungs from top to bottom
  const sortedRungs = [...rungs].sort((a, b) => a.yRatio - b.yRatio);

  for (const rung of sortedRungs) {
    if (rung.yRatio <= currentYRatio) continue;

    // Does this rung connect to our current column?
    // Case 1: Rung goes from currentCol to currentCol + 1
    if (rung.col === currentCol) {
      // Move straight down to rung height
      points.push({ x: getX(currentCol), y: getY(rung.yRatio) });
      // Move horizontally right
      currentCol = currentCol + 1;
      points.push({ x: getX(currentCol), y: getY(rung.yRatio) });
      currentYRatio = rung.yRatio;
    }
    // Case 2: Rung goes from currentCol - 1 to currentCol
    else if (rung.col === currentCol - 1) {
      // Move straight down to rung height
      points.push({ x: getX(currentCol), y: getY(rung.yRatio) });
      // Move horizontally left
      currentCol = currentCol - 1;
      points.push({ x: getX(currentCol), y: getY(rung.yRatio) });
      currentYRatio = rung.yRatio;
    }
  }

  // Finally, move straight down to bottom (yRatio = 1)
  points.push({ x: getX(currentCol), y: getY(1) });

  return {
    playerId: `player-${startCol}`,
    points,
    endCol: currentCol,
  };
}

/**
 * Solves all end columns for all players at once.
 */
export function solveAllEndColumns(columnCount: number, rungs: LadderRung[]): number[] {
  const sortedRungs = [...rungs].sort((a, b) => a.yRatio - b.yRatio);
  const mapping: number[] = Array.from({ length: columnCount }, (_, i) => i);

  for (const rung of sortedRungs) {
    const c = rung.col;
    // Swap the elements at column c and c + 1
    const idxA = mapping.indexOf(c);
    const idxB = mapping.indexOf(c + 1);
    if (idxA !== -1 && idxB !== -1) {
      mapping[idxA] = c + 1;
      mapping[idxB] = c;
    }
  }

  return mapping;
}

/**
 * Formats points into an SVG path d-string
 */
export function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  return points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');
}

/**
 * Calculates total polyline length and intermediate segment lengths
 */
export function calculatePathLengths(points: Point[]): { totalLength: number; segmentLengths: number[] } {
  let totalLength = 0;
  const segmentLengths: number[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(len);
    totalLength += len;
  }

  return { totalLength, segmentLengths };
}
