import { describe, expect, it } from 'vitest';
import * as snapshots from '../apps/web/src/creator/history';
import { createHistory, commitHistory, undoHistory, redoHistory } from '../apps/web/src/creator/history';

describe('creator document snapshots', () => {
  it('ends a whole gesture as one undo and cancels back to its baseline', () => {
    let history = snapshots.beginGesture(createHistory({ x: 0 }));
    for (const x of [10, 20, 50]) history = commitHistory(history, { x });
    history = snapshots.endGesture(history);
    expect(history.past).toHaveLength(1);
    expect(undoHistory(history).present).toEqual({ x: 0 });
    expect(redoHistory(undoHistory(history)).present).toEqual({ x: 50 });
    history = snapshots.beginGesture(history);
    history = commitHistory(history, { x: 90 });
    history = snapshots.cancelGesture(history);
    expect(history.present).toEqual({ x: 50 });
    expect(history.past).toHaveLength(1);
  });
  it('keeps pointer-move previews out of the undo stack', () => {
    const initial = { x: 20, y: 10 };
    let history: ReturnType<typeof createHistory<typeof initial>> = { ...createHistory(initial), gesture: initial };
    history = commitHistory(history, { x: 30, y: 20 });
    history = commitHistory(history, { x: 70, y: 60 });
    expect(history.present).toEqual({ x: 70, y: 60 });
    expect(history.past).toHaveLength(0);
    expect(history.gesture).toEqual(initial);
  });
  it('undoes actual document changes and clears redo after a new branch', () => {
    const initial = { layers: [{ x: 20 }] };
    let history = createHistory(initial);
    history = commitHistory(history, { layers: [{ x: 80 }] });
    expect(history.present.layers[0].x).toBe(80);
    history = undoHistory(history);
    expect(history.present).toEqual(initial);
    history = redoHistory(history);
    expect(history.present.layers[0].x).toBe(80);
    history = commitHistory(undoHistory(history), { layers: [{ x: 45 }] });
    expect(redoHistory(history).present.layers[0].x).toBe(45);
    expect(history.future).toHaveLength(0);
  });
});
