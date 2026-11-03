import { parseProject } from '../../../../../packages/creator-core/src';
import { DESIGN_TARGET_HEADER } from './target-context';
import { prepareProjectContext } from './project-context';
import type { RefinementContext } from './project-context';
import type { CreatorProject } from '../../../../../packages/creator-core/src';

export type ProviderId = 'codex' | 'claude';
export type Provider = { id: ProviderId; label: string; installed: boolean };
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type JobStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';
export type Job = { id: string; provider: ProviderId; status: JobStatus; project?: CreatorProject; error?: { code: string; message: string } };
const SETUP = 'Local AI bridge unavailable. Keep editing, or start the local AI bridge and retry.';
const INVALID = 'The AI response was invalid. Your animation is unchanged.';
const safeErrors: Record<string, string> = {
  busy: 'Another generation is running. Wait for it to finish or cancel it first.',
  timeout: 'Generation reached its time limit without a validated proposal. Your animation is unchanged.',
  timeout_thinking: 'Claude was still reasoning when the generation time limit was reached. Your animation is unchanged.',
  timeout_writing: 'Claude was still writing the proposal when the generation time limit was reached. Your animation is unchanged.',
  timeout_waiting: 'The generation time limit was reached while waiting for the CLI response. Your animation is unchanged.',
  invalid_provider_schema: 'Claude could not initialize the proposal output format. Check the local bridge compatibility. Your animation is unchanged.',
  provider_missing: 'This CLI is not installed. Install it yourself, then retry.',
  not_installed: 'This CLI is not installed. Install it yourself, then retry.',
  cancelled: 'Generation cancelled. Your animation is unchanged.',
};
export function safeError(code: string): string {
  return Object.hasOwn(safeErrors, code) ? safeErrors[code] : 'Generation could not finish. Check your CLI login, version, billing and quota, then retry. Your animation is unchanged.';
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID);
  return value as Record<string, unknown>;
}
function jobId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(value)) throw new Error(INVALID);
  return value;
}
function status(value: unknown): JobStatus {
  if (value !== 'running' && value !== 'succeeded' && value !== 'failed' && value !== 'cancelled') throw new Error(INVALID);
  return value;
}
export function validateProposal(value: unknown): CreatorProject {
  try {
    const text = JSON.stringify(value);
    if (!text || new TextEncoder().encode(text).length > 2 * 1024 * 1024) throw new Error();
    const project = parseProject(text);
    if (project.layers.length > 20) throw new Error();
    for (const name of [project.name, ...project.layers.flatMap(layer => [layer.name, layer.id])]) if (Array.from(name).some(char => { const code = char.charCodeAt(0); return code < 32 || (code >= 127 && code <= 159); })) throw new Error();
    for (const layer of project.layers) for (const key of ['x', 'y', 'scale', 'rotation', 'opacity'] as const) if (!Array.isArray(layer.tracks[key])) throw new Error();
    return project;
  } catch { throw new Error(INVALID); }
}
export class AiClient {
  constructor(readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {}
  private async request(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const transportError = 'The local AI bridge did not respond. Retry or keep editing.';
    const work = async () => {
      let response: Response;
      try { response = await this.fetcher(path, { method: body === undefined ? 'GET' : 'POST', signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-Moro-Request': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
      catch { throw new Error(transportError); }
      let data: Record<string, unknown>;
      try {
        const text = await response.text();
        if (new TextEncoder().encode(text).length > 2 * 1024 * 1024 + 65536) throw new Error();
        data = record(JSON.parse(text));
      } catch { throw new Error(INVALID); }
      if (!response.ok || data.ok !== true) {
        const error = record(data.error);
        throw new Error(safeError(typeof error.code === 'string' ? error.code : 'unknown'));
      }
      return data;
    };
    try {
      return await Promise.race([work(), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error(transportError)); }, 10000);
      })]);
    } finally { clearTimeout(timer); }
  }
  async status(): Promise<Provider[]> {
    try {
      const data = await this.request('/api/ai/status');
      if (data.scope !== 'installed-only' || !Array.isArray(data.providers) || data.providers.length !== 2) throw new Error();
      const providers: Provider[] = data.providers.map(value => {
        const p = record(value);
        if ((p.id !== 'codex' && p.id !== 'claude') || typeof p.installed !== 'boolean' || typeof p.label !== 'string') throw new Error();
        return { id: p.id, label: p.id === 'codex' ? 'Codex' : 'Claude Code', installed: p.installed };
      });
      if (new Set(providers.map(p => p.id)).size !== 2) throw new Error();
      return providers;
    } catch { throw new Error(SETUP); }
  }
  async start(provider: ProviderId, brief: string, consent: boolean, context?: RefinementContext): Promise<string> {
    const prompt = DESIGN_TARGET_HEADER.test(brief) ? brief : brief.trim();
    if (!consent || !prompt || brief.length > 4000 || !['codex', 'claude'].includes(provider)) throw new Error('Choose a provider, write a brief of 1–4000 characters and agree before sending.');
    if(context && context.consent!==true) throw new Error('Explicit consent to send the current project is required.');
    const baseProject = context ? prepareProjectContext(context.project) : undefined;
    const data = await this.request('/api/ai/jobs', { provider, prompt, ...(baseProject ? {baseProject,contextConsent:true} : {}) });
    const job = record(data.job);
    if (job.status !== 'running') throw new Error(INVALID);
    return jobId(job.id);
  }
  async cancel(id: string): Promise<JobStatus> {
    const data = await this.request(`/api/ai/jobs/${encodeURIComponent(jobId(id))}/cancel`, {});
    const job = record(data.job);
    if (job.id !== id) throw new Error(INVALID);
    return status(job.status);
  }
  async poll(id: string, provider: ProviderId): Promise<Job> {
    const data = await this.request(`/api/ai/jobs/${encodeURIComponent(jobId(id))}`);
    const job = record(data.job);
    if (job.id !== id || job.provider !== provider) throw new Error(INVALID);
    const result: Job = { id, provider, status: status(job.status) };
    if (result.status === 'succeeded') result.project = validateProposal(job.project);
    if (result.status === 'failed') {
      const error = record(job.error);
      result.error = { code: typeof error.code === 'string' ? error.code : 'unknown', message: safeError(typeof error.code === 'string' ? error.code : 'unknown') };
    }
    return result;
  }
}
