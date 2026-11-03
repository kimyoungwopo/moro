export type History<T> = { past: T[]; present: T; future: T[]; gesture: T | null };
const same = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
export function createHistory<T>(present: T): History<T> {
  return { past: [], present: structuredClone(present), future: [], gesture: null };
}
export function commitHistory<T>(history: History<T>, present: T): History<T> {
  if (same(history.present, present)) return history;
  if (history.gesture !== null) return { ...history, present: structuredClone(present) };
  return { past: [...history.past, history.present].slice(-100), present: structuredClone(present), future: [], gesture: null };
}
export function beginGesture<T>(history: History<T>): History<T> {
  return history.gesture === null ? { ...history, gesture: structuredClone(history.present) } : history;
}
export function endGesture<T>(history: History<T>): History<T> {
  if (history.gesture === null) return history;
  if (same(history.gesture, history.present)) return { ...history, gesture: null };
  return { ...history, past: [...history.past, history.gesture].slice(-100), future: [], gesture: null };
}
export function cancelGesture<T>(history: History<T>): History<T> {
  return history.gesture === null ? history : { ...history, present: history.gesture, gesture: null };
}
export function undoHistory<T>(history: History<T>): History<T> {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future], gesture: null };
}
export function redoHistory<T>(history: History<T>): History<T> {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1), gesture: null };
}
