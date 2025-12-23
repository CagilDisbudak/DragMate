// Mock Firebase for demo purposes
// This file is intentionally empty - we're using localStorage instead
// See src/hooks/useGameRoom.ts for the implementation

export const db = null as any;
export const auth = null as any;

console.log('🎮 DEMO MODE: Using localStorage instead of Firebase');
console.log('💡 To enable real multiplayer, configure Firebase in this file');
