import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { AnimationItem } from 'lottie-web';
import {
  createProject, addLayer, updateLayer, removeLayer, duplicateLayer, moveLayer,
  setKeyframe, removeKeyframe, sampleLayer, serializeProject, parseProject, exportLottie,
} from '../../../../packages/creator-core/src';
import type { CreatorProject, Property, Easing, ShapeType } from '../../../../packages/creator-core/src';
import { createPlayer } from '../../../../packages/player-adapter/src';
import { createHistory, commitHistory, undoHistory, redoHistory, beginGesture, endGesture, cancelGesture } from './history';
import './creator.css';
import { projectSignature } from './ai/project-context';

const AiPanel = lazy(() => import('./ai/AiPanel'));
const HarnessPanel = lazy(() => import('./harness/HarnessPanel'));
const MotionLibrary = lazy(() => import('./library/MotionLibrary'));
const PROPERTIES: { key: Property; label: string; input: string; min: number; max: number; unit: string }[] = [
  { key: 'x', label: 'X', input: 'X position', min: -8192, max: 8192, unit: 'px' },
  { key: 'y', label: 'Y', input: 'Y position', min: -8192, max: 8192, unit: 'px' },
  { key: 'scale', label: 'Scale', input: 'Scale', min: 1, max: 1000, unit: '%' },
  { key: 'rotation', label: 'Rotation', input: 'Rotation', min: -3600, max: 3600, unit: '°' },
  { key: 'opacity', label: 'Opacity', input: 'Opacity', min: 0, max: 100, unit: '%' },
];
const EASINGS: Easing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];
const rounded = (value: number) => Math.round(value * 100) / 100;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'This change could not be applied.';
function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function filename(name: string) { return name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'untitled-motion'; }

function NumberField({ label, value, min, max, unit, onCommit }: {
  label: string; value: number; min: number; max: number; unit?: string; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(rounded(value)));
  const cancelled = useRef(false);
  useEffect(() => setDraft(String(rounded(value))), [value]);
  return <label className="cr-field"><span>{label}</span><span className="cr-number-wrap">
    <input aria-label={label} type="number" step="any" min={min} max={max} value={draft}
      onChange={event => setDraft(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancelled.current = true; setDraft(String(rounded(value))); event.currentTarget.blur(); } }}
      onBlur={() => { if (cancelled.current) { cancelled.current = false; return; } if (draft.trim() === '') { setDraft(String(rounded(value))); return; } onCommit(Number(draft)); }} />
    {unit && <span className="cr-unit">{unit}</span>}
  </span></label>;
}
function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <label className="cr-field"><span>{label}</span><span className="cr-color-wrap">
    <span aria-hidden="true" className="cr-swatch" style={{ background: value }} />
    <input aria-label={label} value={draft} maxLength={7} spellCheck={false} onChange={event => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
  </span></label>;
}

function NewProjectDialog({ close, create }: { close: () => void; create: (options: Parameters<typeof createProject>[0]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="cr-dialog" ref={dialog} onCancel={close} onClose={close} aria-labelledby="cr-new-title">
    <form onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      try { create({ name: String(data.get('name')), width: Number(data.get('width')), height: Number(data.get('height')), fps: Number(data.get('fps')), durationFrames: Number(data.get('duration')) }); } catch (error) { setFailure(errorText(error)); }
    }}>
      <h2 id="cr-new-title">New animation</h2><p>A blank canvas. Your shapes, your motion.</p>
      {failure && <p className="cr-error" role="alert">{failure}</p>}
      <label className="cr-field"><span>Project name</span><input name="name" defaultValue="Untitled motion" required maxLength={120} autoFocus /></label>
      <div className="cr-field-grid">
        <label className="cr-field"><span>Canvas width</span><input name="width" type="number" min="16" max="4096" defaultValue="512" required /></label>
        <label className="cr-field"><span>Canvas height</span><input name="height" type="number" min="16" max="4096" defaultValue="512" required /></label>
        <label className="cr-field"><span>Frames per second</span><input name="fps" type="number" min="1" max="120" defaultValue="60" required /></label>
        <label className="cr-field"><span>Duration in frames</span><input name="duration" type="number" min="2" max="3600" defaultValue="120" required /></label>
      </div>
      <div className="cr-dialog-actions"><button type="button" onClick={close}>Cancel</button><button className="cr-primary" type="submit">Create blank animation</button></div>
    </form>
  </dialog>;
}

