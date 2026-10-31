import {cp,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
try{
  if(args.length&&!(args.length===2&&args[0]==='--dest'&&args[1]))throw Error('Usage: npm run skill:install -- [--dest /path/to/lottie-studio]');
  const destination=args.length?path.resolve(args[1]):path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills','lottie-studio');
  let exists=false;try{await stat(destination);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(exists)throw Error(`Destination already exists: ${destination}\nBack up or move the existing skill before installing. No files were changed.`);
  await mkdir(path.dirname(destination),{recursive:true});
  await cp(path.join(root,'skill'),destination,{recursive:true,errorOnExist:true,force:false});
  console.log(`Installed Moro (lottie-studio): ${destination}\nOpen a new Codex chat and use $lottie-studio.`);
}catch(e){console.error(e.message);process.exitCode=1;}
