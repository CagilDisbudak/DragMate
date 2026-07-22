import React from 'react';
import type { OkeyTile as OkeyTileType } from '../../logic/okeyLogic';

interface OkeyTileProps {
  tile: OkeyTileType;
  okeyTile?: OkeyTileType | null;
  isJoker?: boolean;
  className?: string;
  dragging?: boolean;
  /** 'fit' fills the parent (used by rack slots so tiles scale with the slot). */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'fit';
}

// Numeral gradients per tile color (painted on ivory)
const NUMERAL_GRADIENTS: Record<string, string> = {
  red: 'from-red-500 via-red-600 to-red-800',
  black: 'from-slate-600 via-slate-800 to-slate-950',
  blue: 'from-blue-500 via-blue-600 to-blue-900',
  yellow: 'from-amber-400 via-amber-500 to-amber-600',
};

const DOT_COLORS: Record<string, string> = {
  red: 'bg-red-600',
  black: 'bg-slate-900',
  blue: 'bg-blue-600',
  yellow: 'bg-amber-500',
};

export const OkeyTile: React.FC<OkeyTileProps> = React.memo(({ tile, okeyTile, isJoker, className = '', dragging = false, size = 'md' }) => {
  const dims = size === 'fit' ? 'w-full h-full rounded-lg' : size === 'xs' ? 'w-8 h-11 rounded-md' : size === 'sm' ? 'w-10 h-13 rounded-lg' : size === 'lg' ? 'w-16 h-22 rounded-2xl' : 'w-14 h-19 rounded-xl';
  const fontSize = size === 'fit' ? 'text-[clamp(1rem,2.9vw,2.1rem)]' : size === 'xs' ? 'text-lg' : size === 'sm' ? 'text-2xl' : size === 'lg' ? 'text-5xl' : 'text-4xl';
  const dotSize = size === 'xs' || size === 'sm' ? 'w-1.5 h-1.5' : size === 'fit' ? 'w-1.5 h-1.5 sm:w-2 sm:h-2' : 'w-2 h-2';

  const isFake = !!tile.isFakeOkey;
  // Real Okey check (the tile currently acting as the joker for this round)
  const isRealOkey = !isFake && !!okeyTile && tile.color === okeyTile.color && tile.value === okeyTile.value;
  const showOkeyGlow = isRealOkey || (!!isJoker && !isFake);

  const renderContent = () => {
    // Fake Okey ("Sahte Okey") — clover motif
    if (isFake) {
      const jokerSize = size === 'fit' ? 'w-5 h-5 sm:w-7 sm:h-7' : size === 'xs' ? 'w-5 h-5' : size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
      const cloverSize = size === 'fit' ? 'text-xs sm:text-base' : size === 'xs' ? 'text-[10px]' : size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-2xl' : 'text-lg';
      const textSize = size === 'fit' ? 'text-[6px] sm:text-[9px]' : size === 'xs' ? 'text-[6px]' : size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-sm' : 'text-[10px]';

      return (
        <div className="flex flex-col items-center justify-center gap-0.5">
          <div className={`${jokerSize} rounded-full border-2 border-emerald-500/80 bg-linear-to-br from-emerald-50 to-emerald-200 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_1px_3px_rgba(6,95,70,0.35)]`}>
            <span className={`${cloverSize} leading-none text-emerald-600 drop-shadow-sm`}>☘</span>
          </div>
          <span className={`${textSize} font-black text-emerald-700 tracking-tight uppercase`}>JOKER</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center leading-none">
        <span className={`${fontSize} font-display font-bold tracking-tighter text-transparent bg-clip-text bg-linear-to-b ${tile.color ? NUMERAL_GRADIENTS[tile.color] : 'from-slate-400 to-slate-500'} drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]`}>
          {tile.value}
        </span>
        <div className={`${dotSize} rounded-full mt-1 ${tile.color ? DOT_COLORS[tile.color] : 'bg-slate-400'} shadow-[inset_0_-1px_1px_rgba(0,0,0,0.35),0_1px_1px_rgba(255,255,255,0.5)]`} />
      </div>
    );
  };

  // Use inline styles for dragging state for better performance
  const tileStyle: React.CSSProperties = dragging ? {
    opacity: 0.95,
    transform: 'scale(1.1) rotate(-2deg)',
    zIndex: 50,
    willChange: 'transform',
    cursor: 'grabbing',
    boxShadow: '0 12px 24px rgba(0,0,0,0.45)',
  } : {};

  return (
    <div
      className={`
        relative ${dims}
        tile-ivory
        flex items-center justify-center
        select-none
        ${!dragging ? 'anim-deal-in' : ''}
        ${className}
      `}
      style={tileStyle}
    >
      {/* Tile surface polish */}
      <div className="absolute inset-[2px] rounded-[inherit] bg-linear-to-br from-white to-transparent opacity-50 pointer-events-none" />

      {/* Okey glow ring (the round's joker tile) */}
      {showOkeyGlow && (
        <div className="absolute -inset-px rounded-[inherit] ring-2 ring-amber-400/90 shadow-[0_0_16px_rgba(251,191,36,0.6)] pointer-events-none" />
      )}
      {/* Fake Okey emerald ring */}
      {isFake && (
        <div className="absolute -inset-px rounded-[inherit] ring-2 ring-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.5)] pointer-events-none" />
      )}

      {/* Okey star badge */}
      {showOkeyGlow && (
        <div className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full bg-linear-to-br from-amber-300 to-amber-500 border border-amber-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.45)] flex items-center justify-center text-[8px] leading-none text-amber-950">
          ★
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full pb-0.5">
        {renderContent()}
      </div>
    </div>
  );
});
