export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  hasFinished: boolean;
  isTraveling: boolean;
  resultId?: string;
}

export interface LadderResult {
  id: string;
  text: string;
  isRevealed: boolean;
}

export interface LadderRung {
  id: string;
  col: number; // between col and col + 1
  yRatio: number; // 0 to 1 relative height
}

export interface Point {
  x: number;
  y: number;
}

export interface LadderPath {
  playerId: string;
  points: Point[];
  endCol: number;
}

export type LadderDensity = 'simple' | 'normal' | 'complex';

export type SpeedMode = 'slow' | 'normal' | 'fast';
