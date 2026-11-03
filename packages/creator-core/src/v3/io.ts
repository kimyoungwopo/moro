import type {ProjectV3} from './types';
import {fail,validateProjectV3} from './validate';
export {validateProjectV3} from './validate';
export function checkSizeV3(text:string,max=8*1024*1024){if(typeof text!=='string'||text.length>max||new TextEncoder().encode(text).length>max)fail('size limit');}
// Predecode walk rejects duplicates even when property names use JSON escapes.
function strictJSON(text:string):unknown {let i=0;const ws=()=>{while(i<text.length&&/[\x20\n\r\t]/.test(text[i]))i++;};
 function string():string {const start=i++;while(i<text.length){const c=text[i++];if(c==='"'){try{return JSON.parse(text.slice(start,i)) as string;}catch{fail('JSON string');}}if(c==='\\')i++;}return fail('JSON string');}
 function value(depth:number):void {ws();const ch=text[i];if(ch==='{'||ch==='['){if(depth>=32)fail('JSON depth limit');i++;ws();const object=ch==='{',end=object?'}':']',seen=new Set<string>();if(text[i]===end){i++;return;}while(i<text.length){if(object){if(text[i]!=='"')fail('JSON object key');const key=string();if(seen.has(key))fail('duplicate JSON key');seen.add(key);ws();if(text[i++]!==':')fail('JSON colon');}value(depth+1);ws();if(text[i]===end){i++;return;}if(text[i++]!==',')fail('JSON separator');ws();}fail('JSON container');}if(ch==='"'){string();return;}const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));if(!m)fail('JSON value');i+=m[0].length;}
 value(0);ws();if(i!==text.length)fail('JSON trailing content');return JSON.parse(text);
}
export function parseProjectV3(text:string):ProjectV3 {checkSizeV3(text);const value=strictJSON(text);validateProjectV3(value);return value;}
export function serializeProjectV3(project:ProjectV3):string {validateProjectV3(project);const text=JSON.stringify(project,null,2)+'\n';checkSizeV3(text);return text;}
