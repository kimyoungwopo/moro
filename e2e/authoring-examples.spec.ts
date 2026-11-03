import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {parseProject,sampleLayer} from '../packages/creator-core/src';
import {mountLottie,seekLottie,hasTranslation} from './player-fixture';
const cases=[{name:'loader',frames:[0,26,38,50,76,119]},{name:'success-feedback',frames:[0,18,32,64,119]},{name:'product-interaction',frames:[0,18,50,70,90,112,179]}];
for(const item of cases)test(`authoring example: ${item.name} exports render declared poses in an independent player`,async({page},testInfo)=>{
 const base=`examples/authoring/${item.name}`;const project=parseProject(await readFile(`${base}/project.moro.json`,'utf8'));const animation=JSON.parse(await readFile(`${base}/animation.json`,'utf8'));await mountLottie(page,animation);
 for(const frame of item.frames){await seekLottie(page,frame);for(const layer of project.layers){const pose=sampleLayer(layer,frame);if(pose.opacity>.1)await expect.poll(()=>hasTranslation(page,'#independent',pose.x,pose.y),{message:`${item.name} / ${layer.name} at ${frame}`}).toBe(true);}await page.screenshot({path:testInfo.outputPath(`${item.name}-${frame}.png`)});}
});
