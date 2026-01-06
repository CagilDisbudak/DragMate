import React from 'react';
import { useOkeyGame } from '../../hooks/useOkeyGame';
import { OkeyBoard } from '../OkeyBoard/OkeyBoard';
import { LogOut } from 'lucide-react';

interface OkeyGameProps {
    roomId: string;
    mode: 'local' | 'online';
    aiDifficulty: 'Easy' | 'Normal' | 'Hard';
    onExit: () => void;
}

export const OkeyGame: React.FC<OkeyGameProps> = ({ roomId, mode, aiDifficulty, onExit }) => {
    const {
        gameState,
        drawFromCenter,
        drawFromDiscard,
        moveTileInRack,
        discardTile,
        autoSortTiles,
        finishGame,
        resetGame,
        reshuffleDiscards,
        endInTie
    } = useOkeyGame(roomId);

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] fade-in animate-in duration-700">
            <div className="w-full max-w-6xl mb-6 flex justify-between items-center text-white px-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onExit}
                        className="p-3 bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700 hover:border-red-500/50"
                        title="Leave Game"
                    >
                        <LogOut size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Okey Arena</h2>
                        <div className="text-xs font-medium text-emerald-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {mode === 'online' ? `Room: ${roomId}` : `Local • ${aiDifficulty} AI`}
                        </div>
                    </div>
                </div>
            </div>

            <OkeyBoard
                gameState={gameState}
                onDraw={drawFromCenter}
                onDrawDiscard={drawFromDiscard}
                onMoveTile={moveTileInRack}
                onDiscard={discardTile}
                onAutoSort={autoSortTiles}
                onFinish={finishGame}
                onReset={resetGame}
                onReshuffle={reshuffleDiscards}
                onEndTie={endInTie}
                onExit={onExit}
            />

            <footer className="text-slate-600 font-bold uppercase tracking-[0.4em] text-[10px] pt-10 flex flex-col items-center gap-1">
                <span>Transparent Strategy Arena</span>
                <span className="text-slate-700 text-[8px]">v0.1.0</span>
            </footer>
        </div>
    );
};
