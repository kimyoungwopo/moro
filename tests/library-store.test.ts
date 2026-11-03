import {afterEach,expect,it,vi} from 'vitest';
import {createProject} from '../packages/creator-core/src';
import {listMotions,saveMotion,removeMotion} from '../apps/web/src/creator/library/store';
afterEach(()=>vi.unstubAllGlobals());
it('rejects unavailable storage honestly for save/list/delete',async()=>{
  vi.stubGlobal('indexedDB',undefined);
  await expect(saveMotion({project:createProject(),origin:'editor'})).rejects.toThrow(/unavailable/i);
  await expect(listMotions()).rejects.toThrow(/unavailable/i);
  await expect(removeMotion('motion-1')).rejects.toThrow(/unavailable/i);
});

// A controlled event seam, not a replacement IndexedDB implementation.
function controlledDb(count=0,records:unknown[]=[]){
  const tx={oncomplete:null as null|(()=>void),onabort:null as null|(()=>void),onerror:null as null|(()=>void),error:null as null|DOMException,abort:vi.fn(()=>queueMicrotask(()=>tx.onabort?.())),objectStore:()=>store};
  const request=(result:unknown)=>{const req={result,onsuccess:null as null|(()=>void)};queueMicrotask(()=>req.onsuccess?.());return req;};
  const store={count:()=>request(count),add:vi.fn(()=>request('motion')),getAll:()=>request(records),delete:vi.fn(()=>request(undefined))};
  const db={transaction:()=>tx,close:vi.fn()};
  vi.stubGlobal('indexedDB',{open:()=>{const req={result:db,onsuccess:null as null|(()=>void)};queueMicrotask(()=>req.onsuccess?.());return req;}});
  return {tx,store,db};
}
const flush=async()=>{for(let i=0;i<8;i++) await Promise.resolve();};
it('does not report save or deletion success before transaction completion',async()=>{
  const {tx,store,db}=controlledDb();let saved=false;
  const saving=saveMotion({project:createProject(),origin:'editor'}).then(value=>{saved=true;return value;});
  await flush();expect(store.add).toHaveBeenCalledTimes(1);expect(saved).toBe(false);
  tx.oncomplete?.();const record=await saving;expect(record.id).not.toBe('pending');expect(db.close).toHaveBeenCalled();
  let deleted=false;const deleting=removeMotion(record.id).then(()=>{deleted=true;});
  await flush();expect(store.delete).toHaveBeenCalledWith(record.id);expect(deleted).toBe(false);
  tx.oncomplete?.();await deleting;expect(deleted).toBe(true);
});
it('rejects capacity atomically without inserting or evicting anything',async()=>{
  const {store}=controlledDb(12);
  await expect(saveMotion({project:createProject(),origin:'editor'})).rejects.toThrow(/full.*12/i);
  expect(store.add).not.toHaveBeenCalled();expect(store.delete).not.toHaveBeenCalled();
});
it('surfaces a quota abort even after the add request succeeds',async()=>{
  const {tx}=controlledDb();const saving=saveMotion({project:createProject(),origin:'editor'});
  const rejected=expect(saving).rejects.toThrow(/storage.*full|quota/i);
  await flush();tx.error=new DOMException('full','QuotaExceededError');tx.onabort?.();await rejected;
});
it('rejects malformed stored records rather than returning untrusted project data',async()=>{
  const {tx}=controlledDb(1,[{id:'bad',version:2}]);const listing=listMotions();
  const rejected=expect(listing).rejects.toThrow(/invalid/i);await flush();tx.oncomplete?.();await rejected;
});
