import type {ProjectV3} from '../../../../packages/creator-core/src/v3';
export type StudioHistory={past:ProjectV3[];present:ProjectV3;future:ProjectV3[];revision:number};
export const createDocument=(present:ProjectV3):StudioHistory=>({past:[],present,future:[],revision:0});
export function commitDocument(history:StudioHistory,present:ProjectV3):StudioHistory{
 if(JSON.stringify(history.present)===JSON.stringify(present))return history;
 return {past:[...history.past,history.present].slice(-100),present:structuredClone(present),future:[],revision:history.revision+1};
}
export function undoDocument(history:StudioHistory):StudioHistory{
 if(!history.past.length)return history;
 return {past:history.past.slice(0,-1),present:history.past.at(-1)!,future:[history.present,...history.future],revision:history.revision+1};
}
export function redoDocument(history:StudioHistory):StudioHistory{
 if(!history.future.length)return history;
 return {past:[...history.past,history.present],present:history.future[0],future:history.future.slice(1),revision:history.revision+1};
}
