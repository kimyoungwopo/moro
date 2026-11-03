import {expect,test} from 'vitest';
import corpus from '../fixtures/creator-v2-corpus.json';
import {validateProjectV2} from '../packages/creator-core/src/v2';
for(const c of corpus.cases) test(`shared corpus: ${c.id}`,()=> { if(c.valid) expect(()=>validateProjectV2(c.project)).not.toThrow(); else expect(()=>validateProjectV2(c.project)).toThrow(); });
