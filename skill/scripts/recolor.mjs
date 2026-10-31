import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {parseDocument,setColor,exportJson,reactSource,LIGHT_DECLARATION} from '../assets/document-core.mjs';
const args=process.argv.slice(2),opts={maps:[]};
try {
 for(let i=0;i<args.length;i++) {
  const flag=args[i];if(flag==='--react'){opts.react=true;continue;}
  if(!['--input','--sample','--map','--out'].includes(flag)||!args[i+1])throw Error('Usage: --input file | --sample orbit, --map "#SOURCE=#TARGET", --out file [--react]');
  if(flag==='--map')opts.maps.push(args[++i]);else opts[flag.slice(2)]=args[++i];
 }
 if((!opts.input&&!opts.sample)||(opts.input&&opts.sample)||!opts.out)throw Error('Choose exactly one --input or --sample and provide --out.');
 if(opts.sample&&!['orbit','success','burst'].includes(opts.sample))throw Error('Unknown sample.');
 const input=opts.input?path.resolve(opts.input):new URL(`../assets/editor/samples/${opts.sample}.json`,import.meta.url);
 if((await stat(input)).size>2*1024*1024)throw Error('File exceeds 2 MB.');
 const doc=parseDocument(await readFile(input),opts.input?path.basename(opts.input):`${opts.sample}.json`);
 let mapping={};for(const value of opts.maps){const match=/^(#[0-9a-f]{6})=(#[0-9a-f]{6})$/i.exec(value);if(!match)throw Error(`Invalid mapping: ${value}`);const groups=doc.groups.filter(g=>g.hex===match[1].toUpperCase());if(groups.length!==1)throw Error(`Source ${match[1]} matched ${groups.length} groups. Use the web UI for ambiguous RGB values.`);mapping=setColor(mapping,groups[0],match[2]);}
 const output=path.resolve(opts.out);const generated=new Map([[output,exportJson(doc,mapping)]]);
 if(opts.react){if(!/^[a-zA-Z0-9_.-]+$/.test(path.basename(output)))throw Error('React export filenames must use letters, digits, dot, dash or underscore.');generated.set(path.join(path.dirname(output),'MoroAnimation.tsx'),reactSource(path.basename(output),{autoplay:true,loop:true,speed:1,trigger:'auto'}));generated.set(path.join(path.dirname(output),'lottie-light.d.ts'),LIGHT_DECLARATION);}
 for(const name of generated.keys()){let exists=false;try{await stat(name);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}if(exists)throw Error(`Output already exists: ${name}`);}
 for(const [name,content] of generated)await writeFile(name,content,{flag:'wx'});
 console.log(`Exported ${generated.size} local file(s): ${output}`);
}catch(e){console.error(e.message);process.exitCode=1;}
