import React from 'react';

/** Flat canvas with a faint dot grid that fades out toward the edges. */
export const Background: React.FC = () => {
    return (
        <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-canvas">
            <div
                className="absolute inset-0 opacity-[0.5]"
                style={{
                    backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 100%)',
                }}
            />
        </div>
    );
};
