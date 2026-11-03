import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
import { reviewProject } from './review';
import type { ReviewOptions } from './review';
import { mountProposalPreview } from './preview';
import type { ProposalPlayback } from './preview';

export default function ProposalPreview({ project, options, hasProjectContext=false }: { project: CreatorProject; options?: ReviewOptions; hasProjectContext?: boolean }) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const playback = useRef<ProposalPlayback | null>(null);
  const focused = useRef(false), frameRef = useRef(0);
  const [frame, setFrame] = useState(0), [draft, setDraft] = useState('0');
  const [playing, setPlaying] = useState(false), [reducedMotion, setReducedMotion] = useState(false);
  const [error, setError] = useState(false);
  const [size, setSize] = useState<64 | 128 | 512>(options?.targetSize ?? 64);
  const loop = options?.loop;
  const review = useMemo(() => reviewProject(project, { targetSize: size, loop }), [project, size, loop]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => {
      setReducedMotion(media.matches);
      if (media.matches) playback.current?.pause();
    };
    changed(); media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (!host.current) return;
    setError(false); setPlaying(false); frameRef.current = 0; setFrame(0); setDraft('0');
    let owned: ProposalPlayback | undefined;
    try {
      owned = mountProposalPreview(host.current, project, {
        loop,
        onFrame(next) { frameRef.current = next; setFrame(next); if (!focused.current) setDraft(String(next)); },
        onPlaying: setPlaying,
        onError() { setError(true); owned?.pause(); },
      });
      playback.current = owned;
    } catch { setError(true); }
    return () => { owned?.destroy(); playback.current = null; };
  }, [project, loop]);
  return <div className="cr-ai-preview" onKeyDown={event => event.stopPropagation()}>
    <h4>Proposal preview</h4>
    <div className="cr-ai-preview-scroll" tabIndex={0} role="region" aria-label="Proposal artboard">
      <div className="cr-ai-preview-host" data-testid="ai-proposal-preview" ref={host} style={{ width: size, height: size }} />
    </div>
    {error && <p role="status">Proposal preview could not render. Keep editing or adjust the brief and regenerate. No changes have been applied.</p>}
    <div className="cr-ai-preview-controls">
      <label className="cr-ai-field"><span>Proposal frame</span><input aria-label="Proposal frame" type="number" min={0} max={project.durationFrames - 1} step={1} value={draft}
        onFocus={() => { focused.current = true; playback.current?.pause(); }}
        onBlur={() => { focused.current = false; setDraft(String(frameRef.current)); }}
        onChange={event => { const value = event.target.value; setDraft(value); if (value !== '') playback.current?.seek(Number(value)); }} /></label>
      <label className="cr-ai-field"><span>Proposal size</span><select aria-label="Proposal size" value={size} onChange={event => setSize(Number(event.target.value) as 64 | 128 | 512)}>{([64, 128, 512] as const).map(value => <option key={value} value={value}>{value} px</option>)}</select></label>
      <button type="button" disabled={error || (!playing && reducedMotion)} aria-describedby={`${id}-motion`} onClick={() => playing ? playback.current?.pause() : playback.current?.play()}>{playing ? 'Pause proposal' : 'Play proposal'}</button>
      <span className="cr-ai-note">Frame {frame} / {project.durationFrames - 1}</span>
    </div>
    <p className="cr-ai-note" id={`${id}-motion`}>{reducedMotion ? 'Reduced motion is enabled. Preview stays paused; use Proposal frame to inspect poses.' : 'Starts paused. Preview controls do not change your editor.'} {loop === true ? 'Loop intent from submitted brief: repeat playback.' : loop === false ? 'Event intent from submitted brief: stop at the final pose.' : 'Loop intent not established: stop at the final pose.'}</p>
    <section className="cr-ai-review" aria-labelledby={`${id}-review`}>
      <h4 id={`${id}-review`}>{review.warnings.length ? 'Review needed' : 'No numeric issues detected'}</h4>
      <p>Not an artistic approval. Numeric checks cover {review.sampledFrames} sampled frames at {size} px, not every frame or pixel. Inspect composition, motion and small-size readability yourself.</p>
      {review.warnings.length > 0 && <ul>{review.warnings.map(warning => <li key={`${warning.code}:${warning.layerId ?? ''}`} data-review-code={warning.code}>{warning.layerId && <strong>Layer {project.layers.findIndex(layer => layer.id === warning.layerId) + 1}: </strong>}{warning.message}{warning.frame !== undefined && <span> Sampled frame {warning.frame}.</span>}</li>)}</ul>}
      <p>Review the preview and warnings. To request changes, edit Animation brief, give new consent, then Generate proposal again. {hasProjectContext?'Refinement sends the separately consented project snapshot with your brief and display size. Preview images and warnings are not sent.':'Only the revised brief is sent; the model does not see this preview or your current project.'} No automatic repair is performed.</p>
    </section>
  </div>;
}
