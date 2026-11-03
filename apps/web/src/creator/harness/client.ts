import { safeError } from '../ai/client';
import type { Fetcher } from '../ai/client';
import { STAGES, validateReport } from './report';
import type { HarnessTask } from './report';
export type Preflight = { status: 'ready' | 'blocked'; blockers: string[]; artisticReview: 'not_reviewed'; modelCalls: 0; callBudget: 7 };
const INVALID = 'The harness response was invalid. Your animation is unchanged.';
const TRANSPORT = 'The local AI bridge did not respond. Retry or keep editing.';
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID);
  return value as Record<string, unknown>;
}
export function checkedTask(task: HarnessTask): HarnessTask {
  if (!['codex', 'claude'].includes(task.provider) || !['ui-motion', 'human-character'].includes(task.domain) || typeof task.brief !== 'string' || !task.brief.trim() || task.brief.length > 4000) throw new Error('Choose a provider and write a brief of 1–4000 characters including display context.');
  return { provider: task.provider, brief: task.brief.trim(), domain: task.domain };
}
function jobId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(value)) throw new Error(INVALID);
  return value;
}
export type HarnessJob = { id: string; status: 'running' | 'succeeded' | 'failed' | 'cancelled'; stage?: string; review?: import('./report').Review; message?: string };
export class HarnessClient {
  async poll(id: string, task: HarnessTask): Promise<HarnessJob> {
    const job = object((await this.request(`/api/ai/jobs/${encodeURIComponent(jobId(id))}`)).job);
    if (job.id !== id || job.kind !== 'harness' || job.provider !== task.provider || !['running', 'succeeded', 'failed', 'cancelled'].includes(String(job.status)) || (job.stage !== undefined && !(STAGES as readonly unknown[]).includes(job.stage))) throw new Error(INVALID);
    const result: HarnessJob = { id, status: job.status as HarnessJob['status'], ...(typeof job.stage === 'string' ? { stage: job.stage } : {}) };
    if (result.status === 'succeeded') result.review = validateReport(job.report, checkedTask(task));
    if (result.status === 'failed') { const error = object(job.error); result.message = safeError(typeof error.code === 'string' ? error.code : 'unknown'); }
    return result;
  }
  async cancel(id: string): Promise<HarnessJob['status']> {
    const job = object((await this.request(`/api/ai/jobs/${encodeURIComponent(jobId(id))}/cancel`, {})).job);
    if (job.id !== id || !['running', 'succeeded', 'failed', 'cancelled'].includes(String(job.status))) throw new Error(INVALID);
    return job.status as HarnessJob['status'];
  }
  constructor(readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {}
  private async request(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const work = async () => {
      let response: Response;
      try { response = await this.fetcher(path, { method: body === undefined ? 'GET' : 'POST', signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-Moro-Request': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
      catch { throw new Error(TRANSPORT); }
      let data: Record<string, unknown>;
      try {
        const text = await response.text();
        if (new TextEncoder().encode(text).length > 1024 * 1024) throw new Error();
        data = object(JSON.parse(text));
      } catch { throw new Error(INVALID); }
      if (!response.ok || data.ok !== true) {
        const code = data.error && object(data.error).code;
        throw new Error(safeError(typeof code === 'string' ? code : 'unknown'));
      }
      return data;
    };
    try {
      return await Promise.race([work(), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error(TRANSPORT)); }, 10000);
      })]);
    } finally { clearTimeout(timer); }
  }
  async preflight(input: HarnessTask): Promise<Preflight> {
    const task = checkedTask(input);
    const data = object((await this.request('/api/ai/harness/preflight', task)).preflight);
    if ((data.status !== 'ready' && data.status !== 'blocked') || data.artisticReview !== 'not_reviewed' || data.modelCalls !== 0 || data.callBudget !== 7 || !Array.isArray(data.blockers) || data.blockers.length > 20 || !data.blockers.every(value => typeof value === 'string' && value.length <= 1000) || (data.status === 'ready' && (data.blockers.length || task.domain === 'human-character'))) throw new Error(INVALID);
    return { status: data.status, blockers: data.blockers as string[], artisticReview: 'not_reviewed', modelCalls: 0, callBudget: 7 };
  }
  async start(input: HarnessTask, consent: boolean): Promise<string> {
    const task = checkedTask(input);
    if (consent !== true || task.domain !== 'ui-motion') throw new Error('Explicit seven-call consent and a supported domain are required.');
    const job = object((await this.request('/api/ai/harness/jobs', { ...task, consent: true, callBudget: 7 })).job);
    if (job.status !== 'running' || job.kind !== 'harness' || job.provider !== task.provider) throw new Error(INVALID);
    return jobId(job.id);
  }
}
