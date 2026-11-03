#!/usr/bin/env node
// Only repository-owned core source is bundled/imported. Input stays JSON data.
import { open, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HELP=`Moro shape animation authoring (local, no network)
Prerequisite: Node >=22.13 and npm ci in the repository.
Usage: node scripts/moro-create.mjs --input project.moro.json --out animation.json
       node scripts/moro-create.mjs --input project.moro.json --validate
--validate checks data only; if --out is supplied it must not already exist.
Never overwrites files (including symlinks). Input is JSON data, never executable code.
Supported: rectangles/ellipses; x/y/scale/rotation/opacity keys; linear/ease-in/ease-out/ease-in-out.
Canvas: integer 16–4096 px; integer 1–120 fps; integer 2–3600 frames.
Maximum 100 layers, 100 keys/property; integer keys 0..durationFrames-1.
Shape size 1–4096; position -8192..8192; scale 1–1000; rotation -3600..3600;
opacity 0–100; strokeWidth 0–100; colors #RRGGBB. Names/IDs 1–200 characters.
Input maximum 8 MiB UTF-8. No expressions, assets, text, SVG or animated colors.
`;
async function main() {
  const args=process.argv.slice(2), options=new Map();
  if(args.length===1 && args[0]==='--help') { process.stdout.write(HELP); return; }
  for(let i=0;i<args.length;i++) {
    const flag=args[i];
    if(!['--input','--out','--validate'].includes(flag) || options.has(flag)) throw new Error(`Unknown or repeated argument: ${flag}`);
    if(flag==='--validate') options.set(flag,true);
    else { const value=args[++i]; if(!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`); options.set(flag,value); }
  }
  if(!options.has('--input') || (!options.has('--validate') && !options.has('--out'))) throw new Error('Expected --input and --out (or --validate). Use --help.');
  const out=options.get('--out');
  if(out) {
    try { await lstat(out); throw new Error('Output already exists; refusing overwrite.'); }
    catch(error) { if(error.code!=='ENOENT') throw error; }
  }
  const file=await open(options.get('--input'),'r'); let bytes;
  try {
    const stat=await file.stat(); if(!stat.isFile() || stat.size>8*1024*1024) throw new Error('Input must be a regular file of at most 8 MiB.');
    // Bounded read even if the input grows after stat.
    const buffer=Buffer.alloc(8*1024*1024+1); let count=0;
    while(count<buffer.length) { const read=await file.read(buffer,count,buffer.length-count,null); if(!read.bytesRead) break; count+=read.bytesRead; }
    if(count>8*1024*1024) throw new Error('Input exceeds 8 MiB.'); bytes=buffer.subarray(0,count);
  } finally { await file.close(); }
  const bundled=await build({entryPoints:[fileURLToPath(new URL('../packages/creator-core/src/index.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',target:'node22',logLevel:'silent'});
  const {parseProject,exportLottie}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const project=parseProject(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(options.has('--validate')) { process.stdout.write(`Valid project: ${project.layers.length} layers, ${project.durationFrames} frames.\n`); return; }
  const text=JSON.stringify(exportLottie(project),null,2)+'\n';
  const target=await open(out,'wx');
  try { await target.writeFile(text,'utf8'); } finally { await target.close(); }
  process.stdout.write(`Exported ${Buffer.byteLength(text)} bytes to ${out}\n`);
}
main().catch(error=>{ process.stderr.write(`moro-create: ${error.message}\n`); process.exitCode=1; });
