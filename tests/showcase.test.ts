import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportJson, LIMITS, parseDocument, recolor, setColor, type Json, type Obj } from '../packages/document-core/src';

const palette = ['#1B6C80', '#D79A4E', '#DDE9EC', '#203B42', '#FFFFFF'];
const objects = (value: unknown): Obj[] => {
  if (!value || typeof value !== 'object') return [];
  return [...(Array.isArray(value) ? [] : [value as Obj]), ...Object.values(value).flatMap(objects)];
};
const at = (root: Json, path: (string | number)[]): Json => path.reduce<Json>((v, k) => (v as Obj)[k], root);
// Evaluate authored monotone temporal Beziers, not merely their endpoint extrema.
function valueAt(prop: Obj, frame: number): number[] {
  if (prop.a !== 1) return Array.isArray(prop.k) ? prop.k as number[] : [prop.k as number];
  const keys = prop.k as Obj[];
  const index = keys.findIndex((key, i) => frame >= Number(key.t) && (i === keys.length - 1 || frame < Number(keys[i + 1].t)));
  const key = keys[Math.max(0, index)], next = keys[Math.max(0, index) + 1];
  const start = key.s as number[];
  if (!next || key.h === 1) return start;
  const end = (key.e ?? next.s) as number[];
  const progress = Math.max(0, Math.min(1, (frame - Number(key.t)) / (Number(next.t) - Number(key.t))));
  const out = key.o as Obj, incoming = key.i as Obj;
  const scalar = (v: Json) => Array.isArray(v) ? Number(v[0]) : Number(v);
  const bezier = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (bezier(mid, scalar(out.x), scalar(incoming.x)) < progress) lo = mid; else hi = mid; }
  const eased = bezier((lo + hi) / 2, scalar(out.y), scalar(incoming.y));
  return start.map((n, i) => n + (end[i] - n) * eased);
}
function verifySample(id: string) {
  const bytes = readFileSync(`apps/web/public/samples/${id}.json`);
  const doc = parseDocument(bytes, `${id}.json`), root = doc.original;
  expect(doc).toMatchObject({ width: 640, height: 640, fps: 60, first: 0, frames: 240 });
  expect(bytes.length).toBeLessThan(150_000);
  expect(bytes.length).toBeLessThan(LIMITS.bytes);
  expect(doc.diagnostics).toMatchObject({ blocked: [], gradients: 0, animated: 0 });
  expect(doc.groups.map(g => g.hex).sort()).toEqual([...palette].sort());
  expect(doc.groups[0].hex).toBe('#1B6C80');
  expect(root.assets).toEqual([]);
  expect(root.fonts).toBeUndefined(); expect(root.chars).toBeUndefined();
  const all = objects(root);
  expect(all.every(o => !('x' in o && typeof o.x === 'string') && o.ty !== 5 && o.ty !== 2)).toBe(true);
  const numbers = (v: unknown): number[] => typeof v === 'number' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(numbers) : [];
  expect(numbers(root).every(Number.isFinite)).toBe(true);
  const animated = all.filter(o => o.a === 1);
  expect(animated.length).toBeGreaterThanOrEqual(6);
  for (const prop of animated) {
    const keys = prop.k as Obj[];
    expect(keys.length).toBeGreaterThan(1);
    expect(new Set(keys.map(k => JSON.stringify(k.s))).size).toBeGreaterThan(1);
    expect(keys.map(k => k.t)).toEqual(keys.map(k => Number(k.t)).sort((a, b) => a - b));
    expect(Number(keys[0].t)).toBe(0); expect(Number(keys.at(-1)?.t)).toBe(240);
    expect(keys[0].s).toEqual(keys.at(-1)?.s);
  }
  const trims = all.filter(o => o.ty === 'tm' && (o.e as Obj).a === 1);
  expect(trims.length).toBeGreaterThanOrEqual(1);
  expect(trims.some(o => (o.e as Obj).k && new Set(((o.e as Obj).k as Obj[]).map(k => JSON.stringify(k.s))).size >= 2)).toBe(true);
  const layers = root.layers as Obj[];
  expect(layers.every(l => l.ty === 4 && l.parent === undefined && l.ip === 0 && l.op === 240)).toBe(true);
  expect(layers.filter(l => ((l.ks as Obj).p as Obj).a === 1).length).toBeGreaterThanOrEqual(2);
  // All supported geometry is authored in layer-local coordinates: no hidden group transforms.
  // Bounding boxes include Bezier controls and stroke widths, at every rendered frame.
  for (const layer of layers) {
    const local: number[][] = [];
    const shapes = objects(layer.shapes);
    expect(shapes.some(o => o.ty === 'tr')).toBe(false);
    let padding = 0;
    for (const shape of shapes) {
      if (shape.ty === 'st') padding = Math.max(padding, Number((shape.w as Obj).k) / 2);
      if (shape.ty === 'rc' || shape.ty === 'el') {
        const [x, y] = (shape.p as Obj).k as number[], [w, h] = (shape.s as Obj).k as number[];
        local.push([x-w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2],[x+w/2,y-h/2]);
      }
      if (shape.ty === 'sh') {
        const path = (shape.ks as Obj).k as Obj;
        const vertices = path.v as number[][];
        vertices.forEach(([x, y], i) => { local.push([x,y]); for (const tangent of [path.i, path.o]) { const [dx,dy] = (tangent as number[][])[i]; local.push([x+dx,y+dy]); } });
      }
    }
    const ks = layer.ks as Obj;
    for (let frame = 0; frame <= 240; frame++) {
      const p = valueAt(ks.p as Obj, frame), scale = valueAt(ks.s as Obj, frame), anchor = valueAt(ks.a as Obj, frame);
      const angle = valueAt(ks.r as Obj, frame)[0] * Math.PI / 180;
      for (const [x,y] of local) {
        const xx = (x-anchor[0])*scale[0]/100, yy = (y-anchor[1])*scale[1]/100;
        const world = [p[0]+xx*Math.cos(angle)-yy*Math.sin(angle), p[1]+xx*Math.sin(angle)+yy*Math.cos(angle)];
        for (const coordinate of world) { expect(coordinate - padding, `${id}/${layer.nm} frame ${frame}`).toBeGreaterThanOrEqual(12); expect(coordinate + padding).toBeLessThanOrEqual(628); }
      }
    }
  }
  const mapping = setColor({}, doc.groups[0], '#7A365C');
  const changed = recolor(doc, mapping), expected = structuredClone(root);
  for (const path of doc.groups[0].paths) {
    let target = expected;
    for (const segment of path.slice(0,-1)) target = target[segment] as Obj;
    const old = at(root,path) as number[];
    target[path.at(-1)!] = [122/255,54/255,92/255,...old.slice(3)];
  }
  expect(changed).toEqual(expected);
  expect(recolor(doc, {})).toEqual(root);
  expect(parseDocument(new TextEncoder().encode(exportJson(doc,mapping)),id).original).toEqual(expected);
  expect(doc.bytes).toEqual(bytes);
}

