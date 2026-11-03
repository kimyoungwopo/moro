import {assertCapacity,prepareMotion,validateSavedMotion,type SaveMotionInput,type SavedMotion} from './policy';
export type {SaveMotionInput,SavedMotion} from './policy';
const DATABASE='moro-motion-library';
const STORE='motions';
function storageError(error:unknown):Error {
  if(error && typeof error==='object' && 'name' in error) {
    if(error.name==='QuotaExceededError') return new Error('Local storage is full (quota exceeded). Delete a saved motion or free browser storage. Your editor project has not changed.');
    if(error.name==='SecurityError' || error.name==='InvalidStateError' || error.name==='NotSupportedError') return new Error('Local library storage is unavailable in this browser. Your editor project has not changed.');
  }
  return new Error('Local library transaction failed. Your editor project has not changed. Please retry.');
}
function openDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined') {reject(new Error('Local library storage is unavailable. Your editor project has not changed.'));return;}
    let request:IDBOpenDBRequest;
    try {request=indexedDB.open(DATABASE,1);} catch(error) {reject(storageError(error));return;}
    let finished=false;
    const fail=(error:Error)=>{finished=true;reject(error);};
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE,{keyPath:'id'});};
    request.onerror=()=>fail(storageError(request.error));
    request.onblocked=()=>fail(new Error('Local library is blocked by another tab. Close other Moro tabs and retry.'));
    request.onsuccess=()=>{
      const db=request.result;
      if(finished) {db.close();return;}
      db.onversionchange=()=>db.close();resolve(db);
    };
  });
}
async function transaction<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,setResult:(value:T)=>void,fail:(error:unknown)=>void)=>void):Promise<T> {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    let tx:IDBTransaction;
    try {tx=db.transaction(STORE,mode,{durability:'strict'});} catch(error) {db.close();reject(storageError(error));return;}
    let result:T;let failure:unknown;
    const fail=(error:unknown)=>{failure=error;try {tx.abort();} catch {db.close();reject(error);} };
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onabort=()=>{db.close();reject(failure??storageError(tx.error));};
    tx.onerror=()=>{ /* The abort event is the authoritative transaction failure. */ };
    try {work(tx.objectStore(STORE),value=>{result=value;},fail);} catch(error) {fail(error);}
  });
}
export async function saveMotion(input:SaveMotionInput):Promise<SavedMotion> {
  // Validate and copy before any await: later editor changes cannot alter this save.
  const motion=prepareMotion(input,crypto.randomUUID(),new Date().toISOString());
  return transaction('readwrite',(store,setResult,fail)=>{
    // Count and insert share one serialized readwrite transaction, including across tabs.
    const count=store.count();
    count.onsuccess=()=>{
      try {assertCapacity(count.result);store.add(motion);setResult(motion);} catch(error) {fail(error);}
    };
  });
}
export async function listMotions():Promise<SavedMotion[]> {
  return transaction('readonly',(store,setResult,fail)=>{
    const request=store.getAll();
    request.onsuccess=()=>{
      try {setResult((request.result as unknown[]).map(validateSavedMotion).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)));}
      catch(error) {fail(error);}
    };
  });
}
export async function removeMotion(id:string):Promise<void> {
  if(typeof id!=='string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Invalid motion ID.');
  return transaction('readwrite',(store,setResult)=>{store.delete(id);setResult(undefined);});
}
