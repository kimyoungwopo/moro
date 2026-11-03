import { validateProposal } from '../ai/client';
import { projectSignature } from '../ai/project-context';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
import type { ProviderId } from '../ai/client';
export type HarnessTask = { provider: ProviderId; brief: string; domain: 'ui-motion' | 'human-character' };
export const PROJECT_STAGES = ['base', 'probe-invariant', 'probe-domain', 'final'] as const;
export const STAGES = ['base', 'propose-invariant', 'propose-domain', 'probe-invariant', 'probe-domain', 'compose', 'final'] as const;
export type CandidateId = typeof PROJECT_STAGES[number];
export type Guidance = { rules: string[]; rationale: string };
export type Candidate = { id: CandidateId; project: CreatorProject };
export type HarnessReport = { schemaVersion: 1; task: HarnessTask; status: 'review_required'; artisticReview: 'not_reviewed'; modelCalls: 7; callBudget: 7; stages: { id: string; kind: string; attempted: boolean; status: string; data: unknown }[]; guidance: Guidance; project: CreatorProject; [key: string]: unknown };
export type Review = { report: HarnessReport; candidates: Candidate[]; guidance: Guidance };
export const INVALID_REPORT = 'Harness report is invalid. Your animation is unchanged.';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID_REPORT);
  return value as Record<string, unknown>;
}
function guidance(value: unknown): Guidance {
  const data = record(value);
  const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && Array.from(v).length <= max;
  if (Object.keys(data).length !== 2 || !Array.isArray(data.rules) || data.rules.length < 1 || data.rules.length > 8 || !data.rules.every(rule => text(rule, 500)) || !text(data.rationale, 1500)) throw new Error(INVALID_REPORT);
  return { rules: data.rules as string[], rationale: data.rationale };
}
export function validateReport(value: unknown, task: HarnessTask): Review {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || new TextEncoder().encode(serialized).length > 1024 * 1024) throw new Error();
    const report = record(JSON.parse(serialized));
    const submitted = record(report.task);
    if (report.schemaVersion !== 1 || report.status !== 'review_required' || report.artisticReview !== 'not_reviewed' || report.modelCalls !== 7 || report.callBudget !== 7 || !Array.isArray(report.blockers) || report.blockers.length || submitted.provider !== task.provider || submitted.brief !== task.brief || submitted.domain !== task.domain || task.domain !== 'ui-motion') throw new Error();
    if (!Array.isArray(report.stages) || report.stages.length !== STAGES.length) throw new Error();
    const candidates: Candidate[] = [];
    report.stages.forEach((value, index) => {
      const stage = record(value), id = STAGES[index];
      const isProject = (PROJECT_STAGES as readonly string[]).includes(id);
      if (stage.id !== id || stage.status !== 'succeeded' || stage.attempted !== true || stage.kind !== (isProject ? 'project' : 'guidance')) throw new Error();
      if (isProject) candidates.push({ id: id as CandidateId, project: validateProposal(stage.data) });
      else guidance(stage.data);
    });
    const composed = guidance(report.guidance);
    const final = validateProposal(report.project);
    if (projectSignature(final) !== projectSignature(candidates[3].project) || JSON.stringify(composed) !== JSON.stringify(guidance(record(report.stages[5]).data))) throw new Error();
    return { report: report as HarnessReport, candidates, guidance: composed };
  } catch { throw new Error(INVALID_REPORT); }
}
