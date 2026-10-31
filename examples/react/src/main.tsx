import { createRoot } from 'react-dom/client';
import Auto from './auto';
import Hover from './hover';
import Click from './click';
createRoot(document.getElementById('root')!).render(<main style={{fontFamily:'system-ui',maxWidth:1000,margin:'40px auto'}}><h1>Moro React export example</h1><p>Generated from the same code used by Export. Each mode also has a keyboard-accessible play button.</p><div style={{display:'flex',gap:20}}>{[["Autoplay",Auto],["Hover / focus",Hover],["Click / tap",Click]].map(([title,Component]) => { const Animation = Component as typeof Auto; return <section style={{flex:1,minWidth:0}} key={String(title)}><h2>{String(title)}</h2><Animation /></section>; })}</div></main>);