export default function Creator() {
  const [history, setHistory] = useState(() => createHistory(createProject()));
  const project = history.present;
  const projectRef = useRef(project); projectRef.current = project;
  const [saved, setSaved] = useState(() => serializeProject(project));
  const dirty = serializeProject(project) !== saved;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = project.layers.find(layer => layer.id === selectedId);
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(frame); frameRef.current = frame;
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showHarness, setShowHarness] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [activeKey, setActiveKey] = useState<{ layer: string; property: Property; frame: number } | null>(null);
  const inputFile = useRef<HTMLInputElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<AnimationItem | null>(null);
  const drag = useRef<{ id: string; pointer: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const animation = useMemo(() => exportLottie(project), [project]);
  const sampled = selected ? sampleLayer(selected, frame) : null;
  const currentKey = activeKey ? project.layers.find(layer => layer.id === activeKey.layer)?.tracks[activeKey.property]?.find(key => key.frame === activeKey.frame) : undefined;

  const apply = useCallback((change: (current: CreatorProject) => CreatorProject) => {
    try {
      const next = change(projectRef.current);
      projectRef.current = next;
      setHistory(current => commitHistory(current, next));
      setError('');
      return next;
    } catch (failure) { setError(errorText(failure)); return null; }
  }, []);
  const undo = useCallback(() => { setPlaying(false); setHistory(current => { const next = undoHistory(current); projectRef.current = next.present; return next; }); setActiveKey(null); }, []);
  const redo = useCallback(() => { setPlaying(false); setHistory(current => { const next = redoHistory(current); projectRef.current = next.present; return next; }); setActiveKey(null); }, []);
  const seek = (value: number) => { if (Number.isFinite(value)) { setPlaying(false); setFrame(Math.max(0, Math.min(project.durationFrames - 1, Math.round(value)))); } };

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); };
    media.addEventListener('change', changed); return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable], dialog') || drag.current) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      else if (event.code === 'Space' && target.tagName !== 'BUTTON') { event.preventDefault(); setPlaying(value => !value); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [undo, redo]);
  useEffect(() => {
    if (!host.current) return;
    let live = true;
    const item = createPlayer(host.current, animation, () => { if (live) setError('Lottie preview could not render. Your project is still editable.'); }, () => { if (live) item.goToAndStop(frameRef.current, true); });
    player.current = item;
    item.goToAndStop(frameRef.current, true);
    return () => { live = false; item.destroy(); player.current = null; };
  }, [animation]);
  useEffect(() => { player.current?.goToAndStop(frame, true); }, [frame]);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now(); const initial = frameRef.current; let request = 0;
    const tick = (now: number) => {
      const next = Math.floor(initial + (now - start) * project.fps / 1000) % project.durationFrames;
      setFrame(next); request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick); return () => cancelAnimationFrame(request);
  }, [playing, project.fps, project.durationFrames]);

  function add(type: ShapeType) {
    setPlaying(false);
    const next = apply(current => addLayer(current, type));
    if (next) { setSelectedId(next.layers.at(-1)!.id); setActiveKey(null); }
  }
  function editProperty(property: Property, value: number) {
    if (!selected) return;
    apply(current => selected.tracks[property]?.length
      ? setKeyframe(current, selected.id, property, frame, value, selected.tracks[property]?.find(key => key.frame === frame)?.easing ?? 'linear')
      : updateLayer(current, selected.id, { [property]: value }));
  }
  function addKey(property: Property) {
    if (!selected || !sampled) return;
    if (apply(current => setKeyframe(current, selected.id, property, frame, sampled[property], selected.tracks[property]?.find(key => key.frame === frame)?.easing ?? 'linear'))) {
      setActiveKey({ layer: selected.id, property, frame }); setMessage(`${PROPERTIES.find(item => item.key === property)!.label} keyframe set at frame ${frame}.`);
    }
  }
  function confirmDiscard() { return !dirty || window.confirm('Discard unsaved changes to this animation? Save your project first to keep an editable copy.'); }
  function reset(next: CreatorProject) {
    setPlaying(false); setHistory(createHistory(next)); projectRef.current = next; setSaved(serializeProject(next)); setSelectedId(null); setActiveKey(null); setFrame(0); setError('');
  }
  async function openProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Project file is too large (maximum 8 MB).');
      const next = parseProject(await file.text());
      if (!confirmDiscard()) return;
      reset(next); setMessage(`Opened ${file.name}.`);
    } catch (failure) { setError(`Could not open project: ${errorText(failure)}`); }
  }
  function point(event: ReactPointerEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : new DOMPoint();
  }
  function startDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const id = (event.target as Element).closest('[data-layer-id]')?.getAttribute('data-layer-id');
    if (!id) { setSelectedId(null); return; }
    const layer = project.layers.find(item => item.id === id); if (!layer) return;
    setSelectedId(id); setPlaying(false); setActiveKey(null);
    const start = point(event); const value = sampleLayer(layer, frame);
    drag.current = { id, pointer: event.pointerId, startX: start.x, startY: start.y, x: value.x, y: value.y };
    setHistory(current => beginGesture(current));
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveDrag(event: ReactPointerEvent<SVGSVGElement>) {
    const gesture = drag.current; if (!gesture || gesture.pointer !== event.pointerId) return;
    const here = point(event);
    const x = rounded(Math.max(-8192, Math.min(8192, gesture.x + here.x - gesture.startX)));
    const y = rounded(Math.max(-8192, Math.min(8192, gesture.y + here.y - gesture.startY)));
    apply(current => {
      const layer = current.layers.find(item => item.id === gesture.id)!;
      let next = layer.tracks.x?.length ? setKeyframe(current, layer.id, 'x', frame, x, layer.tracks.x.find(key => key.frame === frame)?.easing ?? 'linear') : updateLayer(current, layer.id, { x });
      next = layer.tracks.y?.length ? setKeyframe(next, layer.id, 'y', frame, y, layer.tracks.y.find(key => key.frame === frame)?.easing ?? 'linear') : updateLayer(next, layer.id, { y });
      return next;
    });
  }
  function finishDrag(event: ReactPointerEvent<SVGSVGElement>, cancel = false) {
    if (!drag.current || drag.current.pointer !== event.pointerId) return;
    drag.current = null;
    setHistory(current => { const next = cancel ? cancelGesture(current) : endGesture(current); projectRef.current = next.present; return next; });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div className="moro-creator">
    <header className="cr-topbar">
      <a className="cr-brand" href="/" aria-label="Moro palette workbench"><svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28"><rect x="4" y="3" width="13" height="20" rx="6" fill="none" stroke="currentColor" strokeWidth="1.8" transform="rotate(-25 10 14)"/><rect x="11" y="5" width="13" height="20" rx="6" fill="none" stroke="currentColor" strokeWidth="1.8" transform="rotate(25 17 14)"/></svg>Moro</a>
      <span className="cr-mode">Create</span><a className="cr-workbench-link" href="/">Palette workbench ↗</a>
      <div className="cr-history"><button onClick={undo} disabled={!history.past.length} aria-label="Undo" title="Undo (⌘/Ctrl Z)">↶<span> Undo</span></button><button onClick={redo} disabled={!history.future.length} aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)">↷<span> Redo</span></button></div>
      <button className="cr-primary" onClick={() => { try { download(JSON.stringify(exportLottie(project), null, 2), `${filename(project.name)}.json`); setMessage('Lottie JSON download requested.'); } catch (failure) { setError(errorText(failure)); } }}>Export Lottie</button>
    </header>
    <main className="cr-sheet">
      <div className="cr-project-heading"><div><h1>{project.name}</h1><p>{project.width} × {project.height} <span>·</span> {project.fps} fps <span>·</span> {project.durationFrames} frames {dirty && <span className="cr-modified">Modified</span>}</p></div>
        <div className="cr-file-actions"><button aria-label="AI assistant" aria-expanded={showAi} onClick={() => { setShowHarness(false); setShowAi(value => !value); }}>AI assistant</button><button aria-label="Quality lab" aria-expanded={showHarness} title={showHarness ? 'Close Quality lab and cancel any owned pending run.' : 'Review optional bounded seven-stage proposals.'} onClick={() => { setShowAi(false); setShowHarness(value => !value); }}>Quality lab</button><button onClick={() => { if (confirmDiscard()) { setPlaying(false); setShowNew(true); } }}>New animation</button>
          <a className="cr-rig-entry" href="/rig">Rig lab</a>
          <button onClick={() => {setPlaying(false);setShowLibrary(true);}}>Motion library</button>
          <button onClick={() => inputFile.current?.click()}>Open project</button>
          <button onClick={() => { const text = serializeProject(project); download(text, `${filename(project.name)}.moro.json`); setSaved(text); setMessage('Editable project download requested.'); }}>Save project</button>
          <input className="cr-file-input" type="file" ref={inputFile} accept=".json,.moro,application/json" aria-label="Project file" onChange={openProject} />
        </div>
      </div>
      {error && <div className="cr-error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
      {showAi && <section aria-label="AI assistant"><Suspense fallback={<p role="status">Loading AI assistant…</p>}><AiPanel currentProject={project} onApply={(proposal,baseProject) => {
        if(baseProject&&projectSignature(baseProject)!==projectSignature(projectRef.current)){setError('Your project changed. Generate a fresh refinement before applying.');return false;}
        const next = apply(() => parseProject(serializeProject(proposal)));
        if (!next) return false;
        setPlaying(false); setFrame(0); setActiveKey(null); setSelectedId(next.layers[0]?.id ?? null); setShowAi(false);
        setMessage('AI proposal applied as one edit. Undo restores your previous animation.');return true;
      }} /></Suspense></section>}
      {showHarness && <section aria-label="Quality lab"><Suspense fallback={<p role="status">Loading Quality lab…</p>}><HarnessPanel currentProject={project} onApply={(proposal, baseProject) => {
        if (projectSignature(baseProject) !== projectSignature(projectRef.current)) { setError('Your project changed. Run a fresh review before applying a candidate.'); return false; }
        if (projectSignature(proposal) === projectSignature(projectRef.current)) return false;
        const next = apply(() => parseProject(serializeProject(proposal)));
        if (!next) return false;
        setPlaying(false); setFrame(0); setActiveKey(null); setSelectedId(next.layers[0]?.id ?? null); setShowHarness(false);
        setMessage('Reviewed candidate applied as one edit. Undo restores your previous animation.'); return true;
      }} /></Suspense></section>}
      <div className="cr-editor">
        <aside className="cr-layers" aria-labelledby="cr-layers-title">
          <div className="cr-section-heading"><h2 id="cr-layers-title">Layers</h2><span>{project.layers.length}</span></div>
          <div className="cr-add-shapes"><button onClick={() => add('rect')} disabled={project.layers.length >= 100}><span aria-hidden="true">▭</span> Add rectangle</button><button onClick={() => add('ellipse')} disabled={project.layers.length >= 100}><span aria-hidden="true">○</span> Add ellipse</button></div>
          {project.layers.length === 0 ? <p className="cr-panel-note">No layers yet.<br/>Add a shape to begin.</p> : <ul className="cr-layer-list" aria-label="Animation layers">{[...project.layers].reverse().map(layer => <li key={layer.id}><button aria-label={`Select ${layer.name}`} aria-pressed={selectedId === layer.id} onClick={() => { setSelectedId(layer.id); setActiveKey(null); }}><span className={`cr-shape-icon cr-shape-${layer.type}`} style={{ background: layer.fill }} aria-hidden="true"/><span>{layer.name}</span><span className="cr-layer-kind">{layer.type === 'rect' ? 'Rectangle' : 'Ellipse'}</span></button></li>)}</ul>}
          {selected && <div className="cr-layer-actions"><button aria-label="Move layer up" disabled={project.layers.at(-1)?.id === selected.id} onClick={() => apply(current => moveLayer(current, selected.id, 'up'))}>↑ Up</button><button aria-label="Move layer down" disabled={project.layers[0]?.id === selected.id} onClick={() => apply(current => moveLayer(current, selected.id, 'down'))}>↓ Down</button><button aria-label="Duplicate layer" disabled={project.layers.length >= 100} onClick={() => { const next = apply(current => duplicateLayer(current, selected.id)); if (next) setSelectedId(next.layers.at(-1)!.id); }}>Duplicate</button><button aria-label="Delete layer" onClick={() => { if (apply(current => removeLayer(current, selected.id))) { setSelectedId(null); setActiveKey(null); } }}>Delete</button></div>}
          <p className="cr-local-note">Local by design.<br/>Save a project to keep editing later.</p>
        </aside>
        <section className="cr-stage" aria-label="Animation canvas">
          <div className="cr-stage-heading"><span>Canvas</span><span>{project.width} × {project.height}</span></div>
          <div className="cr-canvas-area"><div className="cr-artboard" style={{ aspectRatio: `${project.width} / ${project.height}`, '--cr-ratio': project.width / project.height } as CSSProperties}>
            <div className="cr-player" data-testid="creator-preview" ref={host} aria-label="Exported Lottie preview" />
            {!project.layers.length && <div className="cr-canvas-empty"><span>Start with a shape.</span><p>Place it. Set a keyframe. Make it move.</p></div>}
            <svg className="cr-edit-overlay" data-testid="creator-canvas" viewBox={`0 0 ${project.width} ${project.height}`} aria-label="Shape selection and drag overlay" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)} onLostPointerCapture={event => finishDrag(event, true)}>
              {project.layers.map(layer => { const value = sampleLayer(layer, frame); const isSelected = selectedId === layer.id; return <g key={layer.id} data-layer-id={layer.id} transform={`translate(${value.x} ${value.y}) rotate(${value.rotation}) scale(${value.scale / 100})`}>
                {layer.type === 'rect' ? <rect x={-layer.width / 2} y={-layer.height / 2} width={layer.width} height={layer.height} fill="transparent" stroke="transparent" strokeWidth={Math.max(12, layer.strokeWidth)} /> : <ellipse rx={layer.width / 2} ry={layer.height / 2} fill="transparent" stroke="transparent" strokeWidth={Math.max(12, layer.strokeWidth)} />}
                {isSelected && <rect className="cr-selection" x={-layer.width / 2 - 2} y={-layer.height / 2 - 2} width={layer.width + 4} height={layer.height + 4} fill="none" stroke="#1B6C80" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
              </g>; })}
            </svg>
          </div></div>
          <div className="cr-canvas-caption"><span>{selected && sampled ? `${selected.name} · X ${rounded(sampled.x)} · Y ${rounded(sampled.y)}` : 'Select a layer to edit its properties.'}</span><span>SVG · Lottie preview</span></div>
        </section>
        <aside className="cr-inspector" aria-labelledby="cr-inspector-title"><div className="cr-section-heading"><h2 id="cr-inspector-title">{selected ? 'Shape properties' : 'Inspector'}</h2>{selected && <span>{selected.type === 'rect' ? 'Rectangle' : 'Ellipse'}</span>}</div>
          {!selected || !sampled ? <p className="cr-panel-note">Select a shape on the canvas or in Layers to edit it.</p> : <div key={selected.id}>
            <label className="cr-field cr-name"><span>Layer name</span><input aria-label="Layer name" value={selected.name} maxLength={120} onChange={event => apply(current => updateLayer(current, selected.id, { name: event.target.value }))} /></label>
            <div className="cr-field-grid"><NumberField label="Width" value={selected.width} min={1} max={4096} unit="px" onCommit={width => apply(current => updateLayer(current, selected.id, { width }))}/><NumberField label="Height" value={selected.height} min={1} max={4096} unit="px" onCommit={height => apply(current => updateLayer(current, selected.id, { height }))}/></div>
            {selected.type === 'rect' && <><NumberField label="Corner radius" value={selected.cornerRadius ?? 0} min={0} max={Math.min(selected.width, selected.height) / 2} unit="px" onCommit={cornerRadius => apply(current => updateLayer(current, selected.id, { cornerRadius }))}/><p className="cr-field-help">Maximum half the shorter side. Reduce Corner radius before shrinking below twice its value; invalid size changes are rejected, not clamped.</p></>}
            <h3>Transform <span>at frame {frame}</span></h3>
            <div className="cr-transform-fields">{PROPERTIES.map(property => <div className="cr-property-row" key={`${property.key}-${frame}`}><NumberField label={property.input} value={sampled[property.key]} min={property.min} max={property.max} unit={property.unit} onCommit={value => editProperty(property.key, value)} />
              <button className="cr-key-add" aria-label={`Add ${property.label} keyframe`} title={`Add ${property.label} keyframe at frame ${frame}`} aria-pressed={!!selected.tracks[property.key]?.some(key => key.frame === frame)} onClick={() => addKey(property.key)}>◇</button></div>)}</div>
            <p className="cr-field-help">◇ sets a keyframe. Animated values edit the current frame; unkeyed values edit the whole layer.</p>
            <h3>Appearance</h3><div className="cr-field-grid"><ColorField label="Fill" value={selected.fill} onCommit={fill => apply(current => updateLayer(current, selected.id, { fill }))}/><ColorField label="Stroke" value={selected.stroke} onCommit={stroke => apply(current => updateLayer(current, selected.id, { stroke }))}/></div>
            <NumberField label="Stroke width" value={selected.strokeWidth} min={0} max={100} unit="px" onCommit={strokeWidth => apply(current => updateLayer(current, selected.id, { strokeWidth }))}/>
          </div>}
        </aside>
        <section className="cr-timeline" aria-labelledby="cr-timeline-title">
          <div className="cr-timeline-toolbar"><h2 id="cr-timeline-title">Timeline</h2><button className="cr-play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(value => !value)}>{playing ? 'Ⅱ Pause' : '▶ Play'}</button><label className="cr-frame-field">Current frame<input aria-label="Current frame" type="number" min={0} max={project.durationFrames - 1} step={1} value={frame} onChange={event => seek(Number(event.target.value))}/></label><span className="cr-time-readout">/ {project.durationFrames - 1} <span>· {(frame / project.fps).toFixed(2)}s</span></span></div>
          <div className="cr-timeline-seek"><span>Frame</span><input aria-label="Timeline frame" type="range" min={0} max={project.durationFrames - 1} step={1} value={frame} onChange={event => seek(Number(event.target.value))}/></div>
          <div className="cr-ruler"><span>{selected?.name ?? 'Properties'}</span><div>{[0, .25, .5, .75, 1].map(fraction => { const tick = Math.round((project.durationFrames - 1) * fraction); return <button key={fraction} aria-label={`Seek frame ${tick}`} style={{ left: `${fraction * 100}%` }} onClick={() => seek(tick)}>{tick}</button>; })}</div></div>
          <div className="cr-tracks">{selected ? PROPERTIES.map(property => <div className="cr-track-row" key={property.key}><span>{property.label}<span className="cr-track-count">{selected.tracks[property.key]?.length || '—'}</span></span><div className="cr-track-lane"><span className="cr-playhead" aria-hidden="true" style={{ left: `${frame / (project.durationFrames - 1) * 100}%` }}/>{selected.tracks[property.key]?.map(key => <button key={key.frame} className={`cr-key-marker${activeKey?.layer === selected.id && activeKey?.property === property.key && activeKey?.frame === key.frame ? ' is-active' : ''}`} style={{ left: `${key.frame / (project.durationFrames - 1) * 100}%` }} aria-label={`${property.label} keyframe at frame ${key.frame}`} title={`${property.label}: ${key.value} · frame ${key.frame} · ${key.easing}`} onClick={() => { seek(key.frame); setActiveKey({ layer: selected.id, property: property.key, frame: key.frame }); }}><span aria-hidden="true">◆</span></button>)}</div></div>) : <p className="cr-timeline-empty">Add a shape, then set its first property keyframe with ◇ in the inspector.</p>}</div>
          {currentKey && activeKey && <div className="cr-key-editor"><strong>{PROPERTIES.find(item => item.key === activeKey.property)!.label} · frame {currentKey.frame}</strong><span>{rounded(currentKey.value)}</span><label>Easing<select aria-label="Keyframe easing" value={currentKey.easing} onChange={event => apply(current => setKeyframe(current, activeKey.layer, activeKey.property, currentKey.frame, currentKey.value, event.target.value as Easing))}>{EASINGS.map(easing => <option key={easing} value={easing}>{easing}</option>)}</select></label><button aria-label="Delete keyframe" onClick={() => { if (apply(current => removeKeyframe(current, activeKey.layer, activeKey.property, activeKey.frame))) setActiveKey(null); }}>Delete keyframe</button></div>}
          <div className="cr-timeline-footer"><span>{reducedMotion ? 'Reduced motion · playback starts only when you choose Play.' : 'Frame-based motion · local project'}</span><span>Linear & named easing</span></div>
        </section>
      </div>
      <div className="cr-status" role="status" aria-live="polite">{message || 'Editing stays local. Optional AI sends only what you consent to. Save an editable project or export Lottie for your app.'}</div>
    </main>
    {showLibrary&&<Suspense fallback={<p role="status">Loading motion library…</p>}><MotionLibrary currentProject={project} onClose={()=>setShowLibrary(false)} onOpen={(next,origin)=>{if(!confirmDiscard())return false;reset(next);setShowLibrary(false);setShowAi(false);setMessage(origin==='example'?'Opened a previously AI-generated example. No AI request was made.':'Opened a motion saved on this device.');return true;}}/></Suspense>}
    {showNew && <NewProjectDialog close={() => setShowNew(false)} create={options => { reset(createProject(options)); setShowNew(false); setMessage('Created a blank animation.'); }}/>}
  </div>;
}
