import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {checkAuthoring} from './check-authoring.mjs';
async function fixture(){const root=await mkdtemp(path.join(tmpdir(),'moro-guidance-'));const put=async(name,body)=>{await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),body);};
 await put('skills/lottie-authoring/SKILL.md','---\nname: lottie-authoring\ndescription: Create supported Lottie animations locally.\n---\n# Create\nRead [composition](references/composition.md).\n');
 for(const name of ['composition','motion-principles','timing-and-easing','looping','lottie-compatibility'])await put(`skills/lottie-authoring/references/${name}.md`,'# Reference\nAuthored guidance.');
 for(const name of ['loader','success-feedback','product-interaction'])await put(`skills/lottie-authoring/recipes/${name}.md`,'# Recipe\nSupported shapes only.');
 await put('docs/creator/REFERENCES.md','# Sources\nAuthored fixtures, not vendor evidence.');
 await put('docs/creator/AUTHORING-DESIGN.md','# Design\nKeep data and UI distinct.');
 for(const name of ['loader','success-feedback','product-interaction']){await put(`examples/authoring/${name}/brief.md`,'# Fixture brief\nOnly a checker fixture.');await put(`examples/authoring/${name}/project.moro.json`,JSON.stringify({version:1,width:512,height:512,fps:60,durationFrames:120,layers:[{id:'shape'}]}));await put(`examples/authoring/${name}/animation.json`,JSON.stringify({v:'5.13.0',w:512,h:512,fr:60,ip:0,op:120,layers:[{ty:4}]}));}
 return {root,put,close:()=>rm(root,{recursive:true,force:true})};}
test('a complete local reading map passes without pretending to auto-load a model',async()=>{const f=await fixture();try{const r=await checkAuthoring(f.root);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.agentAutomaticallyLoaded,false);assert.equal(r.examples,3);}finally{await f.close();}});
test('missing skill fails rather than claiming guidance is installed',async()=>{const f=await fixture();try{await rm(path.join(f.root,'skills/lottie-authoring/SKILL.md'));const r=await checkAuthoring(f.root);assert.equal(r.ok,false);assert.match(r.errors.join(' '),/SKILL/);}finally{await f.close();}});
test('a broken relative reference is reported with its source',async()=>{const f=await fixture();try{await f.put('skills/lottie-authoring/references/composition.md','Read [missing](missing.md).');const r=await checkAuthoring(f.root);assert.equal(r.ok,false);assert.match(r.errors.join(' '),/composition.*missing/);}finally{await f.close();}});
test('missing generated export is not promoted to a completed example',async()=>{const f=await fixture();try{await rm(path.join(f.root,'examples/authoring/loader/animation.json'));const r=await checkAuthoring(f.root);assert.equal(r.ok,false);assert.match(r.errors.join(' '),/loader.*animation/);}finally{await f.close();}});
test('malformed skill frontmatter fails',async()=>{const f=await fixture();try{await f.put('skills/lottie-authoring/SKILL.md','# No frontmatter');assert.equal((await checkAuthoring(f.root)).ok,false);}finally{await f.close();}});
test('references cannot escape the checkout',async()=>{const f=await fixture();try{await f.put('skills/lottie-authoring/references/composition.md','[escape](../../../../../../private.md)');const r=await checkAuthoring(f.root);assert.equal(r.ok,false);assert.match(r.errors.join(' '),/outside/);}finally{await f.close();}});
