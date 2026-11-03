import { parseProject, serializeProject } from '../../../../../packages/creator-core/src';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
export type RefinementContext = { project: CreatorProject; consent: boolean };
export const MAX_CONTEXT_BYTES = 65536;
const properties = ['x','y','scale','rotation','opacity'] as const;
function snapshot(project: CreatorProject): CreatorProject {
 const copy = parseProject(serializeProject(project));
 for(const layer of copy.layers) layer.tracks = Object.fromEntries(properties.map(key=>[key,layer.tracks[key]??[]]));
 return copy;
}
export function prepareProjectContext(project: CreatorProject): CreatorProject {
 const copy = snapshot(project);
 if(!copy.layers.length || copy.layers.length>20) throw new Error('AI refinement supports a current project with 1–20 layers.');
 for(const value of [copy.name,...copy.layers.flatMap(l=>[l.name,l.id])]) if(/[\u007f-\u009f]/u.test(value)) throw new Error('The current project contains names unsupported by AI refinement.');
 if(new TextEncoder().encode(JSON.stringify(copy)).length>MAX_CONTEXT_BYTES) throw new Error('The current project is too large to send. AI context is limited to 64 KiB.');
 return copy;
}
function stable(value: unknown): string {
 if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
 if(value!==null && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
function comparable(project: CreatorProject): CreatorProject {
 const copy=snapshot(project);for(const layer of copy.layers)layer.cornerRadius=layer.cornerRadius??0;
 return copy;
}
export function projectSignature(project: CreatorProject): string { return stable(comparable(project)); }
export function projectDelta(base: CreatorProject, next: CreatorProject) {
 const a=comparable(base),b=comparable(next);
 const before=new Map(a.layers.map(l=>[l.id,l])),after=new Map(b.layers.map(l=>[l.id,l]));
 return {
  added:b.layers.filter(l=>!before.has(l.id)).map(l=>l.id),
  removed:a.layers.filter(l=>!after.has(l.id)).map(l=>l.id),
  changed:b.layers.filter(l=>before.has(l.id)&&stable(before.get(l.id))!==stable(l)).map(l=>l.id),
  settingsChanged:(['name','version','width','height','fps','durationFrames'] as const).some(k=>a[k]!==b[k]),
  orderChanged:stable(a.layers.map(l=>l.id))!==stable(b.layers.map(l=>l.id)),
 };
}
