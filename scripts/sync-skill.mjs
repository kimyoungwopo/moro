import {readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url));
const check=process.argv.includes('--check'),mismatches=[],expected=new Map();
async function collect(directory='') {
  for(const entry of await readdir(path.join(root,'dist',directory),{withFileTypes:true})) {
    const relative=path.join(directory,entry.name);
    if(entry.isDirectory())await collect(relative);else expected.set(path.join('assets/editor',relative),await readFile(path.join(root,'dist',relative)));
  }
}
await collect();
const bundle=await build({entryPoints:[path.join(root,'packages/document-core/src/index.ts')],bundle:true,write:false,format:'esm',platform:'node',target:'node22'});
expected.set('assets/document-core.mjs',Buffer.from(bundle.outputFiles[0].text));
expected.set('assets/server.mjs',Buffer.from((await readFile(path.join(root,'server.mjs'),'utf8')).replace("'./dist/'","'./editor/'")));
expected.set('LICENSE',await readFile(path.join(root,'LICENSE')));
expected.set('assets/THIRD_PARTY_NOTICES.md',await readFile(path.join(root,'THIRD_PARTY_NOTICES.md')));
for(const font of ['ibm-plex-sans','ibm-plex-mono'])expected.set(`assets/licenses/${font}-OFL.txt`,await readFile(path.join(root,`node_modules/@fontsource/${font}/LICENSE`)));
async function files(dir,base=''){let out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const rel=path.join(base,entry.name);out.push(...entry.isDirectory()?await files(path.join(dir,entry.name),rel):[rel]);}return out;}
if(check){
 for(const [name,content] of expected){let actual;try{actual=await readFile(path.join(root,'skill',name));}catch{}if(!actual?.equals(content))mismatches.push(name);}
 for(const name of await files(path.join(root,'skill/assets')))if(!expected.has(path.join('assets',name)))mismatches.push(`stale assets/${name}`);
}else{
 await rm(path.join(root,'skill/assets'),{recursive:true,force:true});
 for(const [name,content] of expected){const target=path.join(root,'skill',name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,content);}
}
if(mismatches.length){console.error(`Skill is out of sync:\n${mismatches.join('\n')}`);process.exitCode=1;}else console.log(check?'Skill matches the built app and document core.':'Skill assets synchronized.');
