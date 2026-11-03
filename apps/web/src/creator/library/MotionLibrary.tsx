import {useEffect,useRef,useState} from 'react';
import type {CreatorProject} from '../../../../../packages/creator-core/src';
import {listMotions,removeMotion,saveMotion,type SavedMotion} from './store';
import {EXAMPLE_NOTICE,MOTION_EXAMPLES,loadExample} from './examples';
import {confirmDelete,openLibraryProject} from './actions';
import './library.css';
export type MotionLibraryProps={currentProject:CreatorProject;onOpen:(project:CreatorProject,origin:'example'|'saved')=>boolean;onClose:()=>void};
const errorText=(error:unknown)=>error instanceof Error?error.message:'The local library could not complete this action. Your editor project has not changed.';
export default function MotionLibrary({currentProject,onOpen,onClose}:MotionLibraryProps){
  const dialog=useRef<HTMLDialogElement>(null);
  const live=useRef(false),locked=useRef(false),closing=useRef(false);
  const [motions,setMotions]=useState<SavedMotion[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const node=dialog.current;live.current=true;closing.current=false;
    node?.showModal();
    let cancelled=false;
    void listMotions().then(records=>{if(!cancelled)setMotions(records);},failure=>{if(!cancelled)setError(errorText(failure));}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;live.current=false;node?.close();previous?.focus();};
  },[]);
  function close(){if(live.current && !closing.current){closing.current=true;onClose();}}
  async function run(label:string,action:()=>Promise<void>){
    if(locked.current)return;
    locked.current=true;setBusy(label);setError('');setNotice('');
    try{await action();}catch(failure){if(live.current)setError(errorText(failure));}
    finally{locked.current=false;if(live.current)setBusy('');}
  }
  async function refresh(){const records=await listMotions();if(live.current)setMotions(records);}
  const disabled=loading||Boolean(busy);
  return <dialog ref={dialog} className="ml-dialog" aria-labelledby="ml-title" onCancel={event=>{event.preventDefault();close();}}>
    <header className="ml-header"><div><h2 id="ml-title">Motion library</h2><p>Reusable examples and your browser’s saved motions.</p></div><button type="button" onClick={close} autoFocus>Close</button></header>
    {error&&<p className="ml-error" role="alert">{error}</p>}
    <p className="ml-status" role="status" aria-live="polite">{busy||notice}</p>
    <section aria-labelledby="ml-examples"><h3 id="ml-examples">Examples</h3><p className="ml-note">{EXAMPLE_NOTICE}</p>
      <div className="ml-examples">{MOTION_EXAMPLES.map(example=><article key={example.id} className="ml-example">
        <img src={example.posterUrl} alt={`${example.name} preview`} width="240" height="160" />
        <div><h4>{example.name}</h4><button type="button" disabled={Boolean(busy)} onClick={()=>void run(`Opening ${example.name}…`,async()=>{const project=await loadExample(example);if(live.current)openLibraryProject(project,'example',onOpen,close);})}>Open {example.name}</button></div>
      </article>)}</div>
    </section>
    <section aria-labelledby="ml-saved"><div className="ml-saved-heading"><h3 id="ml-saved">Saved <span>({motions.length}/12)</span></h3>
      <button type="button" disabled={disabled} onClick={()=>void run('Saving current project…',async()=>{
        const saved=await saveMotion({project:currentProject,origin:'editor'});
        // The write has committed before success is visible, even if a subsequent refresh fails.
        if(live.current){setMotions(records=>[saved,...records]);setNotice('Current project saved locally.');}
      })}>Save current project</button></div>
      <p className="ml-note">Stored only in this browser. Clearing site data removes saved motions; keep project-file backups.</p>
      {loading?<p role="status">Loading saved motions…</p>:motions.length===0?<p className="ml-empty">No saved motions yet.</p>:<ul className="ml-saved-list">{motions.map(motion=><li key={motion.id}>
        <div className="ml-saved-info"><h4>{motion.project.name}</h4><p>{motion.origin==='ai'?`AI proposal${motion.provider?` · ${motion.provider}`:''}`:'Edited project'} · {new Date(motion.createdAt).toLocaleDateString()}</p></div>
        <div className="ml-actions"><button type="button" disabled={Boolean(busy)} onClick={()=>{try{openLibraryProject(motion.project,'saved',onOpen,close);}catch(failure){setError(errorText(failure));}}} aria-label={`Open saved ${motion.project.name}`}>Open</button>
          <button type="button" disabled={Boolean(busy)} onClick={()=>void run('Deleting saved motion…',async()=>{if(await confirmDelete(motion.id,motion.project.name,message=>window.confirm(message),removeMotion)){if(live.current){setMotions(records=>records.filter(record=>record.id!==motion.id));setNotice('Saved motion deleted.');}}})} aria-label={`Delete saved ${motion.project.name}`}>Delete</button></div>
      </li>)}</ul>}
      {!loading&&error&&<button type="button" disabled={Boolean(busy)} onClick={()=>void run('Reloading saved motions…',refresh)}>Retry saved motions</button>}
    </section>
  </dialog>;
}
