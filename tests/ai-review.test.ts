import { describe, expect, it, vi } from 'vitest';
import * as core from '../packages/creator-core/src';
import { addLayer, createProject } from '../packages/creator-core/src';
import { reviewProject } from '../apps/web/src/creator/ai/review';

const shape = () => addLayer(createProject(), 'rect');

describe('bounded numeric proposal review', () => {
  it('reports empty projects as numeric review, not artistic approval', () => {
    const result = reviewProject(createProject());
    expect(result.structuralOnly).toBe(true);
    expect(result.warnings.map(w => w.code)).toContain('no_layers');
  });
  it('detects the observed four-shape center-coordinate clipping without claiming check recognition', () => {
    let project = createProject();
    for (const type of ['rect', 'ellipse', 'rect', 'rect'] as const) project = addLayer(project, type);
    Object.assign(project.layers[0], { x: 0, y: 0, width: 512, height: 512 });
    Object.assign(project.layers[1], { x: 112, y: 112, width: 288, height: 288 });
    Object.assign(project.layers[2], { width: 100, height: 16, rotation: 45 });
    Object.assign(project.layers[3], { width: 160, height: 16, rotation: -45 });
    const result = reviewProject(project);
    expect(result.warnings.filter(w => w.code === 'off_canvas').map(w => w.layerId)).toEqual(['layer-1', 'layer-2']);
    expect(result.warnings.every(w => !w.message.includes('checkmark'))).toBe(true);
  });
  it('includes rotated rect corners, ellipse extents, scaled stroke and visibility in bounds', () => {
    const project = shape();
    Object.assign(project.layers[0], { x: 55, y: 100, width: 100, height: 20, rotation: 45, strokeWidth: 20, scale: 100 });
    expect(reviewProject(project).warnings.some(w => w.code === 'off_canvas')).toBe(true);
    project.layers[0].type = 'ellipse';
    expect(reviewProject(project).warnings.some(w => w.code === 'off_canvas')).toBe(false);
    Object.assign(project.layers[0], { rotation: 0, x: 119, scale: 200 });
    expect(reviewProject(project).warnings.some(w => w.code === 'off_canvas')).toBe(true);
    project.layers[0].opacity = 0;
    expect(reviewProject(project).warnings.map(w => w.code)).toContain('no_visible_content');
    expect(reviewProject(project).warnings.some(w => w.code === 'off_canvas')).toBe(false);
  });
  it('samples real eased keyframes and midpoints rather than inspecting only endpoints', () => {
    const project = shape();
    Object.assign(project.layers[0], { x: 50.5, y: 256, width: 100, height: 20 });
    project.layers[0].tracks.rotation = [{ frame: 0, value: 0, easing: 'ease-in' }, { frame: 119, value: 90, easing: 'linear' }];
    const sample = vi.spyOn(core, 'sampleLayer');
    try {
      const result = reviewProject(project);
      expect(result.warnings.find(w => w.code === 'off_canvas')?.frame).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'no_motion')).toBe(false);
      expect(sample.mock.calls.some(([, frame]) => frame === 59.5)).toBe(true);
    } finally { sample.mockRestore(); }
  });
  it('bounds dense proposals to 64 distinct sampled frames, 1280 layer evaluations and 32 safe warnings', () => {
    const project = createProject({ durationFrames: 3600 });
    for (let i = 0; i < 20; i++) {
      const layer = structuredClone(shape().layers[0]);
      layer.id = `dense-${i}`;
      layer.name = '<script>untrusted</script>';
      Object.assign(layer, { x: -200, width: 1, height: 1, opacity: 1 });
      for (const property of ['x', 'y', 'rotation', 'scale', 'opacity'] as const) layer.tracks[property] = Array.from({ length: 100 }, (_, k) => ({ frame: k * 36, value: layer[property], easing: 'linear' }));
      project.layers.push(layer);
    }
    const sample = vi.spyOn(core, 'sampleLayer');
    try {
      const result = reviewProject(project);
      expect(result.sampledFrames).toBeGreaterThan(2);
      expect(result.sampledFrames).toBeLessThanOrEqual(64);
      expect(sample).toHaveBeenCalledTimes(result.sampledFrames * 20);
      expect(sample.mock.calls.length).toBeLessThanOrEqual(1280);
      expect(result.warnings.length).toBeLessThanOrEqual(32);
      expect(result.warnings.some(w => w.code === 'no_visible_content')).toBe(true);
      expect(result.warnings.every(w => !w.message.includes('script'))).toBe(true);
    } finally { sample.mockRestore(); }
  });
  it('flags persistently tiny and low-opacity shapes at the selected target without flagging a valid fade', () => {
    const project = shape();
    Object.assign(project.layers[0], { width: 8, height: 8, opacity: 5 });
    expect(reviewProject(project).warnings.map(w => w.code)).toEqual(expect.arrayContaining(['tiny_at_target_size', 'low_opacity']));
    expect(reviewProject(project, { targetSize: 512 }).warnings.map(w => w.code)).not.toContain('tiny_at_target_size');
    Object.assign(project.layers[0], { width: 100, height: 100 });
    project.layers[0].tracks.opacity = [{ frame: 0, value: 0, easing: 'ease-in' }, { frame: 60, value: 100, easing: 'linear' }, { frame: 119, value: 0, easing: 'linear' }];
    expect(reviewProject(project).warnings.map(w => w.code)).not.toContain('low_opacity');
  });
  it('warns on a fully transparent layer even when another layer is visible, without treating hidden endpoints as low opacity', () => {
    const project = addLayer(shape(), 'ellipse');
    project.layers[1].opacity = 0;
    expect(reviewProject(project).warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'low_opacity', layerId: project.layers[1].id })]));
    project.layers[1].tracks.opacity = [{ frame: 0, value: 0, easing: 'linear' }, { frame: 60, value: 100, easing: 'linear' }, { frame: 119, value: 0, easing: 'linear' }];
    expect(reviewProject(project).warnings.some(w => w.code === 'low_opacity')).toBe(false);
  });
  it('checks unequal endpoints only for explicit loops and accepts hidden resets and equivalent rotations', () => {
    const project = shape();
    const layer = project.layers[0];
    layer.tracks.x = [{ frame: 0, value: 100, easing: 'ease-out' }, { frame: 119, value: 300, easing: 'linear' }];
    expect(reviewProject(project).warnings.map(w => w.code)).not.toContain('loop_endpoint_mismatch');
    expect(reviewProject(project, { loop: false }).warnings.map(w => w.code)).not.toContain('loop_endpoint_mismatch');
    expect(reviewProject(project, { loop: true }).warnings.map(w => w.code)).toContain('loop_endpoint_mismatch');
    layer.tracks.opacity = [{ frame: 0, value: 0, easing: 'linear' }, { frame: 60, value: 100, easing: 'linear' }, { frame: 119, value: 0, easing: 'linear' }];
    expect(reviewProject(project, { loop: true }).warnings.map(w => w.code)).not.toContain('loop_endpoint_mismatch');
    layer.tracks.x = [{ frame: 0, value: 256, easing: 'linear' }, { frame: 60, value: 300, easing: 'linear' }, { frame: 119, value: 256, easing: 'linear' }];
    layer.tracks.opacity = [];
    layer.tracks.rotation = [{ frame: 0, value: 0, easing: 'linear' }, { frame: 119, value: 360, easing: 'linear' }];
    expect(reviewProject(project, { loop: true }).warnings).toEqual([]);
  });
  it('does not mutate a valid still and labels its lack of sampled motion', () => {
    const project = shape();
    const before = JSON.stringify(project);
    expect(reviewProject(project).warnings.map(w => w.code)).toEqual(['no_motion']);
    expect(JSON.stringify(project)).toBe(before);
  });
});
