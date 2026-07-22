import React from 'react';

/** Inline SVG fractal noise — no external requests, works offline. */
const NOISE_URI =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export const Background: React.FC = () => {
    return (
        <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-[#020617]">
            {/* Aurora layers — indigo core, violet drift, teal + rose glints */}
            <div className="bg-blob opacity-30 w-[900px] h-[900px] -top-96 -left-96 bg-indigo-500 blur-[130px]" />
            <div
                className="bg-blob opacity-25 w-[680px] h-[680px] top-1/2 -right-56 bg-violet-600 blur-[110px]"
                style={{ animationDelay: '-5s', animationDuration: '26s' }}
            />
            <div
                className="bg-blob opacity-15 w-[540px] h-[540px] bottom-0 left-1/4 bg-teal-400 blur-[95px]"
                style={{ animationDelay: '-12s', animationDuration: '19s' }}
            />
            <div
                className="bg-blob opacity-[0.12] w-[420px] h-[420px] top-24 left-[55%] bg-rose-500 blur-[100px]"
                style={{ animationDelay: '-8s', animationDuration: '30s' }}
            />

            {/* Vignette: keeps play areas readable */}
            <div className="absolute inset-0 bg-radial-at-t from-transparent via-slate-950/40 to-slate-950" />

            {/* Fine grain for a premium finish */}
            <div
                className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
                style={{ backgroundImage: `url("${NOISE_URI}")` }}
            />
        </div>
    );
};
