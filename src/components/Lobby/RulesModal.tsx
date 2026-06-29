import React, { useEffect } from 'react';
import { X, Trophy, Dices, LayoutGrid, Hash, Target, Lightbulb } from 'lucide-react';
import { GAME_RULES } from '../../data/gameRules';
import type { GameKey, RuleAccent } from '../../data/gameRules';

interface RulesModalProps {
    gameType: GameKey | null;
    onClose: () => void;
}

// Static accent class maps (kept literal so Tailwind includes them in the build).
const ACCENT: Record<RuleAccent, {
    text: string;
    bullet: string;
    iconBg: string;
    chip: string;
    headerGlow: string;
    objectiveBox: string;
    tipBox: string;
}> = {
    indigo: {
        text: 'text-indigo-300',
        bullet: 'bg-indigo-400',
        iconBg: 'bg-indigo-500/15 text-indigo-300',
        chip: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
        headerGlow: 'shadow-indigo-500/20',
        objectiveBox: 'bg-indigo-500/10 border-indigo-500/30',
        tipBox: 'bg-indigo-500/5 border-indigo-500/20',
    },
    emerald: {
        text: 'text-emerald-300',
        bullet: 'bg-emerald-400',
        iconBg: 'bg-emerald-500/15 text-emerald-300',
        chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        headerGlow: 'shadow-emerald-500/20',
        objectiveBox: 'bg-emerald-500/10 border-emerald-500/30',
        tipBox: 'bg-emerald-500/5 border-emerald-500/20',
    },
    amber: {
        text: 'text-amber-300',
        bullet: 'bg-amber-400',
        iconBg: 'bg-amber-500/15 text-amber-300',
        chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        headerGlow: 'shadow-amber-500/20',
        objectiveBox: 'bg-amber-500/10 border-amber-500/30',
        tipBox: 'bg-amber-500/5 border-amber-500/20',
    },
    rose: {
        text: 'text-rose-300',
        bullet: 'bg-rose-400',
        iconBg: 'bg-rose-500/15 text-rose-300',
        chip: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
        headerGlow: 'shadow-rose-500/20',
        objectiveBox: 'bg-rose-500/10 border-rose-500/30',
        tipBox: 'bg-rose-500/5 border-rose-500/20',
    },
};

const GAME_ICON: Record<GameKey, React.ReactNode> = {
    chess: <Trophy size={22} />,
    backgammon: <Dices size={22} />,
    okey: <LayoutGrid size={22} />,
    '101': <Hash size={22} />,
};

export const RulesModal: React.FC<RulesModalProps> = ({ gameType, onClose }) => {
    // Close on ESC
    useEffect(() => {
        if (!gameType) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [gameType, onClose]);

    if (!gameType) return null;

    const rules = GAME_RULES[gameType];
    const a = ACCENT[rules.accent];

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className={`liquid-glass relative w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl ${a.headerGlow} animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start gap-4 p-6 pb-4 border-b border-white/10">
                    <div className={`shrink-0 p-3 rounded-2xl ${a.iconBg}`}>{GAME_ICON[gameType]}</div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-black text-white tracking-tight">{rules.title}</h2>
                        <p className="text-sm text-slate-400 font-medium mt-0.5">{rules.tagline}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Kapat"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-5">
                    {/* Objective */}
                    <div className={`flex gap-3 p-4 rounded-2xl border ${a.objectiveBox}`}>
                        <Target size={18} className={`shrink-0 mt-0.5 ${a.text}`} />
                        <div>
                            <div className={`text-[11px] font-black uppercase tracking-wider ${a.text}`}>Amaç</div>
                            <p className="text-sm text-slate-200 font-medium mt-1 leading-relaxed">{rules.objective}</p>
                        </div>
                    </div>

                    {/* Sections */}
                    {rules.sections.map((section) => (
                        <div key={section.heading}>
                            <h3 className="text-sm font-black uppercase tracking-wider text-white mb-2">
                                {section.heading}
                            </h3>
                            <ul className="space-y-2">
                                {section.items.map((item, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-slate-300 leading-relaxed">
                                        <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${a.bullet}`} />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Tips */}
                    {rules.tips.length > 0 && (
                        <div className={`p-4 rounded-2xl border ${a.tipBox}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb size={16} className={a.text} />
                                <span className={`text-[11px] font-black uppercase tracking-wider ${a.text}`}>İpuçları</span>
                            </div>
                            <ul className="space-y-1.5">
                                {rules.tips.map((tip, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-slate-300 leading-relaxed">
                                        <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${a.bullet}`} />
                                        <span>{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-colors"
                    >
                        Anladım
                    </button>
                </div>
            </div>
        </div>
    );
};
