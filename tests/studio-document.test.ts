import {describe,it,expect} from 'vitest';
import {blankProjectV3} from '../packages/creator-core/src/v3';
import {commitDocument,createDocument,undoDocument,redoDocument} from '../apps/web/src/studio/document';
describe('Studio document atomic history',()=>{
 it('one Apply is exactly one Undo and Redo, no-op preserves history identity',()=>{const blank=blankProjectV3(),initial=createDocument(blank),next={...blank,name:'fixture applied'};expect(commitDocument(initial,structuredClone(blank))).toBe(initial);const applied=commitDocument(initial,next);expect(applied.past).toHaveLength(1);const undone=undoDocument(applied);expect(undone.present).toEqual(blank);expect(redoDocument(undone).present).toEqual(next);expect(undone.revision).toBeGreaterThan(applied.revision);});
});
