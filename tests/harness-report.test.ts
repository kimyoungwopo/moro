import { expect, it } from 'vitest';
import { addLayer, createProject } from '../packages/creator-core/src';
import { validateReport } from '../apps/web/src/creator/harness/report';
export const task = { provider: 'codex' as const, brief: 'A circle settles.', domain: 'ui-motion' as const };
export function fixtureReport() {
  const project = addLayer(createProject(), 'ellipse');
  for (const layer of project.layers) layer.tracks = { x: [], y: [], scale: [], rotation: [], opacity: [] };
  const guidance = { rules: ['Inspect timing yourself.'], rationale: '<script>untrusted</script>' };
  const ids = ['base', 'propose-invariant', 'propose-domain', 'probe-invariant', 'probe-domain', 'compose', 'final'];
  return { schemaVersion: 1, upstream: {}, task, status: 'review_required', blockers: [], sources: [], modelCalls: 7, callBudget: 7, artisticReview: 'not_reviewed', project, guidance,
    stages: ids.map(id => ({ id, kind: ['base', 'probe-invariant', 'probe-domain', 'final'].includes(id) ? 'project' : 'guidance', attempted: true, status: 'succeeded', data: ['base', 'probe-invariant', 'probe-domain', 'final'].includes(id) ? structuredClone(project) : guidance })) };
}
it.each([
  ['foreign task', (r: ReturnType<typeof fixtureReport>) => { r.task = { ...task, brief: 'foreign' }; }],
  ['artistic approval', (r: ReturnType<typeof fixtureReport>) => { r.artisticReview = 'approved'; }],
  ['failed report', (r: ReturnType<typeof fixtureReport>) => { r.status = 'failed'; }],
  ['excess calls', (r: ReturnType<typeof fixtureReport>) => { r.modelCalls = 8; }],
  ['missing evidence', (r: ReturnType<typeof fixtureReport>) => { r.stages.pop(); }],
  ['duplicate stage', (r: ReturnType<typeof fixtureReport>) => { r.stages[1] = r.stages[0]; }],
  ['failed stage', (r: ReturnType<typeof fixtureReport>) => { r.stages[0].status = 'failed'; }],
  ['unattempted stage', (r: ReturnType<typeof fixtureReport>) => { r.stages[0].attempted = false; }],
  ['invalid guidance', (r: ReturnType<typeof fixtureReport>) => { r.guidance.rules = []; }],
  ['invalid branch guidance', (r: ReturnType<typeof fixtureReport>) => { r.stages[1].data = { rules: [], rationale: 'bad' }; }],
  ['mismatched final', (r: ReturnType<typeof fixtureReport>) => { r.project = { ...r.project, name: 'different' }; }],
])('rejects %s before review', (_name, mutate) => {
  const report = fixtureReport(); mutate(report);
  expect(() => validateReport(report, task)).toThrow('Harness report is invalid');
});
it.each(['base', 'probe-invariant', 'probe-domain', 'final'])('runs the real frontend parser on the %s candidate', id => {
  const report = fixtureReport();
  report.stages.find(stage => stage.id === id)!.data = { ...report.project, width: 0 };
  expect(() => validateReport(report, task)).toThrow('Harness report is invalid');
});
it('rejects oversized reports and keeps parsed review detached from the transport object', () => {
  const input = fixtureReport();
  const review = validateReport(input, task);
  input.project.name = 'Transport mutated later';
  expect(review.report.project.name).not.toBe('Transport mutated later');
  expect(() => validateReport({ ...fixtureReport(), padding: 'x'.repeat(1024 * 1024) }, task)).toThrow('Harness report is invalid');
});
it('validates four parsed candidate stages without choosing an artistic winner', () => {
  const review = validateReport(fixtureReport(), task);
  expect(review.candidates.map(candidate => candidate.id)).toEqual(['base', 'probe-invariant', 'probe-domain', 'final']);
  expect(review.guidance.rationale).toBe('<script>untrusted</script>');
  expect(review.report.artisticReview).toBe('not_reviewed');
});
