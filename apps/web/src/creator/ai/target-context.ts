export const DESIGN_TARGET_HEADER = /^Design target: (64|128|512)px \(final display size, not canvas dimensions\)\.\n\n/;
export type TargetDisplaySize = 64 | 128 | 512;
export const TARGET_DISPLAY_SIZES = [64, 128, 512] as const;
const header = (target: TargetDisplaySize) => `Design target: ${target}px (final display size, not canvas dimensions).\n\n`;
export const briefLimitForTarget = (target: TargetDisplaySize) => 4000 - header(target).length;
export function composeTargetBrief(brief: string, target: TargetDisplaySize): string {
  if (!brief.trim()) throw new Error('Write a nonempty animation brief.');
  const outgoing = header(target) + brief;
  if (outgoing.length > 4000) throw new Error('Complete brief including target context must be at most 4000 characters.');
  return outgoing;
}
