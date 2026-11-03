import type {Page} from '@playwright/test';
import type {AnimationItem} from 'lottie-web';
import path from 'node:path';
type PlayerWindow=Window & {lottie:{loadAnimation(options:Record<string,unknown>):AnimationItem};independentPlayer?:AnimationItem};
// Isolated page + the installed player only: no Creator UI, overlay or sampleLayer in the renderer.
export async function mountLottie(page:Page,animation:unknown){
 await page.goto('about:blank');await page.setContent('<!doctype html><html><head><title>Independent Lottie playback</title><style>html,body{margin:0;min-height:100%;background:#e5edef}body{display:grid;place-items:center;min-height:100vh}#independent{width:min(80vw,512px);aspect-ratio:1;background:white}#independent svg{display:block}</style></head><body><div id="independent" data-testid="independent-player"></div></body></html>');
 await page.addScriptTag({path:path.resolve('node_modules/lottie-web/build/player/lottie_light.min.js')});
 await page.evaluate(data=>{const browser=window as unknown as PlayerWindow;const item=browser.lottie.loadAnimation({container:document.getElementById('independent'),renderer:'svg',loop:false,autoplay:false,animationData:data});browser.independentPlayer=item;
  return new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Independent player timed out')),5000);const done=()=>{clearTimeout(timer);resolve();};if(item.isLoaded)done();else item.addEventListener('DOMLoaded',done);item.addEventListener('data_failed',()=>{clearTimeout(timer);reject(Error('Independent player rejected data'));});});
 },animation);
}
export async function seekLottie(page:Page,frame:number){await page.evaluate(f=>(window as unknown as PlayerWindow).independentPlayer?.goToAndStop(f,true),frame);}
export async function hasTranslation(page:Page,selector:string,x:number,y:number){return page.locator(selector).locator('svg g[transform]').evaluateAll((elements,target)=>elements.some(el=>{const match=/^matrix\(([^)]+)\)$/.exec(el.getAttribute('transform')??'');if(!match)return false;const a=match[1].split(/[\s,]+/).map(Number);return a.length===6&&Math.abs(a[4]-target.x)<.05&&Math.abs(a[5]-target.y)<.05;}),{x,y});}
