import {afterEach,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseProject} from '../packages/creator-core/src';
import {MOTION_EXAMPLES,EXAMPLE_NOTICE,loadExample} from '../apps/web/src/creator/library/examples';
afterEach(()=>vi.unstubAllGlobals());
it('bundles exact genuine generated projects and actual posters, not synthetic thumbnails',()=>{
  expect(MOTION_EXAMPLES.map(e=>e.id)).toEqual(['ai-chick','ai-confetti']);
  expect(EXAMPLE_NOTICE).toBe('Previously AI-generated example — opening this does not call AI');
  // SHA-256 measured from the genuine research posters; no absolute path needed in CI.
  const posters={'ai-chick':'7632da982e925b44ab27b1caf205fd92ffe071b9a3eeb3cd12ec445eb1997baf','ai-confetti':'b70adcfd801728cf5d3efd4fd937e50707bdc3002519d6473b1619c27cd399e5'};
  for(const example of MOTION_EXAMPLES){
    const bundled=readFileSync(`apps/web/public${example.projectUrl}`,'utf8');
    expect(bundled).toBe(readFileSync(`examples/authoring/${example.id}/project.moro.json`,'utf8'));
    expect(parseProject(bundled).layers.length).toBeGreaterThan(0);
    const poster=readFileSync(`apps/web/public${example.posterUrl}`);
    expect(createHash('sha256').update(poster).digest('hex')).toBe(posters[example.id as keyof typeof posters]);
    expect(poster.subarray(1,4).toString()).toBe('PNG');
  }
});
it('loads only requested static JSON, validates it and never submits AI',async()=>{
  const text=readFileSync('examples/authoring/ai-chick/project.moro.json','utf8');
  const fetcher=vi.fn(async()=>new Response(text));vi.stubGlobal('fetch',fetcher);
  expect(await loadExample({id:'ai-chick',name:'Chick',projectUrl:'/authoring/ai-chick/project.moro.json',posterUrl:''})).toEqual(parseProject(text));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]).toEqual(['/authoring/ai-chick/project.moro.json']);
});
it('reports missing or invalid bundled examples without replacing the editor',async()=>{
  const example={id:'bad',name:'Bad',projectUrl:'/bad',posterUrl:''};
  vi.stubGlobal('fetch',async()=>new Response('missing',{status:404}));
  await expect(loadExample(example)).rejects.toThrow(/could not load/i);
  vi.stubGlobal('fetch',async()=>new Response('{"version":1,"expression":"evil"}'));
  await expect(loadExample(example)).rejects.toThrow(/invalid/i);
});
