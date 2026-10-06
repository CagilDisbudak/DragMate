import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';

/**
 * Renders its child at a virtual "design resolution" and uniformly scales it
 * to fill the available box — the way game engines letterbox a fixed canvas.
 *
 * Scaling uses CSS `zoom`, not `transform: scale()`: zoom re-lays out at the
 * final size, so text, borders and tile numerals are rasterized crisply at any
 * scale (a transformed layer is painted at design size and resampled, which
 * blurs, especially on HiDPI screens and while layers are animating).
 * getBoundingClientRect() and hit-testing report zoomed coordinates, so dnd-kit
 * collision detection keeps working.
 *
 * The design size adapts to the box's aspect ratio (within the given bounds),
 * so on typical screens the table fills the box edge to edge, and the scale
 * depends only on the box size, never on content — the table does not jump
 * when a banner or selection bar appears.
 *
 * Only safe for content whose drag previews render through a portaled
 * <DragOverlay>: in-place dnd-kit transforms would move at `scale` × pointer
 * speed. Wrap portaled previews in <StageScaled>.
 *
 * Container queries (@sm:, @3xl:) inside still resolve against the unzoomed
 * design width.
 */

const StageScaleContext = createContext(1);

/** Current FitStage scale (1 outside a stage). */
const useStageScale = () => useContext(StageScaleContext);

interface FitStageProps {
    /** Narrowest / widest design width in CSS px. */
    minWidth: number;
    maxWidth: number;
    /** Shortest / tallest design height in CSS px. */
    minHeight: number;
    maxHeight: number;
    /** Upper bound on the scale factor (avoids blurry giant tiles on 4K). */
    maxScale?: number;
    className?: string;
    children: React.ReactNode;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const FitStage: React.FC<FitStageProps> = ({
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    maxScale = 1.6,
    className = '',
    children,
}) => {
    const boxRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState<{ w: number; h: number } | null>(null);

    useLayoutEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    let designW = minWidth;
    let designH = minHeight;
    let scale = 1;
    if (box && box.w > 0 && box.h > 0) {
        designW = clamp(box.w, minWidth, maxWidth);
        // Match the box's aspect ratio so the stage fills it, within bounds.
        designH = Math.round(clamp(designW * (box.h / box.w), minHeight, maxHeight));
        scale = Math.min(box.w / designW, box.h / designH, maxScale);
    }

    return (
        <div ref={boxRef} className={`relative w-full h-full min-h-0 overflow-hidden flex items-center justify-center ${className}`}>
            {box && (
                <div
                    className="@container shrink-0"
                    style={{ width: designW, height: designH, zoom: scale }}
                >
                    <StageScaleContext.Provider value={scale}>{children}</StageScaleContext.Provider>
                </div>
            )}
        </div>
    );
};

/** Wraps a portaled drag preview so it matches the on-stage size. */
export const StageScaled: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const scale = useStageScale();
    if (scale === 1) return <>{children}</>;
    return <div style={{ zoom: scale }}>{children}</div>;
};
