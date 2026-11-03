import { sampleLayer } from '../../../../../packages/creator-core/src';
import type { CreatorLayer, CreatorProject } from '../../../../../packages/creator-core/src';
export type ReviewCode = 'no_layers' | 'no_visible_content' | 'off_canvas' | 'tiny_at_target_size' | 'low_opacity' | 'no_motion' | 'loop_endpoint_mismatch';
export type ReviewWarning = { code: ReviewCode; layerId?: string; frame?: number; message: string };
export type ProjectReview = { warnings: ReviewWarning[]; sampledFrames: number; structuralOnly: true };
const messages: Record<ReviewCode, string> = {
  no_layers: 'The proposal has no layers.',
  no_visible_content: 'No on-canvas content with nonzero opacity was found in sampled frames.',
  off_canvas: 'A visible shape extends beyond the canvas at a sampled frame. An entrance or exit may be intentional.',
  tiny_at_target_size: 'A shape stays below 2 px on its shorter axis at the selected size in sampled visible frames. Review small-size readability.',
  low_opacity: 'A shape never exceeds 10% opacity in sampled frames. A subtle effect may be intentional.',
  no_motion: 'No motion detected in sampled frames. A still may be intentional.',
  loop_endpoint_mismatch: 'Visible first and last poses differ for the requested loop. Review the seam; numeric endpoints do not assess continuity.',
};
type Pose = ReturnType<typeof sampleLayer>;
function extents(layer: CreatorLayer, pose: Pose) {
  const radians = pose.rotation * Math.PI / 180, c = Math.abs(Math.cos(radians)), s = Math.abs(Math.sin(radians));
  const a = layer.width / 2, b = layer.height / 2, stroke = layer.strokeWidth / 2, scale = pose.scale / 100;
  return layer.type === 'rect'
    ? { x: ((a + stroke) * c + (b + stroke) * s) * scale, y: ((a + stroke) * s + (b + stroke) * c) * scale }
    : { x: (Math.hypot(a * c, b * s) + stroke) * scale, y: (Math.hypot(a * s, b * c) + stroke) * scale };
}
// A fixed budget, not an exhaustive frame scan. Include endpoints, evenly spaced
// frames, key times and interval midpoints, then thin the sorted union if dense.
function reviewFrames(project: CreatorProject): number[] {
  const last = project.durationFrames - 1, candidates = new Set<number>();
  for (let i = 0; i <= 8; i++) candidates.add(last * i / 8);
  for (const layer of project.layers.slice(0, 20)) for (const keys of Object.values(layer.tracks)) {
    keys.slice(0, 100).forEach((key, index) => {
      candidates.add(key.frame);
      if (index) candidates.add((keys[index - 1].frame + key.frame) / 2);
    });
  }
  const frames = [...candidates].sort((a, b) => a - b);
  return frames.length <= 64 ? frames : Array.from({ length: 64 }, (_, i) => frames[Math.round(i * (frames.length - 1) / 63)]);
}
export type ReviewOptions = { targetSize?: 64 | 128 | 512; loop?: boolean };
export function reviewProject(project: CreatorProject, options: ReviewOptions = {}): ProjectReview {
  const warnings: ReviewWarning[] = [], seen = new Set<string>();
  const warn = (code: ReviewCode, layerId?: string, frame?: number) => {
    const key = `${code}:${layerId ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push({ code, ...(layerId ? { layerId } : {}), ...(frame === undefined ? {} : { frame }), message: messages[code] });
  };
  if (!project.layers.length) { warn('no_layers'); return { warnings, sampledFrames: 0, structuralOnly: true }; }
  const frames = reviewFrames(project);
  let visible = false, moving = false;
  for (const layer of project.layers.slice(0, 20)) {
    const poses = frames.map(frame => sampleLayer(layer, frame)), first = poses[0];
    const shown = poses.filter(pose => pose.opacity > 0);
    const last = poses[poses.length - 1];
    if (options.loop === true && !(first.opacity === 0 && last.opacity === 0)) {
      const rotationDelta = Math.abs(((last.rotation - first.rotation) % 360 + 540) % 360 - 180);
      if (Math.abs(first.x - last.x) > 0.5 || Math.abs(first.y - last.y) > 0.5 || Math.abs(first.scale - last.scale) > 0.1 || Math.abs(first.opacity - last.opacity) > 0.1 || rotationDelta > 0.1) warn('loop_endpoint_mismatch', layer.id, project.durationFrames - 1);
    }
    const target = options.targetSize ?? 64;
    if (shown.length && shown.every(pose => Math.min(layer.width + layer.strokeWidth, layer.height + layer.strokeWidth) * pose.scale / 100 * target / Math.max(project.width, project.height) < 2)) warn('tiny_at_target_size', layer.id);
    if (poses.every(pose => pose.opacity <= 10)) warn('low_opacity', layer.id);
    if (poses.some(pose => Object.keys(first).some(key => Math.abs(pose[key as keyof Pose] - first[key as keyof Pose]) > 0.001))) moving = true;
    poses.forEach((pose, index) => {
      if (pose.opacity <= 0) return;
      const bounds = extents(layer, pose);
      if (pose.x + bounds.x > 0 && pose.x - bounds.x < project.width && pose.y + bounds.y > 0 && pose.y - bounds.y < project.height) visible = true;
      if (pose.x - bounds.x < -0.001 || pose.x + bounds.x > project.width + 0.001 || pose.y - bounds.y < -0.001 || pose.y + bounds.y > project.height + 0.001) warn('off_canvas', layer.id, frames[index]);
    });
  }
  // Project-level findings remain visible even when many layer findings exist.
  if (!visible) warnings.unshift({ code: 'no_visible_content', message: messages.no_visible_content });
  if (!moving) warn('no_motion');
  return { warnings: warnings.slice(0, 32), sampledFrames: frames.length, structuralOnly: true };
}
