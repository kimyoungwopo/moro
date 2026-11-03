import {parseProject,serializeProject,type CreatorProject} from '../../../../../packages/creator-core/src';
export function openLibraryProject(project:CreatorProject,origin:'example'|'saved',onOpen:(project:CreatorProject,origin:'example'|'saved')=>boolean,onClose:()=>void) {
  const copy=parseProject(serializeProject(project));
  if(onOpen(copy,origin)) onClose();
}
export async function confirmDelete(id:string,name:string,confirm:(message:string)=>boolean,remove:(id:string)=>Promise<void>):Promise<boolean> {
  if(!confirm(`Delete “${name}” from this browser's local library? This cannot be undone.`)) return false;
  await remove(id);return true;
}
