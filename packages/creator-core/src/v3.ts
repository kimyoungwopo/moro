export * from './v3/types';
export * from './v3/io';
export * from './v3/evaluate';
export * from './v3/export';
import type {ProjectV3} from './v3/types';
export function blankProjectV3():ProjectV3 {return {version:3,name:'Untitled',width:512,height:512,fps:30,durationFrames:120,layers:[]};}
