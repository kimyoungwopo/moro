// packages/document-core/src/index.ts
var LIMITS = { bytes: 2 * 1024 * 1024, nodes: 1e5, depth: 64, frames: 18e3, dimension: 8192 };
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var validHex = (v) => /^#[0-9a-f]{6}$/i.test(v);
var toHex = (rgb) => "#" + rgb.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
var num = (v, label) => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Invalid ${label}.`);
  return v;
};
function parseDocument(bytes, name) {
  if (bytes.length > LIMITS.bytes) throw new Error("File exceeds the 2 MB limit.");
  let root, text = "";
  if (!bytes.length) throw new Error("This file is empty. Choose another JSON file.");
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    root = JSON.parse(text);
  } catch (error) {
    const position = error instanceof Error ? /position (\d+)/.exec(error.message) : null;
    const offset = position ? Number(position[1]) : null;
    const line = offset === null ? "" : ` Near line ${text.slice(0, offset).split("\n").length}, column ${offset - text.lastIndexOf("\n", offset - 1)}.`;
    throw new Error(`Could not read this JSON.${line} Check its syntax and UTF-8 encoding.`, { cause: error });
  }
  if (!isObj(root) || !Array.isArray(root.layers)) throw new Error("Expected a Lottie JSON document with a layers array.");
  const width = num(root.w, "width"), height = num(root.h, "height"), fps = num(root.fr, "frame rate");
  const first = num(root.ip, "first frame"), frames = num(root.op, "last frame") - first;
  if (width <= 0 || height <= 0 || width > LIMITS.dimension || height > LIMITS.dimension || fps < 1 || fps > 240 || frames <= 0 || frames > LIMITS.frames || frames / fps > 600) throw new Error("Unsupported dimensions or timing. Limits: 8192 px, 1\u2013240 fps, 18,000 frames, 10 minutes.");
  const diagnostics = { gradients: 0, animated: 0, blocked: [], staticProperties: 0 };
  let nodes = 0;
  function scan(v, depth) {
    if (++nodes > LIMITS.nodes || depth > LIMITS.depth) throw new Error("Document exceeds the 100,000 node or 64 level complexity limit.");
    if (Array.isArray(v)) {
      v.forEach((x) => scan(x, depth + 1));
      return;
    }
    if (!isObj(v)) return;
    for (const [k, value] of Object.entries(v)) {
      if (k === "x" && typeof value === "string" && value.trim()) diagnostics.blocked.push("Expressions are not supported.");
      if (k === "fPath" && typeof value === "string" && value.trim()) diagnostics.blocked.push("External fonts are blocked.");
      scan(value, depth + 1);
    }
  }
  scan(root, 0);
  if (Array.isArray(root.assets)) for (const asset of root.assets) {
    if (!isObj(asset)) continue;
    if (typeof asset.p === "string" && asset.p && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(asset.p)) diagnostics.blocked.push("External or unsupported image assets are blocked.");
    if (typeof asset.u === "string" && asset.u) diagnostics.blocked.push("External asset paths are blocked.");
  }
  const groups = /* @__PURE__ */ new Map();
  function shapes(items, prefix) {
    items.forEach((item, index) => {
      if (!isObj(item)) return;
      const p = [...prefix, index];
      if (item.ty === "gr" && Array.isArray(item.it)) shapes(item.it, [...p, "it"]);
      if (item.ty === "gf" || item.ty === "gs") diagnostics.gradients++;
      if (item.ty !== "fl" && item.ty !== "st" || !isObj(item.c)) return;
      const c = item.c;
      if (c.a === 1) {
        diagnostics.animated++;
        return;
      }
      if (!Array.isArray(c.k) || c.k.length < 3 || c.k.length > 4 || !c.k.every((n) => typeof n === "number" && n >= 0 && n <= 1)) return;
      const rgb = c.k.slice(0, 3).map((n) => Object.is(n, -0) ? 0 : n);
      const id = JSON.stringify(rgb);
      const group = groups.get(id) ?? { id, hex: toHex(rgb), rgb, paths: [] };
      group.paths.push([...p, "c", "k"]);
      groups.set(id, group);
      diagnostics.staticProperties++;
    });
  }
  function layers(items, prefix) {
    items.forEach((layer, i) => {
      if (isObj(layer) && Array.isArray(layer.shapes)) shapes(layer.shapes, [...prefix, i, "shapes"]);
    });
  }
  layers(root.layers, ["layers"]);
  if (Array.isArray(root.assets)) root.assets.forEach((asset, i) => {
    if (isObj(asset) && Array.isArray(asset.layers)) layers(asset.layers, ["assets", i, "layers"]);
  });
  diagnostics.blocked = [...new Set(diagnostics.blocked)];
  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  }
  freeze(root);
  const retainedBytes = bytes.slice();
  return { name, get bytes() {
    return retainedBytes.slice();
  }, original: root, groups: [...groups.values()], diagnostics, width, height, fps, first, frames };
}
function recolor(doc, mapping) {
  const copy = structuredClone(doc.original);
  for (const group of doc.groups) {
    const hex = mapping[group.id];
    if (!hex || !validHex(hex) || hex.toUpperCase() === group.hex) continue;
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    for (const path of group.paths) {
      let target = copy;
      for (const key2 of path.slice(0, -1)) target = target[key2];
      const key = path[path.length - 1];
      const old = target[key];
      target[key] = old.length === 4 ? [...rgb, old[3]] : [...rgb];
    }
  }
  return copy;
}
function exportJson(doc, mapping) {
  if (doc.diagnostics.blocked.length) throw new Error("Resolve blocked assets or expressions before exporting an edited document.");
  return JSON.stringify(recolor(doc, mapping), null, 2) + "\n";
}
var outputName = (name) => (name.replace(/\.json$/i, "").replace(/\.moro$/i, "") || "animation") + ".moro.json";
var emptyHistory = () => ({ past: [], current: {}, future: [] });
function commit(history, next, doc) {
  if (JSON.stringify(history.current) === JSON.stringify(next)) return history;
  const changes = [];
  if (doc) {
    const before = recolor(doc, history.current), after = recolor(doc, next);
    for (const group of doc.groups) if (history.current[group.id] !== next[group.id]) for (const path of group.paths) {
      const at = (root) => path.reduce((value, key) => value[key], root);
      changes.push({ path: [...path], before: at(before), after: at(after) });
    }
  }
  const command = { before: history.current, after: next, changes };
  return { past: [...history.past.slice(-99), command], current: next, future: [] };
}
function setColor(mapping, group, hex) {
  if (!validHex(hex)) return mapping;
  const next = { ...mapping };
  if (hex.toUpperCase() === group.hex) delete next[group.id];
  else next[group.id] = hex.toUpperCase();
  return next;
}
var undo = (h) => h.past.length ? { past: h.past.slice(0, -1), current: h.past[h.past.length - 1].before, future: [h.past[h.past.length - 1], ...h.future] } : h;
var redo = (h) => h.future.length ? { past: [...h.past, h.future[0]], current: h.future[0].after, future: h.future.slice(1) } : h;
var LIGHT_DECLARATION = "declare module 'lottie-web/build/player/lottie_light' { export { default } from 'lottie-web'; }\n";
function reactSource(filename, settings) {
  return `import { useEffect, useRef, useState } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';
