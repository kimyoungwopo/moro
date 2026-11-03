import ClaudeConnection from '../../ai-auth/ClaudeConnection';
import { useEffect, useId, useRef, useState } from 'react';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
import type { ProviderId } from '../ai/client';
import { TARGET_DISPLAY_SIZES, briefLimitForTarget, composeTargetBrief } from '../ai/target-context';
import type { TargetDisplaySize } from '../ai/target-context';
import HarnessReview from './HarnessReview';
import { HarnessClient } from './client';
import { HarnessSession } from './state';
import type { HarnessState } from './state';
import type { HarnessTask } from './report';
import '../ai/ai.css';
import './harness.css';
export type HarnessPanelProps = { currentProject: CreatorProject; onApply: (project: CreatorProject, baseProject: CreatorProject) => unknown };
export default function HarnessPanel({ currentProject, onApply }: HarnessPanelProps) {
  const id = useId();
  const [provider, setProvider] = useState<ProviderId>('codex');
  const [domain, setDomain] = useState<HarnessTask['domain']>('ui-motion');
  const [brief, setBrief] = useState('');
  const [target, setTarget] = useState<TargetDisplaySize>(64);
  const [state, setState] = useState<HarnessState>({ phase: 'idle', active: false, consent: false });
  const session = useRef<HarnessSession | null>(null);
  useEffect(() => {
    const owned = new HarnessSession(new HarnessClient(), setState); session.current = owned;
    return () => { owned.dispose(); if (session.current === owned) session.current = null; };
  }, []);
  const limit = briefLimitForTarget(target);
  const valid = !!brief.trim() && brief.length <= limit;
  const task = (): HarnessTask => ({ provider, domain, brief: composeTargetBrief(brief.trim(), target) });
  const invalidate = () => session.current?.invalidate();
  const ready = state.phase === 'checked' && state.preflight?.status === 'ready';
  return <section className="cr-ai cr-harness" aria-labelledby={`${id}-title`} onKeyDown={event => event.stopPropagation()}>
    <header className="cr-ai-heading"><div><h2 id={`${id}-title`}>Quality lab</h2><p>Compare a bounded Propose–Probe–Compose review.</p></div><span className="cr-ai-badge">Optional · 7 calls</span></header>
    <p className="cr-ai-note">No editor project or repository is uploaded. Only your brief, domain and target display context are sent to the selected official CLI provider after separate consent. Fixed local craft references may also inform the requests. The editor snapshot stays on this device.</p>
    <p className="cr-ai-note">Rectangles and ellipses only. Capability checks and successful parsing are not artistic approval. Human-character work is blocked: paths, groups and pivots are not supported.</p>
    <form onSubmit={event => { event.preventDefault(); if (valid && ready && state.consent && !state.active) void session.current?.run(task(), currentProject); }}>
      <div className="cr-harness-grid">
        <label className="cr-ai-field"><span>Harness provider</span><select aria-label="Harness provider" value={provider} disabled={state.active} onChange={event => { setProvider(event.target.value as ProviderId); invalidate(); }}><option value="codex">Codex</option><option value="claude">Claude Code</option></select></label>
        <label className="cr-ai-field"><span>Harness domain</span><select aria-label="Harness domain" value={domain} disabled={state.active} onChange={event => { setDomain(event.target.value as HarnessTask['domain']); invalidate(); }}><option value="ui-motion">UI motion</option><option value="human-character">Human character — unsupported</option></select></label>
        <label className="cr-ai-field"><span>Harness target size</span><select aria-label="Harness target size" value={target} disabled={state.active} onChange={event => { setTarget(Number(event.target.value) as TargetDisplaySize); invalidate(); }}>{TARGET_DISPLAY_SIZES.map(size => <option key={size} value={size}>{size} px</option>)}</select></label>
      </div>
      {provider === 'claude' && <ClaudeConnection disabled={state.active} />}
      <label className="cr-ai-field"><span>Harness brief <span className="cr-ai-count">{brief.length}/{limit}</span></span><textarea aria-label="Harness brief" aria-describedby={`${id}-brief`} rows={3} maxLength={4000} value={brief} disabled={state.active} onChange={event => { setBrief(event.target.value); invalidate(); }} placeholder="A teal circle settles into a compact status indicator." /></label>
      <p className="cr-ai-note" id={`${id}-brief`}>The target is final display size, not canvas dimensions. The complete brief including its Design target header is limited to 4000 characters. Do not include secrets. Changing any control clears capability evidence and consent.</p>
      <button type="button" disabled={!valid || state.active || state.phase === 'checking'} onClick={() => { void session.current?.check(task()); }}>{state.phase === 'checking' ? 'Checking capabilities…' : 'Check capabilities'}</button>
      <p className="cr-ai-note">Check capabilities makes zero model calls. It checks the supported workflow, not CLI login, billing, quota or artistic quality.</p>
      {state.preflight && <div className="cr-ai-setup" role="status"><strong>{state.preflight.status === 'ready' ? 'Capabilities ready · 0 model calls' : 'Capabilities blocked · 0 model calls'}</strong>{state.preflight.blockers.length > 0 && <ul>{state.preflight.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul>}<p>Artistic review: not reviewed. Call budget: seven, no retries.</p></div>}
      <label className="cr-ai-consent"><input type="checkbox" checked={state.consent} disabled={!ready || state.active} onChange={event => session.current?.setConsent(event.target.checked)} /><span>I consent to up to seven (7) official CLI requests and sending this brief, domain and target display context to {provider === 'codex' ? 'Codex' : 'Claude Code'}. My CLI account’s billing and quota apply. No editor project is sent.</span></label>
      <div className="cr-ai-actions"><button type="submit" disabled={!valid || !ready || !state.consent || state.active} className="cr-primary">Run seven-stage harness</button>{state.active && <button type="button" disabled={state.phase === 'cancelling'} onClick={() => { void session.current?.cancel(); }}>Cancel harness</button>}</div>
    </form>
    <div className="cr-ai-status" role="status" aria-live="polite">{state.phase === 'starting' ? 'Starting consented review… Your animation is unchanged.' : state.phase === 'running' ? `Review running${state.stage ? ` · ${state.stage}` : ''}. No candidate is applied automatically. Polling is limited to 22 minutes / 1320 checks.` : state.message}</div>
    {state.review && (state.phase === 'ready' || state.phase === 'applied') && <HarnessReview state={state} currentProject={currentProject} onSelect={value => session.current?.select(value)} onApply={() => session.current?.apply(currentProject, onApply)} />}
  </section>;
}
