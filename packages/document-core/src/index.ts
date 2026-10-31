export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Obj = { [key: string]: Json };
export type Path = (string | number)[];
export type ColorGroup = { id: string; hex: string; rgb: number[]; paths: Path[] };
export type Diagnostics = { gradients: number; animated: number; blocked: string[]; staticProperties: number };
export type Document = { name: string; bytes: Uint8Array; original: Obj; groups: ColorGroup[]; diagnostics: Diagnostics; width: number; height: number; fps: number; first: number; frames: number };
export type Mapping = Record<string, string>;
export const LIMITS = { bytes: 2 * 1024 * 1024, nodes: 100000, depth: 64, frames: 18000, dimension: 8192 };
export const isObj = (v: Json | undefined): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
export const validHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
export const toHex = (rgb: number[]) => '#' + rgb.slice(0, 3).map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const num = (v: Json | undefined, label: string) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Invalid ${label}.`); return v; };
export function parseDocument(bytes: Uint8Array, name: string): Document {
  if (bytes.length > LIMITS.bytes) throw new Error('File exceeds the 2 MB limit.');
  let root: Json, text = '';
  if (!bytes.length) throw new Error('This file is empty. Choose another JSON file.');
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); root = JSON.parse(text) as Json; }
  catch (error) {
    const position = error instanceof Error ? /position (\d+)/.exec(error.message) : null;
    const offset = position ? Number(position[1]) : null;
    const line = offset === null ? '' : ` Near line ${text.slice(0, offset).split('\n').length}, column ${offset - text.lastIndexOf('\n', offset - 1)}.`;
    throw new Error(`Could not read this JSON.${line} Check its syntax and UTF-8 encoding.`, { cause: error });
  }
  if (!isObj(root) || !Array.isArray(root.layers)) throw new Error('Expected a Lottie JSON document with a layers array.');
  const width = num(root.w, 'width'), height = num(root.h, 'height'), fps = num(root.fr, 'frame rate');
  const first = num(root.ip, 'first frame'), frames = num(root.op, 'last frame') - first;
  if (width <= 0 || height <= 0 || width > LIMITS.dimension || height > LIMITS.dimension || fps < 1 || fps > 240 || frames <= 0 || frames > LIMITS.frames || frames / fps > 600) throw new Error('Unsupported dimensions or timing. Limits: 8192 px, 1–240 fps, 18,000 frames, 10 minutes.');
  const diagnostics: Diagnostics = { gradients: 0, animated: 0, blocked: [], staticProperties: 0 };
  let nodes = 0;
  function scan(v: Json, depth: number) {
    if (++nodes > LIMITS.nodes || depth > LIMITS.depth) throw new Error('Document exceeds the 100,000 node or 64 level complexity limit.');
    if (Array.isArray(v)) { v.forEach(x => scan(x, depth + 1)); return; }
    if (!isObj(v)) return;
    for (const [k, value] of Object.entries(v)) {
      if (k === 'x' && typeof value === 'string' && value.trim()) diagnostics.blocked.push('Expressions are not supported.');
      if (k === 'fPath' && typeof value === 'string' && value.trim()) diagnostics.blocked.push('External fonts are blocked.');
      scan(value, depth + 1);
    }
  }
  scan(root, 0);
  if (Array.isArray(root.assets)) for (const asset of root.assets) {
    if (!isObj(asset)) continue;
    if (typeof asset.p === 'string' && asset.p && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(asset.p)) diagnostics.blocked.push('External or unsupported image assets are blocked.');
    if (typeof asset.u === 'string' && asset.u) diagnostics.blocked.push('External asset paths are blocked.');
  }
  const groups = new Map<string, ColorGroup>();
  function shapes(items: Json[], prefix: Path) {
    items.forEach((item, index) => {
      if (!isObj(item)) return;
      const p = [...prefix, index];
      if (item.ty === 'gr' && Array.isArray(item.it)) shapes(item.it, [...p, 'it']);
      if (item.ty === 'gf' || item.ty === 'gs') diagnostics.gradients++;
      if ((item.ty !== 'fl' && item.ty !== 'st') || !isObj(item.c)) return;
      const c = item.c;
      if (c.a === 1) { diagnostics.animated++; return; }
      if (!Array.isArray(c.k) || c.k.length < 3 || c.k.length > 4 || !c.k.every(n => typeof n === 'number' && n >= 0 && n <= 1)) return;
      const rgb = (c.k as number[]).slice(0, 3).map(n => Object.is(n, -0) ? 0 : n);
      const id = JSON.stringify(rgb);
      const group = groups.get(id) ?? { id, hex: toHex(rgb), rgb, paths: [] };
      group.paths.push([...p, 'c', 'k']); groups.set(id, group); diagnostics.staticProperties++;
    });
  }
  function layers(items: Json[], prefix: Path) { items.forEach((layer, i) => { if (isObj(layer) && Array.isArray(layer.shapes)) shapes(layer.shapes, [...prefix, i, 'shapes']); }); }
  layers(root.layers, ['layers']);
  if (Array.isArray(root.assets)) root.assets.forEach((asset, i) => { if (isObj(asset) && Array.isArray(asset.layers)) layers(asset.layers, ['assets', i, 'layers']); });
  diagnostics.blocked = [...new Set(diagnostics.blocked)];
  function freeze(value: Json) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }
  freeze(root);
  const retainedBytes = bytes.slice();
  return { name, get bytes() { return retainedBytes.slice(); }, original: root, groups: [...groups.values()], diagnostics, width, height, fps, first, frames };
}
export function recolor(doc: Document, mapping: Mapping): Obj {
  const copy = structuredClone(doc.original);
  for (const group of doc.groups) {
    const hex = mapping[group.id];
    if (!hex || !validHex(hex) || hex.toUpperCase() === group.hex) continue;
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    for (const path of group.paths) {
      let target: Json = copy;
      for (const key of path.slice(0, -1)) target = (target as Obj)[key];
      const key = path[path.length - 1];
      const old = (target as Obj)[key] as number[];
      (target as Obj)[key] = old.length === 4 ? [...rgb, old[3]] : [...rgb];
    }
  }
  return copy;
}
export function exportJson(doc: Document, mapping: Mapping): string {
  if (doc.diagnostics.blocked.length) throw new Error('Resolve blocked assets or expressions before exporting an edited document.');
  return JSON.stringify(recolor(doc, mapping), null, 2) + '\n';
}
export const outputName = (name: string) => (name.replace(/\.json$/i, '').replace(/\.moro$/i, '') || 'animation') + '.moro.json';
export type EditCommand = { before: Mapping; after: Mapping; changes: { path: Path; before: number[]; after: number[] }[] };
export type History = { past: EditCommand[]; current: Mapping; future: EditCommand[] };
export const emptyHistory = (): History => ({ past: [], current: {}, future: [] });
export function commit(history: History, next: Mapping, doc?: Document | null): History {
  if (JSON.stringify(history.current) === JSON.stringify(next)) return history;
  const changes: EditCommand['changes'] = [];
  if (doc) {
    const before = recolor(doc, history.current), after = recolor(doc, next);
    for (const group of doc.groups) if (history.current[group.id] !== next[group.id]) for (const path of group.paths) {
      const at = (root: Json) => path.reduce<Json>((value, key) => (value as Obj)[key], root) as number[];
      changes.push({ path: [...path], before: at(before), after: at(after) });
    }
  }
  const command = { before: history.current, after: next, changes };
  return { past: [...history.past.slice(-99), command], current: next, future: [] };
}
export function setColor(mapping: Mapping, group: ColorGroup, hex: string): Mapping {
  if (!validHex(hex)) return mapping;
  const next = { ...mapping }; if (hex.toUpperCase() === group.hex) delete next[group.id]; else next[group.id] = hex.toUpperCase(); return next;
}
export const undo = (h: History): History => h.past.length ? { past: h.past.slice(0, -1), current: h.past[h.past.length - 1].before, future: [h.past[h.past.length - 1], ...h.future] } : h;
export const redo = (h: History): History => h.future.length ? { past: [...h.past, h.future[0]], current: h.future[0].after, future: h.future.slice(1) } : h;
export type Playback = { autoplay: boolean; loop: boolean; speed: number; trigger: 'auto' | 'hover' | 'click' };
export const LIGHT_DECLARATION = "declare module 'lottie-web/build/player/lottie_light' { export { default } from 'lottie-web'; }\n";
export function reactSource(filename: string, settings: Playback): string {
  return `import { useEffect, useRef, useState } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';
