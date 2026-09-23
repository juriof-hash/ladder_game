import { LadderRung, Point, LadderPath, LadderDensity } from '../types';

/**
 * Generates random rungs for N columns.
 * In 'complex' mode, includes diagonal (slanted ↘, ↙) and X-crossing rungs!
 * In 'simple' and 'normal' modes, generates clean horizontal bridges.
 */
export function generateLadderRungs(
  columnCount: number,
  density: LadderDensity = 'normal'
): LadderRung[] {
  const rungs: LadderRung[] = [];
  if (columnCount < 2) return rungs;

  const gapsCount = columnCount - 1;
  const isComplex = density === 'complex';

  // Number of slots for discrete vertical spacing
  const numSlots = isComplex ? 20 : density === 'normal' ? 14 : 9;
  const slotHeight = (0.92 - 0.08) / numSlots;

  // Track occupied slots for each column: colOccupied[col] = Set of slot indices
  const colOccupied = Array.from({ length: columnCount }, () => new Set<number>());

  const getSlotY = (slot: number, jitterAmount = 0.25) => {
    const jitter = (Math.random() - 0.5) * jitterAmount;
    return Math.min(0.92, Math.max(0.08, 0.08 + (slot + 0.5 + jitter) * slotHeight));
  };

  // 1. Guaranteed connections for each gap
  for (let gap = 0; gap < gapsCount; gap++) {
    const minGuaranteed = density === 'simple' ? 1 : isComplex ? 3 : 2;
    let placed = 0;
    let attempts = 0;

    while (placed < minGuaranteed && attempts < 40) {
      attempts++;
      const slot = Math.floor(Math.random() * (numSlots - 2)) + 1;

      // In complex mode, 40% chance to try a diagonal or X-cross if space allows
      const tryDiagonal = isComplex && Math.random() < 0.45;

      if (tryDiagonal && slot + 1 < numSlots) {
        // Option A: Down-Right Slant (↘)
        const canDownRight =
          !colOccupied[gap].has(slot) &&
          !colOccupied[gap].has(slot - 1) &&
          !colOccupied[gap + 1].has(slot + 1) &&
          !colOccupied[gap + 1].has(slot + 2);

        // Option B: Down-Left Slant (↙)
        const canDownLeft =
          !colOccupied[gap].has(slot + 1) &&
          !colOccupied[gap].has(slot + 2) &&
          !colOccupied[gap + 1].has(slot) &&
          !colOccupied[gap + 1].has(slot - 1);

        // Option C: X-Cross (✕)
        const canXCross =
          !colOccupied[gap].has(slot) &&
          !colOccupied[gap].has(slot + 1) &&
          !colOccupied[gap + 1].has(slot) &&
          !colOccupied[gap + 1].has(slot + 1);

        const subChoice = Math.random();

        if (subChoice < 0.35 && canXCross) {
          // Place X-cross
          colOccupied[gap].add(slot);
          colOccupied[gap].add(slot + 1);
          colOccupied[gap + 1].add(slot);
          colOccupied[gap + 1].add(slot + 1);

          const yTop = getSlotY(slot, 0.1);
          const yBottom = getSlotY(slot + 1, 0.1);

          rungs.push({
            id: `rung-x1-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
            col: gap,
            yRatio: yTop,
            y2Ratio: yBottom,
            isDiagonal: true,
          });
          rungs.push({
            id: `rung-x2-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
            col: gap,
            yRatio: yBottom,
            y2Ratio: yTop,
            isDiagonal: true,
          });
          placed += 2;
          continue;
        } else if (subChoice < 0.7 && canDownRight) {
          // Place Down-Right Slant
          colOccupied[gap].add(slot);
          colOccupied[gap + 1].add(slot + 1);

          rungs.push({
            id: `rung-dr-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
            col: gap,
            yRatio: getSlotY(slot),
            y2Ratio: getSlotY(slot + 1),
            isDiagonal: true,
          });
          placed++;
          continue;
        } else if (canDownLeft) {
          // Place Down-Left Slant
          colOccupied[gap].add(slot + 1);
          colOccupied[gap + 1].add(slot);

          rungs.push({
            id: `rung-dl-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
            col: gap,
            yRatio: getSlotY(slot + 1),
            y2Ratio: getSlotY(slot),
            isDiagonal: true,
          });
          placed++;
          continue;
        }
      }

      // Standard Horizontal Rung
      if (
        !colOccupied[gap].has(slot) &&
        !colOccupied[gap + 1].has(slot) &&
        !colOccupied[gap].has(slot - 1) &&
        !colOccupied[gap + 1].has(slot - 1)
      ) {
        colOccupied[gap].add(slot);
        colOccupied[gap + 1].add(slot);

        const y = getSlotY(slot);
        rungs.push({
          id: `rung-h-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
          col: gap,
          yRatio: y,
          y2Ratio: y,
          isDiagonal: false,
        });
        placed++;
      }
    }
  }

  // 2. Add extra rungs up to target
  const rungsPerGap = density === 'simple' ? 2 : density === 'normal' ? 3.5 : 5.2;
  const targetCount = Math.round(gapsCount * rungsPerGap);

  let extraAttempts = 0;
  while (rungs.length < targetCount && extraAttempts < 150) {
    extraAttempts++;
    const gap = Math.floor(Math.random() * gapsCount);
    const slot = Math.floor(Math.random() * (numSlots - 2)) + 1;

    // Diagonal chance in complex mode
    if (isComplex && Math.random() < 0.45 && slot + 1 < numSlots) {
      if (Math.random() < 0.5) {
        // Down-Right
        if (
          !colOccupied[gap].has(slot) &&
          !colOccupied[gap].has(slot - 1) &&
          !colOccupied[gap + 1].has(slot + 1) &&
          !colOccupied[gap + 1].has(slot + 2)
        ) {
          colOccupied[gap].add(slot);
          colOccupied[gap + 1].add(slot + 1);
          rungs.push({
            id: `rung-dr-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
            col: gap,
            yRatio: getSlotY(slot),
            y2Ratio: getSlotY(slot + 1),
            isDiagonal: true,
          });
          continue;
        }
      } else {
        // Down-Left
        if (
          !colOccupied[gap].has(slot + 1) &&
          !colOccupied[gap].has(slot + 2) &&
          !colOccupied[gap + 1].has(slot) &&
          !colOccupied[gap + 1].has(slot - 1)
        ) {
          colOccupied[gap].add(slot + 1);
          colOccupied[gap + 1].add(slot);
          rungs.push({
            id: `rung-dl-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
            col: gap,
            yRatio: getSlotY(slot + 1),
            y2Ratio: getSlotY(slot),
            isDiagonal: true,
          });
          continue;
        }
      }
    }

    // Standard horizontal
    if (
      !colOccupied[gap].has(slot) &&
      !colOccupied[gap + 1].has(slot) &&
      !colOccupied[gap].has(slot - 1) &&
      !colOccupied[gap + 1].has(slot - 1)
    ) {
      colOccupied[gap].add(slot);
      colOccupied[gap + 1].add(slot);
      const y = getSlotY(slot);
      rungs.push({
        id: `rung-h-${gap}-${slot}-${Math.random().toString(36).substring(2, 6)}`,
        col: gap,
        yRatio: y,
        y2Ratio: y,
        isDiagonal: false,
      });
    }
  }

  // Sort rungs by top-most height for predictable processing
  rungs.sort((a, b) => Math.min(a.yRatio, a.y2Ratio ?? a.yRatio) - Math.min(b.yRatio, b.y2Ratio ?? b.yRatio));
  return rungs;
}

/**
 * Calculates the exact traversal path for a player starting at column `startCol`.
 * Works seamlessly for both horizontal and diagonal/slanted rungs.
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
  let currentY = 0; // Current height ratio on currentCol

  const points: Point[] = [
    { x: getX(currentCol), y: getY(0) }, // Start at top of column
  ];

  const visitedRungs = new Set<string>();
  let steps = 0;
  const maxSteps = 250; // Safety guard against unexpected loops

  while (steps < maxSteps) {
    steps++;

    // Find all unvisited rungs touching currentCol with contact height > currentY + epsilon
    interface ContactCandidate {
      rung: LadderRung;
      contactY: number;
      destCol: number;
      destY: number;
    }

    const candidates: ContactCandidate[] = [];

    for (const rung of rungs) {
      if (visitedRungs.has(rung.id)) continue;

      const yLeft = rung.yRatio;
      const yRight = rung.y2Ratio ?? rung.yRatio;

      // Case 1: Rung is to the right of currentCol (between currentCol and currentCol + 1)
      if (rung.col === currentCol) {
        if (yLeft > currentY + 0.001) {
          candidates.push({
            rung,
            contactY: yLeft,
            destCol: currentCol + 1,
            destY: yRight,
          });
        }
      }
      // Case 2: Rung is to the left of currentCol (between currentCol - 1 and currentCol)
      else if (rung.col === currentCol - 1) {
        if (yRight > currentY + 0.001) {
          candidates.push({
            rung,
            contactY: yRight,
            destCol: currentCol - 1,
            destY: yLeft,
          });
        }
      }
    }

    // If no more rungs on this column below currentY, move straight to the bottom
    if (candidates.length === 0) {
      break;
    }

    // Pick the earliest contact point along the current column (smallest contactY)
    candidates.sort((a, b) => a.contactY - b.contactY);
    const chosen = candidates[0];

    // 1. Walk straight down currentCol to the contact junction
    points.push({ x: getX(currentCol), y: getY(chosen.contactY) });

    // 2. Cross the bridge (horizontal or diagonal) to destination
    points.push({ x: getX(chosen.destCol), y: getY(chosen.destY) });

    // 3. Mark rung visited and update runner location
    visitedRungs.add(chosen.rung.id);
    currentCol = chosen.destCol;
    currentY = chosen.destY;
  }

  // Finally, move straight down from current position to the bottom of the column (y = 1)
  points.push({ x: getX(currentCol), y: getY(1) });

  return {
    playerId: `player-${startCol}`,
    points,
    endCol: currentCol,
  };
}

/**
 * Solves all end columns for all players at once using exact path resolution.
 */
export function solveAllEndColumns(columnCount: number, rungs: LadderRung[]): number[] {
  return Array.from({ length: columnCount }, (_, col) => {
    const path = calculatePlayerPath(col, rungs, columnCount, 800, 500);
    return path.endCol;
  });
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
