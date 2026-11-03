import { parseProject, serializeProject } from '../../../../../packages/creator-core/src';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
import { validateProposal } from '../ai/client';
import { projectSignature } from '../ai/project-context';
import { checkedTask } from './client';
import type { HarnessClient, Preflight } from './client';
import type { CandidateId, HarnessTask, Review } from './report';
export type HarnessState = {
  phase: 'idle' | 'checking' | 'checked' | 'starting' | 'running' | 'cancelling' | 'cancelled' | 'ready' | 'applied' | 'error';
  active: boolean; consent: boolean; preflight?: Preflight; task?: HarnessTask; review?: Review;
  selected?: CandidateId; baseProject?: CreatorProject; stage?: string; message?: string;
};
const FAILURE = 'The local AI bridge could not finish this review. Check CLI installation, login, billing and quota, then retry. Your animation is unchanged.';
const CANCELLED = 'Review cancelled. Your animation is unchanged.';
export class HarnessSession {
  state: HarnessState = { phase: 'idle', active: false, consent: false };
  private version = 0;
  private disposed = false;
  private ownedId?: string;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private deadlineTimer?: ReturnType<typeof setTimeout>;
  private polls = 0;
  private applying = false;
  private cancellationMessage = CANCELLED;
  constructor(readonly client: HarnessClient, readonly changed: (state: HarnessState) => void = () => {}, readonly options: { pollIntervalMs?: number; maxPolls?: number; maxDurationMs?: number } = {}) {}
  private update(state: HarnessState) { this.state = state; if (!this.disposed) this.changed(state); }
  private current(version: number) { return !this.disposed && version === this.version; }
  private clearTimers() { clearTimeout(this.pollTimer); clearTimeout(this.deadlineTimer); }
  invalidate() {
    if (this.disposed || this.state.active) return;
    ++this.version; this.update({ phase: 'idle', active: false, consent: false });
  }
  async check(input: HarnessTask) {
    if (this.disposed || this.state.active) return;
    const version = ++this.version;
    this.update({ phase: 'checking', active: false, consent: false });
    try {
      const task = checkedTask(input), preflight = await this.client.preflight(task);
      if (this.current(version)) this.update({ phase: 'checked', active: false, consent: false, task, preflight });
    } catch { if (this.current(version)) this.update({ phase: 'error', active: false, consent: false, message: FAILURE }); }
  }
  setConsent(consent: boolean) {
    if (!this.disposed && !this.state.active) this.update({ ...this.state, consent: consent && this.state.phase === 'checked' && this.state.preflight?.status === 'ready' });
  }
  async run(input: HarnessTask, base: CreatorProject) {
    if (this.disposed || this.state.active || !this.state.consent || this.state.preflight?.status !== 'ready') return;
    let task: HarnessTask, baseProject: CreatorProject;
    try {
      task = checkedTask(input);
      if (JSON.stringify(this.state.task) !== JSON.stringify(task)) return;
      baseProject = parseProject(serializeProject(base));
    } catch { return; }
    const version = ++this.version;
    this.polls = 0;
    this.update({ phase: 'starting', active: true, consent: false, task, baseProject });
    this.deadlineTimer = setTimeout(() => { void this.cancel('Review time limit reached. No candidate was applied.'); }, Math.min(this.options.maxDurationMs ?? 1320000, 1320000));
    try {
      const id = await this.client.start(task, true);
      if (!this.current(version)) { await this.cleanup(id, this.cancellationMessage); return; }
      this.ownedId = id;
      this.update({ ...this.state, phase: 'running' });
      await this.poll(version, id, task);
    } catch {
      if (!this.current(version)) {
        if (!this.disposed && this.state.phase === 'cancelling') this.update({ phase: 'cancelled', active: false, consent: false, message: this.cancellationMessage });
        return;
      }
      await this.fail();
    }
  }
  private async poll(version: number, id: string, task: HarnessTask): Promise<void> {
    if (!this.current(version)) return;
    if (this.polls >= Math.min(this.options.maxPolls ?? 1320, 1320)) { await this.cancel('Review polling limit reached. No candidate was applied.'); return; }
    ++this.polls;
    try {
      const job = await this.client.poll(id, task);
      if (!this.current(version)) return;
      if (job.status === 'running') {
        this.update({ ...this.state, stage: job.stage });
        this.pollTimer = setTimeout(() => { void this.poll(version, id, task); }, Math.max(10, this.options.pollIntervalMs ?? 1000));
      } else {
        this.clearTimers(); this.ownedId = undefined;
        if (job.status === 'succeeded' && job.review) this.update({ ...this.state, phase: 'ready', active: false, review: job.review, selected: 'base', message: 'Review all four candidates. Parsing is not artistic approval.' });
        else this.update({ phase: job.status === 'cancelled' ? 'cancelled' : 'error', active: false, consent: false, message: job.status === 'cancelled' ? CANCELLED : job.message ?? FAILURE });
      }
    } catch { if (this.current(version)) await this.fail(); }
  }
  private async fail() {
    this.clearTimers(); ++this.version;
    const id = this.ownedId; this.ownedId = undefined;
    if (id) await this.cleanup(id, FAILURE, 'error');
    else this.update({ phase: 'error', active: false, consent: false, message: FAILURE });
  }
  private async cleanup(id: string, message: string, phase: 'cancelled' | 'error' = 'cancelled') {
    try {
      const status = await this.client.cancel(id);
      if (status === 'running') throw new Error();
      this.update({ phase, active: false, consent: false, message });
    } catch {
      this.ownedId = id;
      this.update({ phase: 'error', active: true, consent: false, message: 'Cancellation could not be confirmed. Provider cleanup may still be running. Retry Cancel harness; no candidate will be applied.' });
    }
  }
  async cancel(message = CANCELLED) {
    if (!this.state.active || this.state.phase === 'cancelling') return;
    ++this.version; this.clearTimers(); this.cancellationMessage = message;
    const id = this.ownedId; this.ownedId = undefined;
    this.update({ phase: 'cancelling', active: true, consent: false, message: 'Cancelling owned review… No candidate will be applied.' });
    if (id) await this.cleanup(id, message);
    // A start request in flight owns no ID yet. Its late ID is cancelled in run().
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; ++this.version; this.clearTimers();
    void this.cancel();
  }
  select(id: CandidateId) {
    if (!this.disposed && this.state.phase === 'ready' && this.state.review?.candidates.some(candidate => candidate.id === id)) this.update({ ...this.state, selected: id });
  }
  apply(current: CreatorProject, onApply: (project: CreatorProject, base: CreatorProject) => unknown) {
    if (this.disposed || this.applying || this.state.phase !== 'ready') return false;
    const candidate = this.state.review?.candidates.find(candidate => candidate.id === this.state.selected), base = this.state.baseProject;
    if (!candidate || !base) return false;
    try {
      const project = validateProposal(candidate.project);
      if (projectSignature(current) !== projectSignature(base) || projectSignature(current) === projectSignature(project)) return false;
      this.applying = true;
      if (onApply(project, parseProject(serializeProject(base))) === false) return false;
      this.update({ ...this.state, phase: 'applied', message: 'Candidate applied as one edit. One Undo restores your previous animation.' }); return true;
    } catch { this.update({ ...this.state, message: 'Could not apply this candidate. Your editor is unchanged.' }); return false; }
    finally { this.applying = false; }
  }
}
