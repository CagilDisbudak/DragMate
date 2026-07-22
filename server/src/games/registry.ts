/**
 * Registry of authoritative game modules. Games are added here as they are
 * migrated off Firebase. Until a game appears here the server rejects it
 * (and the client keeps using the legacy Firebase path for that game).
 */
import type { GameType } from '../types.js';
import type { GameModule } from './GameModule.js';
import { chessModule } from './chess.js';
import { backgammonModule } from './backgammon.js';
import { okeyModule } from './okey.js';
import { game101Module } from './game101.js';

const modules: Partial<Record<GameType, GameModule>> = {
  chess: chessModule,
  backgammon: backgammonModule,
  okey: okeyModule,
  '101': game101Module,
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
