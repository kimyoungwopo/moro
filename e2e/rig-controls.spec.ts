import {test,expect} from '@playwright/test';
test('Rig lab export action remains readable on hover',async({page})=>{
 await page.goto('/rig');const button=page.getByRole('button',{name:'Export Lottie',exact:true});await button.hover();
 const contrast=await button.evaluate(el=>{const s=getComputedStyle(el),l=(value:string)=>{const numbers=value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(x=>{const n=x/255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);});return numbers[0]*.2126+numbers[1]*.7152+numbers[2]*.0722;};const a=l(s.color),b=l(s.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
 expect(contrast).toBeGreaterThanOrEqual(4.5);
});
