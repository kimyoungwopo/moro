import {PALETTES,paletteMapping} from './palettes';
import type {ColorGroup,Mapping} from '../../../packages/document-core/src';
type Props={groups:readonly ColorGroup[];mapping:Mapping;disabled:boolean;language:'en'|'ko';apply:(mapping:Mapping)=>void};
export function PalettePresets({groups,mapping,disabled,language,apply}:Props){
 const ko=language==='ko';
 return <section className="palette-presets" role="group" aria-label="Palette presets">
  <div className="preset-heading"><h3>{ko?'팔레트로 시작하기':'Start with a palette'}</h3><span>{ko?'한 번에 실행 취소':'One-step undo'}</span></div>
  <div className="preset-options">{PALETTES.map(p=>{
   const next=paletteMapping(groups,p);
   const selected=Object.keys(next).length>0&&groups.every(g=>(mapping[g.id]??g.hex)===(next[g.id]??g.hex));
   return <button key={p.id} aria-pressed={selected} disabled={disabled||!groups.length} onClick={()=>apply(next)}>
    <span className="preset-colors" aria-hidden="true">{[p.colors.primary,p.colors.accent,p.colors.neutral].map(c=><i key={c} style={{background:c}}/>)}</span>
    <span>{ko?p.nameKo:p.name}</span>
   </button>;
  })}</div>
  <p>{ko?'원본 색조를 기준으로 바꿔요. 아래에서 세부 조정하세요.':'Mapped from source tones. Fine-tune any color below.'}</p>
 </section>;
}
