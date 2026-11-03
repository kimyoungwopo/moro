import {readFile,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Structural reading-map checks only. Runtime authoring/export and visual quality have separate gates.
export async function checkAuthoring(directory){
 const root=await realpath(path.resolve(directory)),errors=[],readFiles=new Set();let examples=0;
 const within=p=>p===root||p.startsWith(root+path.sep);
 async function read(relative){const absolute=path.resolve(root,relative);if(!within(absolute)){errors.push(`${relative}: outside checkout`);return null;}
  try{const resolved=await realpath(absolute);if(!within(resolved)){errors.push(`${relative}: symlink outside checkout`);return null;}const text=await readFile(absolute,'utf8');readFiles.add(relative);return text;}catch{errors.push(`${relative}: missing or unreadable`);return null;}}
 async function markdownTree(relative){const all=[];try{for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){const name=path.join(relative,entry.name);if(entry.isDirectory())all.push(...await markdownTree(name));else if(entry.isFile()&&entry.name.endsWith('.md'))all.push(name);else if(entry.isSymbolicLink())errors.push(`${name}: unreviewed reference symlink`);}}catch{errors.push(`${relative}: missing directory`);}return all;}
 const skill='skills/lottie-authoring/SKILL.md';const source=await read(skill);
 if(source!==null){const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(source);if(!match||!/^name:\s*["']?lottie-authoring["']?\s*$/m.test(match[1])||!/^description:\s*\S/m.test(match[1])||!match[2].trim())errors.push(`${skill}: invalid required frontmatter fields/body`);}
 const references=await markdownTree('skills/lottie-authoring/references');
 const recipes=await markdownTree('skills/lottie-authoring/recipes');
 if(references.length<5)errors.push('authoring references: expected at least five focused references');
 if(recipes.length<3)errors.push('authoring recipes: expected at least three supported recipes');
 const documents=[skill,...references,...recipes,'docs/creator/REFERENCES.md','docs/creator/AUTHORING-DESIGN.md'];
 for(const document of documents){const text=document===skill?source:await read(document);if(text===null)continue;
  for(const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/g)){
   const href=match[1].replace(/^<|>$/g,'');if(/^(?:[a-z]+:|#)/i.test(href))continue;
   let target;try{target=decodeURIComponent(href.split(/[?#]/)[0]);}catch{errors.push(`${document}: invalid link ${href}`);continue;}
   if(!target)continue;const absolute=path.resolve(root,path.dirname(document),target);
   if(!within(absolute)){errors.push(`${document}: link outside checkout: ${href}`);continue;}
   try{if(!within(await realpath(absolute)))errors.push(`${document}: link symlink outside checkout: ${href}`);}catch{errors.push(`${document}: missing link ${href}`);}
  }
 }
 for(const name of ['loader','success-feedback','product-interaction']){
  const prefix=`examples/authoring/${name}`;await read(`${prefix}/brief.md`);
  const input=await read(`${prefix}/project.moro.json`),output=await read(`${prefix}/animation.json`);
  if(input===null||output===null)continue;
  try{const project=JSON.parse(input),animation=JSON.parse(output);
   if(project.version!==1||!Array.isArray(project.layers)||!project.layers.length)throw Error('invalid editable project structure');
   if(typeof animation.v!=='string'||!Array.isArray(animation.layers)||!animation.layers.length||animation.w!==project.width||animation.h!==project.height||animation.fr!==project.fps||animation.op!==project.durationFrames)throw Error('generated animation metadata does not match project');
   examples++;
  }catch(error){errors.push(`${prefix}: ${error.message}`);}
 }
 return {ok:errors.length===0,errors,examples,references:references.length,recipes:recipes.length,readFiles:[...readFiles].sort(),agentAutomaticallyLoaded:false,scope:'structural files, required frontmatter fields and local links; not runtime/visual approval'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const root=process.argv[2]??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const result=await checkAuthoring(root);console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}
