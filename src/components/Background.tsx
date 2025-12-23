import React from 'react';

export const Background: React.FC = () => {
    return (
        <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-[#020617]">
            {/* Deep Layer */}
            <div className="bg-blob opacity-20 w-[800px] h-[800px] -top-96 -left-96 bg-indigo-600 blur-[120px]" />

            {/* Mid Layer */}
            <div
                className="bg-blob opacity-30 w-[600px] h-[600px] top-1/2 -right-48 bg-pink-600 blur-[100px]"
                style={{ animationDelay: '-5s', animationDuration: '25s' }}
            />

            {/* Surface Layer */}
            <div
                className="bg-blob opacity-10 w-[500px] h-[500px] bottom-0 left-1/4 bg-cyan-400 blur-[80px]"
                style={{ animationDelay: '-12s', animationDuration: '18s' }}
            />

            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-radial-at-t from-transparent via-slate-950/40 to-slate-950" />

            {/* Noise Texture Overlay (Optional but premium) */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        </div>
    );
};