import type { AnimationItem } from 'lottie-web';
import animationData from './${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}';

// lottie-web 5.13.0. This document was checked by Moro before export.
export default function MoroAnimation() {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<AnimationItem | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const item = lottie.loadAnimation({ container: host.current, renderer: 'svg',
      animationData: structuredClone(animationData), loop: ${settings.loop}, autoplay: false });
    player.current = item;
    item.setSpeed(${settings.speed});
    const start = !reduced ? ${settings.autoplay && settings.trigger === 'auto'} : false;
    if (start) item.play();
    const started = () => setPlaying(true);
    const stopped = () => setPlaying(false);
    item.addEventListener('enterFrame', started);
    item.addEventListener('complete', stopped);
    return () => { item.destroy(); player.current = null; };
  }, []);
  function play() { player.current?.play(); setPlaying(true); }
  function pause() { player.current?.pause(); setPlaying(false); }
${settings.trigger === 'hover' ? "  function hoverPlay() { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) play(); }" : ''}
  return <div ${settings.trigger === 'hover' ? 'onMouseEnter={hoverPlay} onMouseLeave={pause} onFocus={hoverPlay} onBlur={pause}' : ''}>
    <div ref={host} aria-hidden="true" style={{ width: '100%', maxWidth: 400, aspectRatio: String(animationData.w) + ' / ' + String(animationData.h) }} />
    <button type="button" aria-pressed={playing} onClick={() => playing ? pause() : play()}>
      {playing ? 'Pause animation' : 'Play animation'}
    </button>
  </div>;
}
`;
}
