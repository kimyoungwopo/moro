import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseProjectV3,serializeProjectV3,exportLottieV3} from '../packages/creator-core/src/v3';

// Independently authored OFFLINE acceptance corpus; never provider provenance.
const corpus=JSON.parse(readFileSync('fixtures/director-v3-parent-corpus.json','utf8')) as {cases:{name:string;valid:boolean;project:unknown}[]};
describe('parent ProjectV3 contract acceptance',()=>{
 for(const row of corpus.cases)it(row.name,()=>{
  const parse=()=>parseProjectV3(JSON.stringify(row.project));
  if(!row.valid){expect(parse).toThrow();return;}
  const project=parse();expect(parseProjectV3(serializeProjectV3(project))).toEqual(project);
  const lottie=exportLottieV3(project);expect(lottie).toHaveProperty('w',320);expect(lottie).toHaveProperty('op',120);
 });
 it('rejects decoded duplicate version and nested JSON keys, never last-key-wins',()=>{
  const text=JSON.stringify(corpus.cases[0].project);
  expect(()=>parseProjectV3(text.replace('"version":3','"version":3,"ver\\u0073ion":3'))).toThrow();
  expect(()=>parseProjectV3(text.replace('"scaleX":115','"scaleX":115,"scaleX":100'))).toThrow();
 });
});
