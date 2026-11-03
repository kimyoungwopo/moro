import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {mountLottie} from './player-fixture';

async function pixels(page:Page,selector:string){
 return page.locator(`${selector} svg`).evaluate(async element=>{
  const svg=element.cloneNode(true) as SVGSVGElement;svg.setAttribute('width','512');svg.setAttribute('height','512');
  const image=new Image();const ready=new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Native SVG failed to rasterize'));});image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await ready;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,512,512);
  return {corner:ctx.getImageData(177,207,1,1).data[3],center:ctx.getImageData(256,256,1,1).data[3],top:ctx.getImageData(256,207,1,1).data[3]};
 });
}

test('design quality: rounded rectangle changes real pixels, survives one Undo and native export/reopen',async({page,context},testInfo)=>{
 await page.goto('/create');await page.getByRole('button',{name:'Add rectangle',exact:true}).click();const radius=page.getByRole('spinbutton',{name:'Corner radius',exact:true});await expect(radius).toHaveValue('0');
 await expect.poll(async()=>(await pixels(page,'[data-testid="creator-preview"]')).corner).toBeGreaterThan(200);
 await radius.fill('20');await radius.press('Tab');await expect.poll(async()=>(await pixels(page,'[data-testid="creator-preview"]')).corner).toBe(0);const rounded=await pixels(page,'[data-testid="creator-preview"]');expect(rounded.center).toBeGreaterThan(200);expect(rounded.top).toBeGreaterThan(200);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(radius).toHaveValue('0');await expect.poll(async()=>(await pixels(page,'[data-testid="creator-preview"]')).corner).toBeGreaterThan(200);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(radius).toHaveValue('20');
 const saving=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();const source=testInfo.outputPath('rounded.moro.json');await(await saving).saveAs(source);const project=JSON.parse(await readFile(source,'utf8'));expect(project.layers[0].cornerRadius).toBe(20);
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export Lottie',exact:true}).click();const output=testInfo.outputPath('rounded-animation.json');await(await downloading).saveAs(output);const animation=JSON.parse(await readFile(output,'utf8'));expect(animation.layers[0].shapes.find((s:{ty:string})=>s.ty==='rc').r.k).toBe(20);
 const other=await context.newPage();await mountLottie(other,animation);await expect.poll(async()=>(await pixels(other,'#independent')).corner).toBe(0);expect((await pixels(other,'#independent')).center).toBeGreaterThan(200);
 await other.goto('/create');const choosing=other.waitForEvent('filechooser');await other.getByRole('button',{name:'Open project',exact:true}).click();await(await choosing).setFiles(source);await expect(other.getByRole('status')).toContainText('Opened');await other.getByRole('button',{name:'Select Rectangle',exact:true}).click();await expect(other.getByRole('spinbutton',{name:'Corner radius',exact:true})).toHaveValue('20');
 await other.setViewportSize({width:390,height:844});expect(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const field=await other.getByRole('spinbutton',{name:'Corner radius',exact:true}).boundingBox();expect(field?.height).toBeGreaterThanOrEqual(44);await other.screenshot({path:testInfo.outputPath('rounded-mobile.png'),fullPage:true});await other.getByRole('button',{name:'Add ellipse',exact:true}).click();await expect(other.getByRole('spinbutton',{name:'Corner radius',exact:true})).toHaveCount(0);await other.close();
});
