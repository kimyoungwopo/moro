import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {parseProjectV3,exportLottieV3} from '../packages/creator-core/src/v3';
type Shape={v:number[][];i:number[][];o:number[][];c:boolean};
type Key={s:Shape[];e?:Shape[]};
type Export={layers:{nm:string;shapes?:{ty:string;ks?:{k:Key[]}}[]}[]};
it('exported morph endpoints are independent by-value data for official player completion',()=>{
 const project=parseProjectV3(readFileSync('fixtures/director-v3-advanced.json','utf8'));
 const output=exportLottieV3(project) as unknown as Export;
 const keys=output.layers.find(l=>l.nm==='morph-hero')!.shapes!.find(s=>s.ty==='sh')!.ks!.k;
 const end=keys[0].e![0],start=keys[1].s[0];
 expect(end).toEqual(start);
 for(const field of ['v','i','o'] as const){expect(end[field]).not.toBe(start[field]);for(let i=0;i<end[field].length;i++)expect(end[field][i]).not.toBe(start[field][i]);}
 const before=structuredClone(start);end.i[0][0]+=end.v[0][0];end.o[0][1]+=end.v[0][1];
 expect(start).toEqual(before);
});