import type { AnimationItem } from 'lottie-web';
import animationData from './${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}';

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
    const start = !reduced ? ${settings.autoplay && settings.trigger === "auto"} : false;
    if (start) item.play();
    const started = () => setPlaying(true);
    const stopped = () => setPlaying(false);
    item.addEventListener('enterFrame', started);
    item.addEventListener('complete', stopped);
    return () => { item.destroy(); player.current = null; };
  }, []);
  function play() { player.current?.play(); setPlaying(true); }
  function pause() { player.current?.pause(); setPlaying(false); }
${settings.trigger === "hover" ? "  function hoverPlay() { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) play(); }" : ""}
  return <div ${settings.trigger === "hover" ? "onMouseEnter={hoverPlay} onMouseLeave={pause} onFocus={hoverPlay} onBlur={pause}" : ""}>
    <div ref={host} aria-hidden="true" style={{ width: '100%', maxWidth: 400, aspectRatio: String(animationData.w) + ' / ' + String(animationData.h) }} />
    <button type="button" aria-pressed={playing} onClick={() => playing ? pause() : play()}>
      {playing ? 'Pause animation' : 'Play animation'}
    </button>
  </div>;
}
`;
}
export {
  LIGHT_DECLARATION,
  LIMITS,
  commit,
  emptyHistory,
  exportJson,
  isObj,
  outputName,
  parseDocument,
  reactSource,
  recolor,
  redo,
  setColor,
  toHex,
  undo,
  validHex
};
