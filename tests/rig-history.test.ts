import { expect, it } from 'vitest';
import { createHistory, commitHistory } from '../apps/web/src/rig/history';
it('stores original snapshots once and ignores identical edits',()=>{
 const original={x:1}; const initial=createHistory(original);
 const edited=commitHistory(initial,{x:2});
 expect(edited.past).toEqual([original]);
 expect(commitHistory(edited,{x:2})).toBe(edited);
});
