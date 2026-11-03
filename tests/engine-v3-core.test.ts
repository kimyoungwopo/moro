import {describe,it,expect} from 'vitest';
import {blankProjectV3} from '../packages/creator-core/src/v3';
describe('ProjectV3 blank',()=>{it('creates an independent editable empty v3 document',()=>{const a=blankProjectV3(),b=blankProjectV3();expect(a).toMatchObject({version:3,layers:[]});a.layers.push({} as never);expect(b.layers).toEqual([]);});});