describe('original editorial showcase animations', () => {
  it('places detail groups in front of opaque stocks in the Lottie paint stack',()=>{
    for(const [id,layerName,detail,stock] of [['dispatch','Hero parcel','Paper shipping label','Front panel'],['approved','Payment card','Gold chip','Teal card stock']]){
      const root=JSON.parse(readFileSync(`apps/web/public/samples/${id}.json`,'utf8')) as Obj;
      const layer=(root.layers as Obj[]).find(l=>String(l.nm).includes(layerName))!;
      const shapes=layer.shapes as Obj[];
      const detailIndex=shapes.findIndex(s=>s.nm===detail),stockIndex=shapes.findIndex(s=>s.nm===stock);
      expect(detailIndex).toBeGreaterThanOrEqual(0);
      expect(detailIndex,`${id}: first shapes paint above later opaque stocks`).toBeLessThan(stockIndex);
    }
  });
  it('dispatch ships a safe, looped, five-color parcel with real route/transform motion and exact recolor preservation', () => verifySample('dispatch'));
  it('approved choreographs a safe card/receipt and a meaningful two-leg trimmed success check', () => {
    verifySample('approved');
    const root = JSON.parse(readFileSync('apps/web/public/samples/approved.json', 'utf8')) as Obj;
    const layers = root.layers as Obj[];
    expect(layers.some(l => String(l.nm).includes('Payment card') && ((l.ks as Obj).p as Obj).a === 1)).toBe(true);
    expect(layers.some(l => String(l.nm).includes('Receipt') && ((l.ks as Obj).p as Obj).a === 1)).toBe(true);
    const check = layers.find(l => String(l.nm).includes('Success check'))!;
    expect(check).toBeDefined();
    const shapes = objects(check.shapes);
    const geometry = shapes.find(s => s.ty === 'sh')!;
    const vertices = ((geometry.ks as Obj).k as Obj).v as number[][];
    expect(vertices).toHaveLength(3);
    expect(vertices[1][0]).toBeGreaterThan(vertices[0][0]);
    expect(vertices[1][1]).toBeGreaterThan(vertices[0][1]);
    expect(vertices[2][0]).toBeGreaterThan(vertices[1][0]);
    expect(vertices[2][1]).toBeLessThan(vertices[1][1]);
    const end = shapes.find(s => s.ty === 'tm')!.e as Obj;
    expect(valueAt(end, 90)[0]).toBe(0);
    expect(valueAt(end, 110)[0]).toBeGreaterThan(10);
    expect(valueAt(end, 110)[0]).toBeLessThan(95);
    expect(valueAt(end, 136)[0]).toBe(100);
    expect(valueAt(end, 180)[0]).toBe(100);
  });
});
