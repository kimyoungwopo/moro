import { describe, expect, it } from 'vitest';
import * as core from '../packages/creator-core/src/index';

function rectangle() { return core.addLayer(core.createProject(), 'rect'); }
function radiusShape(p: core.CreatorProject) {
  return (core.exportLottie(p).layers as unknown as { shapes: { ty: string; r?: { a: number; k: number } }[] }[])[0].shapes[0];
}

describe('static rectangle corner radius', () => {
  it('exports finite bounded rectangle radii as static Lottie rc.r without changing legacy JSON', () => {
    const p = rectangle();
    const legacy = JSON.stringify(p, null, 2) + '\n';
    expect(core.serializeProject(core.parseProject(legacy))).toBe(legacy);
    expect(p.layers[0]).not.toHaveProperty('cornerRadius');
    expect(radiusShape(p)).toMatchObject({ ty: 'rc', r: { a: 0, k: 0 } });
    for (const value of [null, 0, 0.25, 25, 50]) {
      const rounded = structuredClone(p);
      Object.assign(rounded.layers[0], { cornerRadius: value });
      expect(radiusShape(rounded)).toMatchObject({ ty: 'rc', r: { a: 0, k: value ?? 0 } });
      expect(core.parseProject(core.serializeProject(rounded))).toEqual(rounded);
    }
  });

  it('rejects negative, nonfinite, nonnumeric and oversized radii, including narrow-width bounds', () => {
    for (const value of [-1, NaN, Infinity, -Infinity, 50.001, '5', {}, [], true]) {
      const p = rectangle();
      Object.assign(p.layers[0], { cornerRadius: value });
      expect(() => core.serializeProject(p)).toThrow('corner radius');
      expect(() => core.exportLottie(p)).toThrow('corner radius');
      expect(() => core.sampleLayer(p.layers[0], 0)).toThrow('corner radius');
      if (typeof value !== 'number' || Number.isFinite(value)) {
        expect(() => core.parseProject(JSON.stringify(p))).toThrow('corner radius');
      }
    }
    const narrow = rectangle();
    Object.assign(narrow.layers[0], { width: 10, height: 100, cornerRadius: 5 });
    expect(radiusShape(narrow).r?.k).toBe(5);
    Object.assign(narrow.layers[0], { cornerRadius: 5.001 });
    expect(() => core.serializeProject(narrow)).toThrow();
  });

  it('allows only absent/null/zero ellipse radii and never emits rectangle rounding for ellipses', () => {
    const ellipse = core.addLayer(core.createProject(), 'ellipse');
    expect(radiusShape(ellipse)).not.toHaveProperty('r');
    for (const value of [null, 0]) {
      const p = structuredClone(ellipse);
      Object.assign(p.layers[0], { cornerRadius: value });
      expect(core.parseProject(core.serializeProject(p))).toEqual(p);
      expect(radiusShape(p)).toMatchObject({ ty: 'el' });
      expect(radiusShape(p)).not.toHaveProperty('r');
    }
    const invalid = structuredClone(ellipse);
    Object.assign(invalid.layers[0], { cornerRadius: 0.001 });
    expect(() => core.serializeProject(invalid)).toThrow();
  });

  it('preserves radii through immutable editing, duplication, movement, keyframes and reopen', () => {
    const p = rectangle(), id = p.layers[0].id;
    const rounded = core.updateLayer(p, id, { cornerRadius: 12.5 });
    expect(p.layers[0]).not.toHaveProperty('cornerRadius');
    expect(rounded.layers[0].cornerRadius).toBe(12.5);
    const animated = core.setKeyframe(rounded, id, 'rotation', 0, 0);
    const keyed = core.setKeyframe(animated, id, 'rotation', 119, 90);
    const copy = core.duplicateLayer(keyed, id);
    expect(copy.layers.map(l => l.cornerRadius)).toEqual([12.5, 12.5]);
    const moved = core.moveLayer(copy, id, 'up');
    const edited = core.updateLayer(moved, id, { name: 'Rounded', width: 25, height: 25 });
    const reopened = core.parseProject(core.serializeProject(edited));
    expect(reopened).toEqual(edited);
    expect(radiusShape(reopened).r).toEqual({ a: 0, k: 12.5 });
    expect(core.removeKeyframe(reopened, id, 'rotation', 0).layers.every(l => l.cornerRadius === 12.5)).toBe(true);
    expect(core.removeLayer(reopened, id).layers[0].cornerRadius).toBe(12.5);
    expect(() => core.updateLayer(rounded, id, { width: 24.9 })).toThrow('corner radius');
    expect(rounded.layers[0].width).toBe(160);
    expect(core.updateLayer(rounded, id, { cornerRadius: null }).layers[0].cornerRadius).toBeNull();
    expect(radiusShape(core.updateLayer(rounded, id, { cornerRadius: 0 })).r?.k).toBe(0);
  });

  it('keeps the new field data-only, rejects unknown fields and cannot animate it', () => {
    const p = rectangle(), id = p.layers[0].id;
    let called = false;
    Object.defineProperty(p.layers[0], 'cornerRadius', { get() { called = true; return 10; }, enumerable: true });
    expect(() => core.serializeProject(p)).toThrow('accessor');
    expect(called).toBe(false);
    const valid = core.updateLayer(rectangle(), id, { cornerRadius: 10 });
    for (const bad of ['cornerRadii', 'expression', '__proto__']) {
      const q = structuredClone(valid);
      Object.defineProperty(q.layers[0], bad, { value: 1, enumerable: true });
      expect(() => core.serializeProject(q)).toThrow('layer field');
    }
    const track = structuredClone(valid);
    Object.assign(track.layers[0].tracks, { cornerRadius: [] });
    expect(() => core.serializeProject(track)).toThrow('tracks field');
    expect(() => core.setKeyframe(valid, id, 'cornerRadius' as never, 0, 10)).toThrow('property');
    const overflow = JSON.stringify(valid).replace('"cornerRadius":10', '"cornerRadius":1e400');
    expect(() => core.parseProject(overflow)).toThrow('corner radius');
  });
});
