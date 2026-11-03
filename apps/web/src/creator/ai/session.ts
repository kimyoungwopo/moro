import { DESIGN_TARGET_HEADER } from './target-context';
import { prepareProjectContext, projectSignature } from './project-context';
import type { RefinementContext } from './project-context';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
import { validateProposal } from './client';
import type { AiClient, ProviderId } from './client';
import { generationObservationMs } from '../../generation-policy';
import type { ReviewOptions } from './review';
// Conservative hints only: ambiguous briefs do not receive loop-seam warnings.
function briefReviewOptions(brief: string): ReviewOptions {
  const sizes = [...new Set([...brief.matchAll(/\b(64|128|512)\s*px\b/gi)].map(match => Number(match[1])))];
  const explicit = DESIGN_TARGET_HEADER.exec(brief);
  const targetSize = (explicit ? Number(explicit[1]) : sizes.length === 1 ? sizes[0] : 64) as 64 | 128 | 512;
  const negative = /\bnon[- ]?loop(?:ing)?\b|\b(?:not|don't|never|no|without)\b[^.!?\n]{0,32}\bloop(?:ing)?\b|루프\s*(?:없이|없음|없는|아님|금지)|반복하지/i.test(brief);
  const uncertain = /\b(?:maybe|perhaps|might|whether|optional(?:ly)?)\b|아마|루프\s*여부/i.test(brief);
  const positive = /\b(?:seamless\s+loop(?:ing)?|looping|continuous\s+loop|loop\s+continuously|repeat\s+forever)\b|루프|무한\s*반복/i.test(brief);
  return { targetSize, ...(negative ? { loop: false } : positive && !uncertain ? { loop: true } : {}) };
}
export type SessionState = { phase: 'idle' | 'running' | 'cancelling' | 'ready' | 'cancelled' | 'failed' | 'applied'; project?: CreatorProject; baseProject?: CreatorProject; provider?: ProviderId; submittedBrief?: string; reviewOptions?: ReviewOptions; message?: string; active: boolean };
type Run = { id?: string; cancelled: boolean; deadline?: ReturnType<typeof setTimeout>; wake?: () => void; cancellation?: Promise<void>; reason?: string };
export class AiSession {
  state: SessionState = { phase: 'idle', active: false };
  private disposed = false;
  private run?: Run;
  constructor(readonly client: AiClient, readonly emit: (state: SessionState) => void) {}
  private update(next: SessionState) { this.state = next; if (!this.disposed) this.emit(next); }
  private current(run: Run) { return this.run === run && !run.cancelled && !this.disposed; }
  private finish(run: Run, next: SessionState) {
    clearTimeout(run.deadline); run.wake?.();
    if (this.run === run) this.update(next);
  }
  async generate(provider: ProviderId, prompt: string, consent: boolean, context?: RefinementContext): Promise<void> {
    if (this.disposed || this.state.active) return;
    const run: Run = { cancelled: false }; this.run = run;
    let baseProject: CreatorProject | undefined;
    this.update({ phase: 'running', active: true, provider, submittedBrief: DESIGN_TARGET_HEADER.test(prompt) ? prompt : prompt.trim() });
    run.deadline = setTimeout(() => { void this.cancel('Generation observation timed out. Your animation is unchanged.'); }, generationObservationMs(provider));
    try {
      if(context){
        if(context.consent!==true) throw new Error('Explicit consent to send the current project is required.');
        baseProject=prepareProjectContext(context.project);
        this.update({...this.state,baseProject});
      }
      run.id = await this.client.start(provider, prompt, consent, context ? {project:baseProject!,consent:context.consent} : undefined);
      if (!this.current(run)) { await this.stop(run); return; }
      while (this.current(run)) {
        const job = await this.client.poll(run.id, provider);
        if (!this.current(run)) return;
        if (job.status === 'running') {
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, 1000);
            run.wake = () => { clearTimeout(timer); resolve(); };
          });
          continue;
        }
        this.finish(run, { phase: job.status === 'succeeded' ? 'ready' : job.status === 'cancelled' ? 'cancelled' : 'failed', active: false, provider, submittedBrief: DESIGN_TARGET_HEADER.test(prompt) ? prompt : prompt.trim(), reviewOptions: briefReviewOptions(prompt), project: job.project, baseProject, message: job.error?.message });
        return;
      }
    } catch (error) {
      if (this.run === run && run.cancelled && !run.id) {
        this.finish(run, { phase: run.reason ? 'failed' : 'cancelled', active: false, provider, message: run.reason || 'Generation cancelled. Your animation is unchanged.' });
        return;
      }
      if (!this.current(run)) return;
      const message = error instanceof Error ? error.message : 'Generation failed. Your animation is unchanged.';
      if (run.id) await this.cancel(message);
      else this.finish(run, { phase: 'failed', active: false, provider, message });
    }
  }
  private async stop(run: Run): Promise<void> {
    if (!run.id) return;
    if (run.cancellation) return run.cancellation;
    run.cancellation = (async () => {
      try {
        const result = await this.client.cancel(run.id!);
        if (result === 'running') throw new Error();
        this.finish(run, { phase: run.reason ? 'failed' : 'cancelled', active: false, provider: this.state.provider, message: run.reason || 'Generation cancelled. Your animation is unchanged.' });
      } catch {
        if (this.run === run) this.update({ phase: 'failed', active: true, provider: this.state.provider, message: 'Cancellation could not be confirmed. Retry Cancel generation. No proposal will be applied.' });
      } finally { run.cancellation = undefined; }
    })();
    return run.cancellation;
  }
  async cancel(reason?: string): Promise<void> {
    const run = this.run;
    if (!run || !this.state.active) return;
    run.cancelled = true; run.reason = reason;
    clearTimeout(run.deadline); run.wake?.();
    this.update({ phase: 'cancelling', active: true, provider: this.state.provider });
    await this.stop(run);
  }
  apply(callback: (project: CreatorProject, baseProject?: CreatorProject) => unknown, currentProject?: CreatorProject): void {
    if (this.disposed || this.state.phase !== 'ready' || !this.state.project) return;
    const base=this.state.baseProject;
    if(base && (!currentProject || projectSignature(base)!==projectSignature(currentProject))){
      this.update({...this.state,message:'Your current project changed after this request. Undo those changes or generate a fresh refinement before applying.'});return;
    }
    let project: CreatorProject;
    try { project = validateProposal(this.state.project); }
    catch { this.update({ phase: 'failed', active: false, message: 'The AI response was invalid. Your animation is unchanged.' }); return; }
    if(base&&projectSignature(base)===projectSignature(project)){this.update({...this.state,message:'No changes proposed. Your current animation and Undo history are unchanged.'});return;}
    const accepted=base?callback(project,base):callback(project);
    if(accepted===false){this.update({...this.state,message:'Your current project changed. This proposal was not applied.'});return;}
    this.update({ phase: 'applied', active: false, provider: this.state.provider });
  }
  dispose(): void {
    this.disposed = true;
    void this.cancel();
  }
}
