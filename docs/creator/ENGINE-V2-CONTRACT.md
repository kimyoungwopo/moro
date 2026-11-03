# Moro local character-capability engine v2 — implementation contract

Authorized local continuation 2026-11-01 after Quality lab/174 unit/69 Rust/21 E2E delivery. Preserve all dirty existing source and original archives. Parent owns integration, acceptance and delivery. No commit/push/deploy, protected AGENTS writes, auth/global settings, live provider/model calls, new dependencies, or new Python project tools. Existing CPU safety runner stays unchanged.

## Product boundary

Implement a real local-only **Rig lab** at `/rig`: cubic path authoring, transform-only groups/parenting and static pivots with editable-project save/reopen and actual Lottie export. Keep v1 core/types/AI/provider schema and Creator unchanged except a navigation entry. No automatic migration; Rig lab may explicitly import a COPY of a v1 project. No v2 context upload or provider activation. Human-character AI remains blocked; do not claim artistic approval or new human art. Old `/create`, palette, AI and Quality lab remain working.

## Ownership

Core worker: NEW `packages/creator-core/src/v2/**`, `packages/creator-core/src/v2.ts`, NEW `tests/engine-v2-*.test.ts` only. No index.ts, UI, schema, native edits.
UI worker: NEW `apps/web/src/rig/**`, NEW `tests/rig-*.test.ts` only. No routing/Creator/native/core edits. Parent owns route/deep-link/entry wiring and actual browser E2E. Native worker: NEW `bridge/src/creator_v2.rs`, `bridge/src/bin/moro-validate-v2.rs`, minimal `bridge/src/lib.rs` module export/Cargo bin registration, NEW `bridge/tests/creator_v2.rs`, NEW `schemas/creator-project-v2.schema.json` only; no provider/harness/HTTP edits. Shared corpus is parent-owned `fixtures/creator-v2-corpus.json` and read-only to workers.

## Frozen DTO and coordinates

`Vec2=[number,number]`, Matrix=`[a,b,c,d,e,f]` for SVG `matrix(a b c d e f)`; point `[a*x+c*y+e,b*x+d*y+f]`.
`Property`, `Keyframe`, `Easing` meanings identical to v1.
`Common={id,name,parentId:string|null,x,y,pivot:Vec2,scale,rotation,opacity,tracks:{x:Keyframe[],y:Keyframe[],scale:Keyframe[],rotation:Keyframe[],opacity:Keyframe[]}}` (all keys required).
Primitive=`Common & {type:'rect'|'ellipse',width,height,cornerRadius:number|null,fill:'#RRGGBB',stroke:'#RRGGBB',strokeWidth}`.
Path=`Common & {type:'path',path:{closed:boolean,vertices:Vec2[],inTangents:Vec2[],outTangents:Vec2[]},fill:'#RRGGBB'|null,stroke:'#RRGGBB',strokeWidth}`. A single static contour; no width/height, morph, expressions, SVG d input or imported assets. Tangents are offsets relative to matching vertex. Open path: fill=null, first in tangent/last out tangent [0,0]. Closed path min3 points, open min2; arrays equal length.
Group=`Common & {type:'group'}` with opacity=100, tracks.opacity=[]; NO geometry/style, no compositing/opacity inheritance. Parent must reference a group; flat layers are bottom→top paint order independent of parenting.
`ProjectV2={version:2,name,width,height,fps,durationFrames,layers:LayerV2[]}`.
Local matrix `T(x,y)*R(rotation)*S(scale/100)*T(-pivot)`, world=`parentWorld*local`. x/y is the parent-local location of this local pivot. Root parent coordinates=canvas. Local primitives are centered at0; paths keep authored local origin, never implicit recentering. Positive screen rotation is clockwise; scale/opacity100 remain defaults. Pivot is static local px, not percent. Position keyframes use same parent-local meaning. Fractional frame samples use existing outgoing named easing with cubic-x inversion.

## Required core exports (`packages/creator-core/src/v2.ts`)

