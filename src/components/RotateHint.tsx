import React from 'react';
import { Smartphone } from 'lucide-react';

/** Wide card tables read best in landscape; nudge portrait phone users once. */
export const RotateHint: React.FC = () => (
    <div className="hidden max-md:portrait:flex shrink-0 items-center justify-center gap-2 px-4 pb-4 text-xs font-semibold text-zinc-400">
        <Smartphone size={14} className="rotate-90 text-zinc-500" aria-hidden />
        Daha büyük masa için telefonu yatay çevirin
    </div>
);
