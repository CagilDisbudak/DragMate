/**
 * Registry of authoritative game modules. Games are added here as they are
 * migrated off Firebase. Until a game appears here the server rejects it
 * (and the client keeps using the legacy Firebase path for that game).
 */
import type { GameType } from '../types.js';
import type { GameModule } from './GameModule.js';
import { chessModule } from './chess.js';

const modules: Partial<Record<GameType, GameModule>> = {
  chess: chessModule,
  // backgammon: (phase 2)
  // okey / 101: (phase 3)
};

export function getModule(gameType: GameType): GameModule | undefined {
  return modules[gameType];
}

export function isSupported(gameType: GameType): boolean {
  return gameType in modules;
}

export function supportedGames(): GameType[] {
  return Object.keys(modules) as GameType[];
}
