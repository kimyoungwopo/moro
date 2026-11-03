# Creator implementation contract

This shared contract freezes the first creator implementation. It is not an implemented-capability claim. Preserve the existing palette workbench. No publishing, remote API, login, expressions or uploads.

## Data model / API (packages/creator-core/src/index.ts)

Export these exact names. All operations are immutable and validate finite ranges.

```ts
type ShapeType = 'rect' | 'ellipse';
type Property = 'x' | 'y' | 'scale' | 'rotation' | 'opacity';
type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
type Keyframe = {frame:number;value:number;easing:Easing};
type CreatorLayer = {id:string;name:string;type:ShapeType;x:number;y:number;width:number;height:number;fill:string;stroke:string;strokeWidth:number;cornerRadius?:number|null;rotation:number;opacity:number;scale:number;tracks:Partial<Record<Property,Keyframe[]>>};
type CreatorProject = {version:1;name:string;width:number;height:number;fps:number;durationFrames:number;layers:CreatorLayer[]};
createProject(options?:Partial<Pick<CreatorProject,'name'|'width'|'height'|'fps'|'durationFrames'>>):CreatorProject;
addLayer(project:CreatorProject,type:ShapeType):CreatorProject;
updateLayer(project:CreatorProject,id:string,patch:Partial<Omit<CreatorLayer,'id'|'type'|'tracks'>>):CreatorProject;
removeLayer(project:CreatorProject,id:string):CreatorProject;
duplicateLayer(project:CreatorProject,id:string):CreatorProject;
moveLayer(project:CreatorProject,id:string,direction:'up'|'down'):CreatorProject;
setKeyframe(project:CreatorProject,id:string,property:Property,frame:number,value:number,easing?:Easing):CreatorProject;
removeKeyframe(project:CreatorProject,id:string,property:Property,frame:number):CreatorProject;
sampleLayer(layer:CreatorLayer,frame:number):{x:number;y:number;scale:number;rotation:number;opacity:number};
serializeProject(project:CreatorProject):string;
parseProject(text:string):CreatorProject;
exportLottie(project:CreatorProject):import('../../document-core/src').Obj;
```

Defaults: name Untitled motion, 512×512, 60fps, durationFrames=120. Layers array bottom→top; new/duplicate layer appended on top. New layer IDs must be unique. Rectangle default size160×100, ellipse100×100; positioned at canvas center. Static fill #1B6C80, stroke #203B42 width0, rotation0 opacity100 scale100.

Design-quality extension: `cornerRadius` is optional and static, not a keyframe property. Missing/null/0 retains the exact legacy square appearance and is not automatically added to old files. A rect radius is finite0..min(width,height)/2; ellipse allows only missing/null/0. The exporter writes rect roundness to `rc.r.k`. AI generation uses the strict provider schema with a required nullable cornerRadius field; the native validator also accepts legacy proposals with that field absent, without mutating their source. Unknown fields remain rejected. See [design-quality contract](../ai/DESIGN-QUALITY-CONTRACT.md) for the selected target-size/consent boundary.

Project bounds: 16–4096px integer dimensions, 1–120 integer fps, 2–3600 integer duration frames, max100 layers. max100 keys per property. Shape dimensions 1–4096; opacity0–100, scale1–1000, rotation −3600..3600, position −8192..8192; strokeWidth0–100. HEX #RRGGBB only. All keys integer frame0..durationFrames−1, finite values in property bounds; unique frame sorted, overwriting same frame allowed. Unknown versions/types/easing/properties and malicious/oversized structure fail visibly. Project JSON is data, never code.

Easing belongs to outgoing segment. Before first/after last key hold nearest key; no track uses layer static property. A single key exports as constant at its value. Use deterministic cubic timing for supported named curves; sampleLayer and exported Lottie must agree. Lottie x/y use separated position dimensions to preserve independent easing/time grids. Uniform scale maps to [s,s,100]. No animated color/expressions/assets needed. Anchor at [0,0,0], geometry centered locally; layer position is canvas center position. op=durationFrames, timeline range0..durationFrames−1.

## UI (apps/web/src/creator/Creator.tsx)

Default export `Creator`. Parent routes `/create` to it; existing `/` remains palette workbench with a visible Create animation link. Creator first screen has blank project (no precreated animation), New, Add rectangle, Add ellipse, canvas, layers, transform inspector, property keyframes and timeline, play/pause, Save project/Open project/Export Lottie.

Accessible contracts: h1 initially `Untitled motion`; buttons `Add rectangle`, `Add ellipse`, `New animation`, `Play`/`Pause`, `Save project`, `Open project`, `Export Lottie`, `Undo`, `Redo`; property inputs labels `X position`, `Y position`, `Scale`, `Rotation`, `Opacity`; add-key buttons `Add X keyframe`, `Add Y keyframe`, `Add Scale keyframe`, `Add Rotation keyframe`, `Add Opacity keyframe`; slider `Timeline frame`; editable numeric field `Current frame`. Existing palette links creator `/create`; creator links workbench `/`.

Inspector behavior: if a property has a track, editing its number updates/adds a key at current frame; if no track edits static value. Explicit Add key captures sampled value. Thus first flow: Add ellipse→Add X keyframe at0→Current frame60→X position400→Play→Export Lottie. Keyframe list must allow selecting/deleting key and easing choice. Drag commits once; input edits immutable snapshots; undo/redo applies to actual creation document. Project open/save distinct from Lottie import/export. Unsupported Lottie import is not promoted to fully editable project.

Preview must use real exportLottie + existing light player, plus separate selected-object editing overlay; do not animate only a CSS clone. Selection/drag overlay cannot cover transport or crop work; seek/readback should agree with exported data. Respect reduced motion, editable input keyboard shortcuts, focus, and 44px mobile controls. At narrow widths recompose panels, never horizontal page overflow. No fake timeline.

## Authoring CLI and skills

Canonical CLI `node scripts/moro-create.mjs --input /path/project.moro.json --out /path/animation.json`. It consumes CreatorProject data, uses real core exporter, refuses overwrite (both JSON and validation); no endpoint/model calls. `--validate` optional check-only mode; default output is actual Lottie JSON. Root dev dependency esbuild is available to bundle trusted core if Node22 cannot import TS. Never eval input JSON. CLI help documents npm ci prerequisite and actual supported bounds.

Skill under `skills/lottie-authoring/SKILL.md`: route composition/motion/easing/loop/compatibility docs on demand; brief→project model→actual CLI→actual player QA. Include original editable examples (loader/success/product interaction) in `examples/authoring/`, paired project.moro.json + generated animation.json. Parent verifies examples through real CLI and player. Guidance and implementation must remain distinguished; no unsupported text/SVG/path/AI promises. No global skill installation.

## Parent acceptance

Existing 30 unit +3 distribution +8 browser regression remain. Add creator unit and browser tests. Required actual blank-to-ellipse-to-two-X-keys-to-export flow; compare beginning/middle/end rendered transform and output data, project save/reopen and undo. Record real creator flow. Public push/deploy remain excluded. Each worker saves a short exact-results handoff under ignored artifacts and does not modify another worker's files.
