import React from 'react';
import type { OkeyTile as OkeyTileType } from '../../logic/okeyLogic';

interface OkeyTileProps {
  tile: OkeyTileType;
  okeyTile?: OkeyTileType | null;
  isJoker?: boolean;
  className?: string;
  dragging?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const OkeyTile: React.FC<OkeyTileProps> = ({ tile, okeyTile, isJoker, className = '', dragging = false, size = 'md' }) => {
  const getTextColor = (color: string | null) => {
    switch (color) {
      case 'red': return 'text-[#d32f2f]';
      case 'black': return 'text-[#212121]';
      case 'blue': return 'text-[#1976d2]';
      case 'yellow': return 'text-[#ffa000]';
      default: return 'text-slate-400';
    }
  };

  const dims = size === 'sm' ? 'w-10 h-13' : size === 'lg' ? 'w-16 h-22' : 'w-14 h-19';
  const fontSize = size === 'sm' ? 'text-2xl' : size === 'lg' ? 'text-5xl' : 'text-4xl';

  // Real Okey check
  const isRealOkey = okeyTile && tile.color === okeyTile.color && tile.value === okeyTile.value && !tile.isFakeOkey;

  const renderContent = () => {
    if (tile.isFakeOkey) {
      return (
        <div className="flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-emerald-500/20" />
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center leading-none">
        <span className={`${fontSize} font-bold ${getTextColor(tile.color)} tracking-tighter`}>
          {tile.value}
        </span>
        <div className={`w-2 h-2 rounded-full mt-1 ${tile.color === 'red' ? 'bg-red-500' : tile.color === 'blue' ? 'bg-blue-500' : tile.color === 'yellow' ? 'bg-yellow-500' : 'bg-black'} shadow-sm`} />

        {/* Real Okey Badge */}
        {isRealOkey && (
          <div className="absolute top-1 right-1">
            <div className="text-[10px] drop-shadow-sm">⭐</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`
        relative ${dims}
        bg-[#fffdfa]
        rounded-md
        shadow-[0_2px_0_#d1cfca,0_4px_8px_rgba(0,0,0,0.2)]
        flex items-center justify-center
        select-none
        border border-[#e5e3de]
        ${dragging ? 'opacity-90 cursor-grabbing scale-110 -rotate-2 z-50' : 'cursor-grab hover:-translate-y-1'}
        ${isJoker ? 'ring-4 ring-green-400/80 ring-offset-2' : ''}
        transition-all duration-200
        ${className}
      `}
    >
      {/* Tile Surface Polish */}
      <div className="absolute inset-[2px] rounded-[3px] bg-gradient-to-br from-white to-transparent opacity-50 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full pb-0.5">
        {renderContent()}
      </div>
    </div>
  );
};
