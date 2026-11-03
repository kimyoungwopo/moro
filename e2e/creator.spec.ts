import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {mountLottie,seekLottie,hasTranslation} from './player-fixture';
test.use({video:{mode:'on',size:{width:1440,height:900}},viewport:{width:1440,height:900}});
async function frame(page:Page,n:number){const input=page.getByRole('spinbutton',{name:'Current frame',exact:true});await input.fill(String(n));await input.press('Tab');}
async function translationExists(page:Page,x:number,y:number){return page.getByTestId('creator-preview').locator('svg g[transform]').evaluateAll((elements,target)=>elements.some(el=>{const raw=el.getAttribute('transform')??'';const m=/^matrix\(([^)]+)\)$/.exec(raw);if(!m)return false;const a=m[1].split(/[\s,]+/).map(Number);return a.length===6&&Math.abs(a[4]-target.x)<.05&&Math.abs(a[5]-target.y)<.05;}),{x,y});}
async function authorMove(page:Page){
 await page.goto('/create');await expect(page.getByRole('heading',{level:1})).toHaveText('Untitled motion');
 await page.getByRole('button',{name:'Add ellipse',exact:true}).click();
 const x=page.getByRole('spinbutton',{name:'X position',exact:true});
 const start=Number(await x.inputValue()),y=Number(await page.getByRole('spinbutton',{name:'Y position',exact:true}).inputValue());
 await page.getByRole('button',{name:'Add X keyframe',exact:true}).click();await frame(page,60);await x.fill('400');await x.press('Tab');
 return {start,y};
}
test('creator: blank canvas to authored motion renders actual exported positions and downloads real Lottie',async({page,context},testInfo)=>{
 const {start,y}=await authorMove(page);
 for(const [f,x] of [[0,start],[30,(start+400)/2],[60,400]]){await frame(page,f);await expect.poll(()=>translationExists(page,x,y)).toBe(true);}
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export Lottie',exact:true}).click();const download=await downloading;
 const file=testInfo.outputPath('authored-animation.json');await download.saveAs(file);const json=JSON.parse(await readFile(file,'utf8'));
 expect(json.layers).toHaveLength(1);expect(json.layers[0].ty).toBe(4);expect(json.layers[0].ks.p.s).toBe(true);expect(json.layers[0].ks.p.x.a).toBe(1);
 expect(json.layers[0].ks.p.x.k[0]).toMatchObject({t:0,s:[start]});expect(json.layers[0].ks.p.x.k.at(-1)).toMatchObject({t:60,s:[400]});
 expect(json.assets).toEqual([]);expect(json.op).toBe(120);
 await page.screenshot({path:testInfo.outputPath('creator-desktop.png'),fullPage:true});
 const independent=await context.newPage();await mountLottie(independent,json);
 for(const [f,x] of [[0,start],[30,(start+400)/2],[60,400]]){await seekLottie(independent,f);await expect.poll(()=>hasTranslation(independent,'#independent',x,y)).toBe(true);}
 await independent.screenshot({path:testInfo.outputPath('independent-export.png')});await independent.close();
});
test('creator: editable project save and fresh-page reopen preserve authored keyframes',async({page,context},testInfo)=>{
 await authorMove(page);const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();const download=await downloading;const file=testInfo.outputPath('motion.moro.json');await download.saveAs(file);
 const project=JSON.parse(await readFile(file,'utf8'));expect(project.version).toBe(1);expect(project.layers[0].tracks.x).toHaveLength(2);
 const other=await context.newPage();await other.goto('/create');const choosing=other.waitForEvent('filechooser');await other.getByRole('button',{name:'Open project',exact:true}).click();await(await choosing).setFiles(file);
 await expect(other.getByRole('status')).toContainText('Opened');await other.getByRole('button',{name:`Select ${project.layers[0].name}`,exact:true}).click();
 await expect(other.getByRole('spinbutton',{name:'X position',exact:true})).toBeVisible();await frame(other,60);await expect(other.getByRole('spinbutton',{name:'X position',exact:true})).toHaveValue('400');await other.close();
});
test('creator: a shape can be added and undone at mobile width without page overflow',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/create');const add=page.getByRole('button',{name:'Add rectangle',exact:true});await add.click();await expect(page.getByTestId('creator-preview').locator('svg')).toBeVisible();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByTestId('creator-preview').locator('svg')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const b=await add.boundingBox();expect(b?.height).toBeGreaterThanOrEqual(44);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`creator-${width}.png`),fullPage:true});}
});
test('creator: pointer drag commits one undo and explicit playback moves the actual Lottie',async({page})=>{
 await page.goto('/create');await page.getByRole('button',{name:'Add ellipse',exact:true}).click();
 const canvas=await page.getByTestId('creator-canvas').boundingBox();const shape=await page.getByTestId('creator-canvas').locator('ellipse').boundingBox();expect(canvas).not.toBeNull();expect(shape).not.toBeNull();if(!canvas||!shape)throw Error('Missing authoring canvas');
 await page.mouse.move(shape.x+shape.width/2,shape.y+shape.height/2);await page.mouse.down();await page.mouse.move(shape.x+shape.width/2+40,shape.y+shape.height/2+20,{steps:6});await page.mouse.up();
 const expected=256+40*512/canvas.width;const x=page.getByRole('spinbutton',{name:'X position',exact:true});await expect.poll(async()=>Number(await x.inputValue())).toBeCloseTo(expected,1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(x).toHaveValue('256');await expect(page.getByRole('button',{name:'Select Ellipse',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(async()=>Number(await x.inputValue())).toBeCloseTo(expected,1);
 await page.getByRole('button',{name:'Add X keyframe',exact:true}).click();await frame(page,60);await x.fill('400');await x.press('Tab');await frame(page,0);
 await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>Number(await page.getByRole('spinbutton',{name:'Current frame',exact:true}).inputValue())).toBeGreaterThan(5);await page.getByRole('button',{name:'Pause',exact:true}).click();
 const current=Number(await page.getByRole('spinbutton',{name:'Current frame',exact:true}).inputValue());const animatedX=current>=60?400:expected+(400-expected)*current/60;const animatedY=256+20*512/canvas.height;await expect.poll(()=>translationExists(page,animatedX,animatedY)).toBe(true);
});