Types `ProjectV2`, `LayerV2`, `Vec2`, `Matrix`, `Bounds` (`{minX,minY,maxX,maxY}`), `Property`/`Easing` (re-export v1 types).
`createProjectV2(options?)`, `parseProjectV2(text)`, `serializeProjectV2(project)`, `validateProjectV2(value):asserts value is ProjectV2`, `migrateProjectV1(projectV1):ProjectV2` immutable.
`addLayerV2(project,type:'rect'|'ellipse'|'path'|'group'):ProjectV2` returns new layer LAST; default closed cubic path is valid, non-human neutral geometry. `updateLayerV2(project,id,patch)` exact variant patch excluding id/type/tracks; `setKeyframeV2`/`removeKeyframeV2` v1 argument order; `removeLayerV2` rejects a group with descendants; `duplicateLayerV2` duplicates subtree with fresh IDs/remapped internal parents (root duplicate LAST; preserve internal z order); `moveLayerV2(project,id,'up'|'down')` flat paint order only.
`sampleLayerV2(layer,frame):{x,y,scale,rotation,opacity}` local only. `worldMatricesV2(project,frame):Map<string,Matrix>`; `transformPointV2(matrix,point):Vec2`, `inverseMatrixV2(matrix):Matrix`, `pathDataV2(pathGeometry):string` SVG M/C/Z; `layerBoundsV2(project,id,frame):Bounds` world bounds incl path cubic extrema and descendant union for group; `exportLottieV2(project):Obj` bounded expression-free.
`setPivotV2(project,id,pivot,preserveWorld:boolean)` preserveWorld permitted only for node x/y/scale/rotation tracks all empty; compensation R*S*(newPivot-oldPivot). Otherwise reject, never silently bake. `reparentLayerV2(project,id,parentId)` preserve world pose across all time only when target and old/new ancestry transform tracks empty; reject animated ancestry/target, cycles/non-group. Existing descendant tracks may stay if ancestor world equivalence is preserved. `duplicate/remove` must not leave dangling IDs. Mutations immutable and validate; failures leave source untouched.

## Bounds/validation parity

Headers like v1: dimensions integer16..4096, fps1..120, frames2..3600. Names/IDs nonblank, <=200 UTF16 code units, no C0/DEL/C1. Exact keys on all variants, finite numbers, dense arrays, no prototypes/accessors/custom properties in TS.
Max100 nodes INCLUDING groups; parent depth<=8 edges; reject missing/self/non-group/cycles. x/y[-8192,8192], pivot components[-4096,4096], scale[1,1000], rotation[-3600,3600], opacity[0,100]; primitives width/height[1,4096], rect radius null or0..min/2; ellipse null/0. Stroke[0,100]. Colors hex6.
Path max256 vertices, total2048; components vertices/tangents[-4096,4096], each vertex+tangent within[-8192,8192]. Keys <=100 per channel, total10000, strict increasing integer frame in duration, named easing4. Group opacity fixed/no opacity keys. Cumulative scale all-channel extrema bounded factor0.01..100. Conservative world origin/control-hull+stroke extent <=65536, reject rather than clamp. These bounds are safety limits, not artistic/bounds approval.
Editable input/output <=8MiB UTF8, JSON nesting<=32, duplicate JSON object keys rejected by parse functions. Exported compact Lottie<=2MiB, no expressions/assets. Native validator must match same common JSON corpus; TypeScript-only hostile object descriptors have no JSON equivalent.

## UI contract

Default `RigEditor.tsx` React component under apps/web/src/rig. Use core imports ONLY from v2.ts, existing player adapter, existing v1 parser for explicit copy import. Parent wires `/rig` and a `Rig lab` link. Existing header/tokens/styles reused without overwriting Creator selectors; scoped `.moro-rig` styles. No new deps.
Create/add primitives/path/group; layer selection/paint reorder/duplicate/remove; local transform numeric inspector, pivot fields + explicit preserve-world action, parent group selection + safe reparent error. Explicit key insert/remove and frame/play controls. Real curve authoring: vertex selection, vertex and both tangent numeric edits, clickable draggable on-canvas vertex/tangent handles, open/closed conversion with explicit fill/unused-handle rules. Do not call import-and-play editable path authoring.
Canvas overlay must use same world matrices as export; descendant drag uses inverse PARENT world matrix, path handle drag inverse NODE world matrix, not raw screen deltas. Freeze frame and stop playback at gesture start; all pointer moves one Undo, cancel/lost capture restores source. Group selection uses descendant bounds, not fake ellipse geometry. Numeric/property edits one Undo, identical edits no-op. Local generic history snapshot preserves original on failed edits. Save .moro.json and export Lottie JSON are distinct; reopen preserves curves/hierarchy/pivots/tracks. beforeunload guard for unsaved data; explicit v1 copy import preserves original and clearly labels migration. Browser AI is not attached to v2. Support320/390px + desktop, controls44px, reduced motion initial paused/manual playback.

## Acceptance / actual completion

All existing v1 174/69/21 cases preserved. Shared v2 positive/negative corpus actual TS/Rust parity. Core Lottie shapes use ty sh with relative tangents; groups ty3 null and final reversed id→ind map for parent. Actual light-player comparison must cover nonzero pivot, animated root and child, reversed seeks and cubic path shapes; no endpoint-only claim. Browser author path→edit vertex/tangents→group/parent/pivot→animate→save→fresh reopen→export→independent player + one Undo. Rotated/scaled parent child drag + tangent drag at320/390px. Reject invalid/cyclic/deep/oversized inputs without provider calls. Render one non-human technical proof, explicitly not AI art or high-quality human. Finish full regression, source archive integrity/hash and verified source/demo delivery. Keep expired cron/jobs untouched.
