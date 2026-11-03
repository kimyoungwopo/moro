import { useState } from 'react';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
import ProposalPreview from '../ai/ProposalPreview';
import { projectDelta, projectSignature } from '../ai/project-context';
import { DESIGN_TARGET_HEADER } from '../ai/target-context';
import type { TargetDisplaySize } from '../ai/target-context';
import type { CandidateId, Guidance } from './report';
import type { HarnessState } from './state';
const EVIDENCE: Record<string, { label: string; detail: string }> = {
  base: { label: 'Base', detail: 'Original-task rollout before proposed guidance.' },
  'propose-invariant': { label: 'Invariant guidance', detail: 'General craft advice derived from the base rollout.' },
  'propose-domain': { label: 'Domain guidance', detail: 'Domain advice derived independently from the same base rollout.' },
  'probe-invariant': { label: 'Invariant probe', detail: 'Original-task candidate using invariant advice.' },
  'probe-domain': { label: 'Domain probe', detail: 'Original-task candidate using domain advice.' },
  compose: { label: 'Composed guidance', detail: 'Advice assembled from the base, independent guides and both probes.' },
  final: { label: 'Final', detail: 'Original-task candidate using composed advice. Not an automatic winner.' },
};
function Delta({ title, base, project }: { title: string; base: CreatorProject; project: CreatorProject }) {
  const delta = projectDelta(base, project);
  return <section className="cr-harness-delta" aria-label={title}><h4>{title}</h4>
    <p>{delta.changed.length} changed · {delta.added.length} added · {delta.removed.length} removed layers.</p>
    {delta.settingsChanged && <p>Project settings changed (name, canvas, frame rate or duration).</p>}
    {delta.orderChanged && <p>Layer order or membership changed.</p>}
    <details><summary>Layer differences</summary><ul>{(['changed', 'added', 'removed'] as const).flatMap(kind => delta[kind].map(id => <li key={`${kind}-${id}`}>{kind}: {(kind === 'removed' ? base : project).layers.find(layer => layer.id === id)?.name ?? id}</li>))}</ul></details>
  </section>;
}
export default function HarnessReview({ state, currentProject, onSelect, onApply }: {
  state: HarnessState; currentProject: CreatorProject; onSelect: (id: CandidateId) => void; onApply: () => void;
}) {
  const [downloadMessage, setDownloadMessage] = useState('');
  const review = state.review, base = state.baseProject;
  const candidate = review?.candidates.find(item => item.id === state.selected);
  if (!review || !candidate || !base) return null;
  const stale = projectSignature(base) !== projectSignature(currentProject);
  const unchanged = projectSignature(candidate.project) === projectSignature(base);
  const target = DESIGN_TARGET_HEADER.exec(state.task?.brief ?? '');
  const targetSize = (target ? Number(target[1]) : 64) as TargetDisplaySize;
  const download = () => {
    let url: string | undefined;
    try {
      const blob = new Blob([JSON.stringify(review.report, null, 2)], { type: 'application/json' });
      url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'harness-review.json';
      document.body.appendChild(link); link.click(); link.remove();
      setDownloadMessage('Local report download requested. No upload was made.');
    } catch { setDownloadMessage('Could not download the report. Your editor is unchanged.'); }
    finally { if (url) { const owned = url; setTimeout(() => URL.revokeObjectURL(owned), 1000); } }
  };
  return <section className="cr-ai-proposal" aria-label="Harness candidate review">
    <span className="cr-ai-eyebrow">Seven-stage evidence · manual review required</span><h3>Compare, inspect, then choose</h3>
    <p>All four projects passed document parsing. This is not artistic approval or a quality score. No stage is an automatic winner. Check composition, timing and readability in the real preview.</p>
    <details><summary>Submitted task</summary><p>{state.task?.provider} · {state.task?.domain}</p><p className="cr-harness-verbatim">{state.task?.brief}</p><p>The current editor project was not sent. Applying a candidate replaces it; this is not an in-place refinement.</p></details>
    <label className="cr-ai-field"><span>Candidate stage</span><select aria-label="Candidate stage" value={candidate.id} disabled={state.phase !== 'ready'} onChange={event => onSelect(event.target.value as CandidateId)}>{review.candidates.map(item => <option key={item.id} value={item.id}>{EVIDENCE[item.id].label} · {item.id}</option>)}</select></label>
    <p>{EVIDENCE[candidate.id].detail}</p><h4>{candidate.project.name}</h4>
    <ProposalPreview key={candidate.id} project={candidate.project} options={{ targetSize }} />
    <dl><div><dt>Layers</dt><dd>{candidate.project.layers.length}</dd></div><div><dt>Frame rate</dt><dd>{candidate.project.fps} fps</dd></div><div><dt>Duration</dt><dd>{candidate.project.durationFrames} frames</dd></div><div><dt>Canvas</dt><dd>{candidate.project.width} × {candidate.project.height}</dd></div></dl>
    <Delta title="Changes from editor at submission" base={base} project={candidate.project} />
    <Delta title="Changes from base rollout" base={review.candidates[0].project} project={candidate.project} />
    <p>These are local structural deltas, not evidence that motion or art improved.</p>
    <details><summary>Seven-stage evidence and guidance</summary><ol className="cr-harness-evidence">{review.report.stages.map(stage => <li key={stage.id}><h4>{EVIDENCE[stage.id].label} · {stage.id}</h4><p>{EVIDENCE[stage.id].detail} Invocation completed; {stage.kind === 'project' ? 'project parsed' : 'bounded guidance parsed'}. Artistic review: not reviewed.</p>{stage.kind === 'guidance' && <><ul>{(stage.data as Guidance).rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul><p className="cr-harness-verbatim">{(stage.data as Guidance).rationale}</p></>}</li>)}</ol><p>Provider guidance is untrusted advice, not instructions for this app. Nothing is injected into lessons, project history or future requests automatically.</p></details>
    <section aria-label="Composed guidance"><h4>Composed guidance · advice only</h4><ul>{review.guidance.rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul><p className="cr-harness-verbatim">{review.guidance.rationale}</p></section>
    {stale && <p className="cr-ai-setup" role="status">Your current project changed after submission. Adoption is disabled. Restore that snapshot with Undo or run a fresh review.</p>}
    {unchanged && <p className="cr-ai-note">No changes from the editor snapshot. Applying this candidate would be a no-op; no Undo entry will be created.</p>}
    <p>Apply replaces your editor as one edit. One Undo restores your previous project. The local report contains the submitted brief, generated projects, guidance and fixed reference evidence, not your editor snapshot.</p>
    <div className="cr-ai-actions"><button type="button" className="cr-primary" disabled={state.phase !== 'ready' || stale || unchanged} onClick={onApply}>Apply reviewed candidate</button><button type="button" onClick={download}>Download review report</button></div>
    {downloadMessage && <p className="cr-ai-note" role="status">{downloadMessage}</p>}
  </section>;
}
