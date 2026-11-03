import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './auth.css';
import { ClaudeAuthClient, ClaudeAuthError, LOGIN_COMMAND, type ClaudeState } from './client';
const STATES: Record<ClaudeState, string> = {
  signed_in: 'CLI 로그인 정보가 있어요', signed_out: 'Claude 로그인이 필요해요', unknown: '로그인 상태를 확인하지 못했어요',
  not_installed: 'Claude CLI가 설치되어 있지 않아요', cli_update_required: 'Claude CLI 업데이트가 필요해요',
};
function LoginConsent({ close, confirm }: { close: () => void; confirm: () => void }) {
  const id = useId(), ref = useRef<HTMLDialogElement>(null), submitted = useRef(false);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog className="moro-claude-auth-dialog" ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()}>
    <h2 id={id}>Claude 공식 로그인 확인</h2>
    <p>로컬 브리지가 실행되는 기기에서 Terminal과 공식 브라우저 로그인을 열어요. macOS에서 자동화(Automation) 권한 승인을 요청할 수 있어요.</p>
    <p>인증은 공식 Claude CLI가 관리해요. 인증 코드·토큰·로그인 URL은 Moro에 입력하지 마세요. 필요하면 공식 터미널·브라우저에서만 입력해 주세요.</p>
    <p>로그인은 프로젝트·브리프를 전송하거나 생성을 시작하지 않아요. 이후 생성에는 선택한 제공자 계정의 요금·사용량 한도가 적용돼요.</p>
    <label className="moro-claude-auth-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />이 기기에서 공식 CLI 로그인을 여는 데 동의해요.</label>
    <div className="moro-claude-auth-actions"><button type="button" onClick={close}>취소</button><button type="button" disabled={!consent} onClick={() => { if (!consent || submitted.current) return; submitted.current = true; confirm(); }}>공식 로그인 시작</button></div>
  </dialog>, document.body);
}
export default function ClaudeConnection({ disabled = false }: { disabled?: boolean }) {
  const [message, setMessage] = useState('로그인 상태는 직접 확인해 주세요.');
  const [busy, setBusy] = useState(false), [dialog, setDialog] = useState(false);
  const [manual, setManual] = useState(false);
  const lifecycle = useRef({ version: 0 });
  const pending = useRef<AbortController | null>(null);
  const locked = useRef(disabled); locked.current = disabled;
  useEffect(() => { const owned = lifecycle.current; return () => { ++owned.version; pending.current?.abort(); }; }, []);
  useEffect(() => { if (disabled) setDialog(false); }, [disabled]);
  async function request(kind: 'status' | 'login') {
    if (locked.current || pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    const version = ++lifecycle.current.version; setBusy(true); setDialog(false);
    try {
      const client = new ClaudeAuthClient();
      if (kind === 'status') { const result = await client.status(controller.signal); if (version === lifecycle.current.version) { setMessage(STATES[result.state]); setManual(result.loginMethod === 'manual'); } }
      else { await client.login(true, controller.signal); if (version === lifecycle.current.version) setMessage('터미널 열기를 요청했어요. 로그인 성공은 아직 확인하지 않았어요. 공식 터미널·브라우저에서 완료한 뒤 로그인 상태를 직접 확인해 주세요.'); }
    } catch (error) { if (version === lifecycle.current.version) { setMessage(kind === 'status' ? STATES.unknown : error instanceof ClaudeAuthError ? error.message : '로그인을 시작하지 못했어요. 로컬 브리지를 확인해 주세요.'); setManual(error instanceof ClaudeAuthError && ['bridge_unavailable', 'manual_login_required'].includes(error.code)); } }
    finally { if (version === lifecycle.current.version) { pending.current = null; setBusy(false); } }
  }
  async function copyCommand() {
    if (locked.current || pending.current) return;
    const version = lifecycle.current.version;
    try { await navigator.clipboard.writeText(LOGIN_COMMAND); if (version === lifecycle.current.version) setMessage('공개 로그인 명령만 복사했어요. 브리지를 실행하는 기기의 터미널에서 직접 실행해 주세요.'); }
    catch { if (version === lifecycle.current.version) setMessage('복사하지 못했어요. 표시된 공개 명령을 직접 복사해 주세요.'); }
  }
  return <section className="moro-claude-auth" aria-label="Claude 연결" onKeyDown={event => event.stopPropagation()}>
    <p role="status" aria-live="polite">{message}</p>
    <p>CLI가 보고한 로그인 정보만 확인해요. 토큰 만료·다음 생성 성공 여부는 확인하지 않아요. 다시 로그인할 수 있어요.</p>
    <div className="moro-claude-auth-actions"><button type="button" disabled={disabled || busy} onClick={() => { if (!locked.current && !pending.current) setDialog(true); }}>Claude 로그인</button><button type="button" disabled={disabled || busy} onClick={() => void request('status')}>로그인 상태 확인</button></div>
    {manual && <div className="moro-claude-auth-manual"><p>자동으로 연결할 수 없으면 브리지를 실행하는 기기의 공식 CLI에서 직접 로그인해 주세요. 이 명령은 로그인 성공을 확인하지 않아요.</p><code>{LOGIN_COMMAND}</code><button type="button" disabled={disabled || busy} onClick={() => void copyCommand()}>로그인 명령 복사</button></div>}
    {dialog && !disabled && <LoginConsent close={() => setDialog(false)} confirm={() => void request('login')} />}
  </section>;
}
