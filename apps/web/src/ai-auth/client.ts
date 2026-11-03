export type ClaudeState = 'not_installed' | 'signed_in' | 'signed_out' | 'unknown' | 'cli_update_required';
export type ClaudeStatus = { ok: true; provider: 'claude'; installed: boolean; state: ClaudeState; loginMethod: 'terminal' | 'manual'; scope: 'cli-reported'; inferenceVerified: false };
type Transport = (url: string, init?: RequestInit) => Promise<Response>;
export const LOGIN_COMMAND = 'claude auth login --claudeai';
const INVALID = '로그인 상태를 확인하지 못했어요. 로컬 브리지를 확인한 뒤 다시 확인해 주세요.';
export class ClaudeAuthError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function keys(value: Record<string, unknown>, expected: string[]) { return Object.keys(value).sort().join(',') === expected.sort().join(','); }
export class ClaudeAuthClient {
  constructor(private readonly transport: Transport = (url, init) => globalThis.fetch(url, init)) {}
  private async request(path: 'status' | 'login', signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectAbort!: (error: ClaudeAuthError) => void;
    const cancelled = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const abort = () => { controller.abort(); rejectAbort(new ClaudeAuthError('cancelled', INVALID)); };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (signal?.aborted) throw new Error();
      return await Promise.race([
        cancelled,
        (async () => {
          const response = await this.transport(`/api/ai/auth/claude/${path}`, { method: path === 'login' ? 'POST' : 'GET', ...(path === 'login' ? { body: JSON.stringify({ consent: true }) } : {}), credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-Moro-Request': '1' }, signal: controller.signal });
          const text = await response.text();
          if (text.length > 8192) throw new ClaudeAuthError('invalid_response', INVALID);
          const value: unknown = JSON.parse(text);
          if (response.status !== (path === 'login' ? 202 : 200)) {
            const code = record(value) && record(value.error) && typeof value.error.code === 'string' ? value.error.code : '';
            const messages: Record<string, string> = {
              invalid_request: '로그인 요청을 확인하지 못했어요.', consent_required: '공식 로그인 시작에 별도 동의가 필요해요.',
              busy: '생성이 진행 중이에요. 완료 후 다시 시도해 주세요.', auth_handoff_pending: '이미 터미널 열기를 요청했어요. 잠시 후 직접 확인해 주세요.',
              provider_unavailable: 'Claude CLI가 설치되어 있지 않아요.', manual_login_required: '이 환경에서는 터미널에서 직접 로그인해 주세요.',
              terminal_handoff_failed: '터미널을 열지 못했어요. 브리지 실행 기기의 권한을 확인해 주세요.',
              terminal_handoff_unconfirmed: '터미널 열기를 확인하지 못했어요. 자동 재시도하지 않아요. 브리지 실행 기기에서 확인해 주세요.',
            };
            const statusCodes: Record<string, number> = { invalid_request:400, consent_required:400, busy:409, auth_handoff_pending:409, provider_unavailable:503, manual_login_required:501, terminal_handoff_failed:502, terminal_handoff_unconfirmed:504 };
            throw new ClaudeAuthError(statusCodes[code] === response.status ? code : 'invalid_response', statusCodes[code] === response.status ? messages[code] : INVALID);
          }
          return value;
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ClaudeAuthError('bridge_unavailable', INVALID)); }, 10000); }),
      ]);
    } catch (error) {
      if (error instanceof ClaudeAuthError) throw error;
      throw new ClaudeAuthError('bridge_unavailable', INVALID);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  async login(consent: boolean, signal?: AbortSignal): Promise<void> {
    if (consent !== true) throw new ClaudeAuthError('consent_required', '공식 로그인 시작에 별도 동의가 필요해요.');
    const value = await this.request('login', signal);
    if (!record(value) || !keys(value, ['ok','provider','handoff','authenticationVerified']) || value.ok !== true || value.provider !== 'claude' || value.handoff !== 'terminal_requested' || value.authenticationVerified !== false) throw new ClaudeAuthError('invalid_response', INVALID);
  }
  async status(signal?: AbortSignal): Promise<ClaudeStatus> {
    const value = await this.request('status', signal);
    if (!record(value) || !keys(value, ['ok','provider','installed','state','loginMethod','scope','inferenceVerified']) || value.ok !== true || value.provider !== 'claude' || typeof value.installed !== 'boolean' || !['not_installed','signed_in','signed_out','unknown','cli_update_required'].includes(String(value.state)) || !['terminal','manual'].includes(String(value.loginMethod)) || value.scope !== 'cli-reported' || value.inferenceVerified !== false || (value.state === 'not_installed') !== !value.installed) throw new ClaudeAuthError('invalid_response', INVALID);
    return value as ClaudeStatus;
  }
}
