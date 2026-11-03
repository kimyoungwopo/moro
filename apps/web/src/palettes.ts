import {setColor,type ColorGroup,type Mapping} from '../../../packages/document-core/src';
export type Palette={id:string;name:string;nameKo:string;colors:{primary:string;accent:string;neutral:string;ink:string;paper:string}};
export const PALETTES:readonly Palette[]=[
 {id:'lagoon',name:'Lagoon',nameKo:'라군',colors:{primary:'#177D70',accent:'#E8AE56',neutral:'#DBEEE9',ink:'#173B35',paper:'#FFFFFF'}},
 {id:'ember',name:'Ember',nameKo:'엠버',colors:{primary:'#C24B3A',accent:'#E6AD56',neutral:'#F0E1D8',ink:'#49352E',paper:'#FFFDF9'}},
 {id:'ink',name:'Ink',nameKo:'잉크',colors:{primary:'#35424C',accent:'#8098A4',neutral:'#E5EBEE',ink:'#1A252C',paper:'#FFFFFF'}}
];
export function paletteMapping(groups:readonly ColorGroup[],palette:Palette):Mapping {
 return groups.reduce<Mapping>((mapping,group)=>{
  const [r,g,b]=group.rgb,high=Math.max(r,g,b),low=Math.min(r,g,b);
  const role: keyof Palette['colors']=low>.94?'paper':high<.32?'ink':high-low<.16&&high>.65?'neutral':g>=r&&b>=r?'primary':'accent';
  return setColor(mapping,group,palette.colors[role]);
 },{});
}
