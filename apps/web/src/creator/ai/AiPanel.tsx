import { useEffect, useId, useMemo, useRef, useState } from 'react';
import ClaudeConnection from '../../ai-auth/ClaudeConnection';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
import { AiClient } from './client';
import type { Provider, ProviderId } from './client';
import { AiSession } from './session';
import type { SessionState } from './session';
import ProposalPreview from './ProposalPreview';
import './ai.css';
import './refinement.css';
import { TARGET_DISPLAY_SIZES, briefLimitForTarget, composeTargetBrief } from './target-context';
import type { TargetDisplaySize } from './target-context';
import { prepareProjectContext, projectDelta, projectSignature } from './project-context';
import { saveMotion } from '../library/store';

const LABELS = { codex: 'Codex', claude: 'Claude Code' };
export default function AiPanel({ onApply, currentProject }: { onApply: (project: CreatorProject, baseProject?: CreatorProject) => unknown; currentProject?: CreatorProject }) {
  const id = useId();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [checking, setChecking] = useState(true);
  const [setup, setSetup] = useState('');
  const [provider, setProvider] = useState<ProviderId>('codex');
  const [brief, setBrief] = useState('');
  const [targetSize, setTargetSize] = useState<TargetDisplaySize>(64);
  const briefLimit = briefLimitForTarget(targetSize);
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<'new'|'refine'>('new');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const contextProblem=useMemo(()=>{
    if(mode!=='refine')return '';
    if(!currentProject)return 'Open a project before refining it.';
    try{prepareProjectContext(currentProject);return '';}catch(error){return error instanceof Error?error.message:'This project cannot be sent for refinement.';}
  },[mode,currentProject]);
  useEffect(()=>{if(mode==='refine')setConsent(false);},[mode,currentProject]);
  const [state, setState] = useState<SessionState>({ phase: 'idle', active: false });
  const session = useRef<AiSession | null>(null);
  const client = useRef<AiClient | null>(null);
  const statusVersion = useRef({ version: 0 });
  const refresh = async () => {
    const version = ++statusVersion.current.version;
    setChecking(true); setSetup('');
    try {
      const result = await client.current!.status();
      if (version === statusVersion.current.version) setProviders(result);
    } catch {
      if (version === statusVersion.current.version) { setProviders([]); setSetup('Local AI bridge unavailable. Your editor still works. Start the local AI bridge, open its loopback address and retry.'); }
    } finally { if (version === statusVersion.current.version) setChecking(false); }
  };
  useEffect(() => {
    const lifecycle = statusVersion.current;
    const api = new AiClient(); client.current = api;
    const owned = new AiSession(api, setState); session.current = owned;
    void refresh();
    return () => { ++lifecycle.version; owned.dispose(); session.current = null; client.current = null; };
  }, []);
  const installed = providers.find(item => item.id === provider)?.installed === true;
  const canGenerate = !checking && !setup && installed && consent && !!brief.trim() && brief.length <= briefLimit && !state.active && !contextProblem;
  const project = state.project;
  const delta=useMemo(()=>state.baseProject&&project?projectDelta(state.baseProject,project):null,[state.baseProject,project]);
  const stale=!!state.baseProject&&(!currentProject||projectSignature(state.baseProject)!==projectSignature(currentProject));
  const unchanged=!!delta&&!delta.added.length&&!delta.removed.length&&!delta.changed.length&&!delta.settingsChanged&&!delta.orderChanged;
  useEffect(()=>{setSaving(false);setSaveMessage('');},[project]);
  const saveProposal=async()=>{
    if(!project||saving)return;setSaving(true);setSaveMessage('');
    try{await saveMotion({project,origin:'ai',provider:state.provider,brief:state.submittedBrief});if(session.current?.state.project===project)setSaveMessage('Saved on this device. Open Motion library to reuse it.');}
    catch(error){if(session.current?.state.project===project)setSaveMessage(error instanceof Error?error.message:'Could not save locally. Your editor is unchanged.');}
    finally{if(session.current?.state.project===project)setSaving(false);}
  };
  return <section className="cr-ai" aria-labelledby={`${id}-title`}>
    <header className="cr-ai-heading"><div><h2 id={`${id}-title`}>Your AI</h2><p>Create a motion, or refine the project you choose to share.</p></div><span className="cr-ai-badge">Optional · CLI</span></header>
    <p className="cr-ai-note">{mode==='new'?'Only your brief and selected display size are sent to the selected AI provider. No current project is uploaded.':'Refinement sends your brief, display size and a snapshot of the current project, only after separate consent.'} Nothing changes until you apply a proposal.</p>
    {setup && <div className="cr-ai-setup" role="status"><strong>Keep creating. Connect AI when ready.</strong><p>{setup}</p><code>moro-ai-bridge --web-root /path/to/dist --port 4174</code></div>}
    <form onSubmit={event => { event.preventDefault(); if (canGenerate) { setConsent(false); void session.current?.generate(provider, composeTargetBrief(brief, targetSize), consent, mode==='refine'&&currentProject?{project:currentProject,consent}:undefined); } }}>
      <label className="cr-ai-field"><span>AI mode</span><select aria-label="AI mode" value={mode} disabled={state.active} onChange={event=>{setMode(event.target.value as 'new'|'refine');setConsent(false);}}><option value="new">New motion</option><option value="refine" disabled={!currentProject?.layers.length}>Refine current project</option></select></label>
      {mode==='refine'&&<p className="cr-ai-note">Current project: {currentProject?.name} · {currentProject?.layers.length??0} layers. Names, shapes, colors, dimensions and keyframes will be sent. Maximum 20 layers / 64 KiB. Review for sensitive data; the repository and files are not sent.</p>}
      {contextProblem&&<p className="cr-ai-setup" role="status">{contextProblem}</p>}
      <div className="cr-ai-provider-row"><label className="cr-ai-field"><span>AI provider</span><select aria-label="AI provider" value={provider} disabled={state.active} onChange={event => { setProvider(event.target.value as ProviderId); setConsent(false); }}>
        {(['codex', 'claude'] as const).map(key => <option key={key} value={key}>{LABELS[key]}{checking ? ' — checking' : providers.find(item => item.id === key)?.installed ? ' — installed' : ' — not detected'}</option>)}
      </select></label><button type="button" disabled={checking || state.active} onClick={() => { void refresh(); }}>Check CLI status</button></div>
      {provider === 'claude' && <ClaudeConnection disabled={state.active} />}
      <p className="cr-ai-note" role="status">{checking && 'Checking local CLI installation… '}Installed does not mean logged in or inference verified. Use your existing CLI login. Billing and quota follow that CLI account.</p>
      {!checking && !setup && !installed && <p className="cr-ai-setup">{LABELS[provider]} was not detected. Install and sign in to the official CLI yourself, then check status. No API key is needed here.</p>}
      <label className="cr-ai-field"><span>Target display size</span><select aria-label="Target display size" aria-describedby={`${id}-target-help`} value={targetSize} disabled={state.active} onChange={event => { setTargetSize(Number(event.target.value) as TargetDisplaySize); setConsent(false); }}>{TARGET_DISPLAY_SIZES.map(size => <option key={size} value={size}>{size} px</option>)}</select></label>
      <p id={`${id}-target-help`} className="cr-ai-note">The selected display size is sent with your brief as a Design target header, not canvas dimensions. Changing it requires new consent. No preview or warnings are sent. The current project is sent only in refinement mode with your explicit consent.</p>
      <label className="cr-ai-field"><span>Animation brief <span className="cr-ai-count">{brief.length}/{briefLimit}</span></span><textarea aria-label="Animation brief" placeholder="A small teal circle glides across the canvas, then gently settles." value={brief} maxLength={4000} rows={3} disabled={state.active} onChange={event => { setBrief(event.target.value); setConsent(false); }} aria-describedby={`${id}-brief-help`} /></label>
      <p id={`${id}-brief-help`} className="cr-ai-note">Maximum {briefLimit} brief characters ({Math.max(0, briefLimit - brief.length)} remaining); the complete message including target context is limited to 4000. {brief.length > briefLimit && 'Brief is too long for this target. Shorten it before generating. '}Describe shapes, timing and movement. Do not include secrets or personal information.</p>
      <label className="cr-ai-consent"><input type="checkbox" checked={consent} disabled={state.active} onChange={event => setConsent(event.target.checked)} /><span>{mode==='refine'?'I agree to send this brief and the current project to the selected AI provider.':'I agree to send this brief to the selected AI provider.'}</span></label>
      <div className="cr-ai-actions"><button className="cr-primary" type="submit" disabled={!canGenerate}>Generate proposal</button>{state.active && <button type="button" disabled={state.phase === 'cancelling'} onClick={() => { void session.current?.cancel(); }}>Cancel generation</button>}</div>
    </form>
    <div className="cr-ai-status" role="status" aria-live="polite">{state.phase === 'running' ? `Generating with ${LABELS[state.provider!]}. Your animation is unchanged.` : state.phase === 'cancelling' ? 'Cancelling generation… No proposal will be applied.' : state.phase === 'applied' ? 'Proposal applied. Use Undo to restore your previous animation.' : state.message}</div>
    {state.phase === 'ready' && project && <div className="cr-ai-proposal">
      <span className="cr-ai-eyebrow">Proposal · {LABELS[state.provider!]}</span><h3>{project.name}</h3>
      {state.submittedBrief && <details><summary>Submitted brief</summary><p>{state.submittedBrief}</p></details>}
      <ProposalPreview project={project} options={state.reviewOptions} hasProjectContext={!!state.baseProject} />
      <dl><div><dt>Layers</dt><dd>{project.layers.length}</dd></div><div><dt>Frame rate</dt><dd>{project.fps} fps</dd></div><div><dt>Duration</dt><dd>{Number((project.durationFrames / project.fps).toFixed(2))} s · {project.durationFrames} frames</dd></div><div><dt>Canvas</dt><dd>{project.width} × {project.height}</dd></div></dl>
      {delta&&<section className="cr-ai-diff" aria-label="Refinement changes"><h4>Changes from submitted project</h4><p>{delta.changed.length} changed · {delta.added.length} added · {delta.removed.length} removed layers</p>{delta.settingsChanged&&<p>Project settings changed.</p>}{delta.orderChanged&&<p>Layer order or membership changed.</p>}<details><summary>Layer change details</summary><ul>{(['changed','added','removed'] as const).flatMap(kind=>delta[kind].map(layerId=><li key={`${kind}-${layerId}`}>{kind}: {(kind==='removed'?state.baseProject!:project).layers.find(l=>l.id===layerId)?.name??layerId} <code>{layerId}</code></li>))}</ul></details><p>Structural differences are not a quality judgment. Check for unrequested changes before applying.</p></section>}
      {stale&&<p className="cr-ai-setup" role="status">Your current project changed after this request. Undo those changes or generate a fresh refinement before applying.</p>}
      {unchanged&&<p className="cr-ai-note">No changes proposed. Keep your current animation or update the brief.</p>}
      <p>{state.baseProject?'This refines the submitted project.':'This is a new project.'} Apply replaces your current animation as one edit. One Undo restores your previous animation.</p>
      <div className="cr-ai-actions"><button className="cr-primary" type="button" disabled={stale||unchanged} onClick={() => session.current?.apply(onApply,currentProject)}>Apply proposal</button><button type="button" disabled={saving} onClick={()=>{void saveProposal();}}>{saving?'Saving locally…':'Save proposal locally'}</button></div>
      {saveMessage&&<p className="cr-ai-note" role="status">{saveMessage}</p>}
    </div>}
  </section>;
}
