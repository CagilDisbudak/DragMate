import { pointerWithin, rectIntersection } from '@dnd-kit/core';
import type { ClientRect, Collision, CollisionDetection } from '@dnd-kit/core';

/**
 * Collision detection for the card-table boards.
 *
 * 1. The droppable under the pointer wins.
 * 2. Over a gap (or during keyboard drags, which have no pointer), the droppable
 *    the dragged tile overlaps most.
 * 3. Releasing over empty felt does nothing — the old closestCenter fallback
 *    picked the nearest zone (finish zone, discard pile) and acted on a drop
 *    nobody aimed.
 *
 * Droppables clipped out of view are ignored: dnd-kit only compares rects, so a
 * meld scrolled out of the table's meld area would otherwise still catch drops
 * aimed at whatever is drawn on top of its invisible rect.
 */
export const visibleDropCollision: CollisionDetection = (args) => {
    const notSelf = (c: Collision) => c.id !== args.active.id;
    const nodeOf = (c: Collision): HTMLElement | null =>
        args.droppableContainers.find(d => d.id === c.id)?.node.current ?? null;

    const p = args.pointerCoordinates;
    if (p) {
        const point = { left: p.x, right: p.x, top: p.y, bottom: p.y };
        const hits = pointerWithin(args).filter(c => notSelf(c) && !isClippedOut(nodeOf(c), point));
        if (hits.length > 0) return hits;
    }

    return rectIntersection(args).filter(c => {
        const node = nodeOf(c);
        return notSelf(c) && !isClippedOut(node, node?.getBoundingClientRect() ?? null);
    });
};

type Box = Pick<ClientRect, 'left' | 'right' | 'top' | 'bottom'>;

/** True when `box` lies entirely outside the visible area of some clipping ancestor of `node`. */
const isClippedOut = (node: HTMLElement | null, box: Box | null): boolean => {
    if (!node || !box) return false;
    for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const r = el.getBoundingClientRect();
        if (box.right < r.left || box.left > r.right || box.bottom < r.top || box.top > r.bottom) return true;
    }
    return false;
};
