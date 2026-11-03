import { parseProject, serializeProject, type CreatorProject } from '../../../../../packages/creator-core/src';
export type SaveMotionInput = {project:CreatorProject;origin:'ai'|'editor';provider?:'codex'|'claude';brief?:string};
export type SavedMotion = SaveMotionInput & {id:string;version:1;createdAt:string};
export const MAX_MOTIONS=12;
export function assertCapacity(count:number):void {
  if(!Number.isInteger(count) || count<0) throw new Error('Invalid motion count.');
  if(count>=MAX_MOTIONS) throw new Error('Local library is full (12 motions). Delete a saved motion before saving another.');
}
export function validateSavedMotion(value:unknown):SavedMotion {
  dataObject(value,['id','version','createdAt','project','origin','provider','brief']);
  if(value.version!==1) throw new Error('Invalid local motion version.');
  return prepareMotion({project:value.project as CreatorProject,origin:value.origin as SaveMotionInput['origin'],...(value.provider===undefined?{}:{provider:value.provider as SaveMotionInput['provider']}),...(value.brief===undefined?{}:{brief:value.brief as string})},value.id as string,value.createdAt as string);
}
function dataObject(value:unknown,keys:string[]):asserts value is Record<string,unknown> {
  if(!value || typeof value!=='object' || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw new Error('Invalid local motion record.');
  for(const key of Reflect.ownKeys(value)) {
    if(typeof key!=='string' || !keys.includes(key) || !('value' in Object.getOwnPropertyDescriptor(value,key)!)) throw new Error('Invalid local motion field.');
  }
}
export function prepareMotion(input:SaveMotionInput,id:string,createdAt:string):SavedMotion {
  dataObject(input,['project','origin','provider','brief']);
  if(input.origin!=='ai' && input.origin!=='editor') throw new Error('Invalid motion origin.');
  if(input.provider!==undefined && input.provider!=='codex' && input.provider!=='claude') throw new Error('Invalid motion provider.');
  if(input.brief!==undefined && (typeof input.brief!=='string' || input.brief.length>8000)) throw new Error('Invalid motion brief (maximum 8000 characters).');
  if(typeof id!=='string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Invalid motion ID.');
  if(typeof createdAt!=='string' || !Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString()!==createdAt) throw new Error('Invalid motion timestamp.');
  return {id,version:1,createdAt,project:parseProject(serializeProject(input.project)),origin:input.origin,...(input.provider===undefined?{}:{provider:input.provider}),...(input.brief===undefined?{}:{brief:input.brief})};
}
