import {test,expect} from '@playwright/test';
import {addLayerV2,createProjectV2,serializeProjectV2} from '../packages/creator-core/src/v2';
test('Rig lab preserves editable work and offers a save when a valid project exceeds export complexity',async({page})=>{
 let project=createProjectV2();for(let i=0;i<12;i++)project=addLayerV2(project,'rect');
 for(const layer of project.layers)for(const property of ['x','y','scale','rotation','opacity'] as const)layer.tracks[property]=Array.from({length:100},(_,frame)=>({frame,value:property==='scale'?frame+1:frame,easing:'linear' as const}));
 const text=serializeProjectV2(project);await page.goto('/rig');
 await page.getByLabel('Open v2 project file',{exact:true}).setInputFiles({name:'editable-but-overcomplex.moro.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await expect(page.getByRole('heading',{name:'Rig lab',exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText(/export|complexity/i);
 await expect(page.getByRole('button',{name:'Export Lottie',exact:true})).toBeDisabled();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save v2 project',exact:true}).click();const download=await pending;expect(download.suggestedFilename()).toMatch(/\.moro\.json$/);
});
