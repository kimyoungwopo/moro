import type {Obj} from '../../../document-core/src';
import type {LayerV3,ProjectV3} from './types';

type Geometry={v:number[][];i:number[][];o:number[][];c:boolean};
function area(g:Geometry){let value=0;for(let n=0;n<g.v.length;n++){const next=(n+1)%g.v.length,p=g.v[n],q=g.v[next],a=[p[0]+g.o[n][0],p[1]+g.o[n][1]],b=[q[0]+g.i[next][0],q[1]+g.i[next][1]];const polynomial=(axis:number)=>[p[axis],3*(a[axis]-p[axis]),3*(p[axis]-2*a[axis]+b[axis]),-p[axis]+3*a[axis]-3*b[axis]+q[axis]];const x=polynomial(0),y=polynomial(1);for(let i=0;i<4;i++)for(let j=1;j<4;j++)value+=(x[i]*j*y[j]-y[i]*j*x[j])/(i+j);}return value/2;}

// Official SVG inversion uses a positive comp-sized outer contour and nonzero
// winding. Normalize into that coordinate window and reverse the hole contour.
// A generated vector-only precomp keeps all original world transforms intact.
export function normalizeInvertedMasksV3(node:Obj,layer:LayerV3,project:ProjectV3,assets:Obj[]):Obj{
 if(layer.type==='group'||!layer.masks.some(m=>m.inverted))return node;
 let extent=1;
 const hull=(p:{vertices:number[][];inTangents:number[][];outTangents:number[][]})=>{for(let i=0;i<p.vertices.length;i++)for(const tangent of [[0,0],p.inTangents[i],p.outTangents[i]])extent=Math.max(extent,Math.abs(p.vertices[i][0]+tangent[0]),Math.abs(p.vertices[i][1]+tangent[1]));};
 if(layer.type==='path'){hull(layer.path);for(const key of layer.pathKeys)hull(key.value);}else extent=Math.max(extent,layer.width/2,layer.height/2);
 for(const mask of layer.masks)hull(mask.path);
 extent=Math.ceil(extent+layer.strokeWidth+2);
 const side=Math.min(project.width,project.height),factor=side/(2*extent),origin=extent*factor;
 const geometry=(g:Geometry,inverted=false)=>{if(inverted&&!g.c){g.c=true;g.v=[[0,0],[0,0],[0,0]];g.i=[[0,0],[0,0],[0,0]];g.o=[[0,0],[0,0],[0,0]];}if(inverted&&area(g)>0){g.v.reverse();const incoming=g.i;g.i=g.o.reverse();g.o=incoming.reverse();}g.v=g.v.map(v=>[(v[0]+extent)*factor,(v[1]+extent)*factor]);g.i=g.i.map(v=>[v[0]*factor,v[1]*factor]);g.o=g.o.map(v=>[v[0]*factor,v[1]*factor]);};
 const masks=node.masksProperties as Obj[];
 for(let n=0;n<masks.length;n++){const g=(masks[n].pt as Obj).k as unknown as Geometry;geometry(g,layer.masks[n].inverted);}
 const shapes=node.shapes as Obj[];
 for(const item of shapes){if(item.ty==='sh'){const prop=item.ks as Obj;if(prop.a===0)geometry(prop.k as unknown as Geometry);else for(const key of prop.k as Obj[])for(const field of ['s','e'])if(Array.isArray(key[field]))for(const g of key[field] as unknown as Geometry[])geometry(g);}
  else if(item.ty==='rc'||item.ty==='el'){(item.p as Obj).k=[origin,origin];(item.s as Obj).k=((item.s as Obj).k as number[]).map(n=>n*factor);if(item.ty==='rc')(item.r as Obj).k=((item.r as Obj).k as number)*factor;}
  else if(item.ty==='st')(item.w as Obj).k=((item.w as Obj).k as number)*factor;
 }
 const inner:Obj={...node,ind:1,nm:`${layer.name} · normalized local mask`,ks:{a:{a:0,k:[0,0,0]},p:{a:0,k:[0,0,0]},s:{a:0,k:[100,100,100]},r:{a:0,k:0},o:{a:0,k:100}}};delete inner.parent;
 const ks=node.ks as Obj;ks.a={a:0,k:[(layer.pivot[0]+extent)*factor,(layer.pivot[1]+extent)*factor,0]};
 const scale=ks.s as Obj;
 const enlarge=(values:unknown)=>{const v=values as number[];return[v[0]/factor,v[1]/factor,100];};
 if(scale.a===0)scale.k=enlarge(scale.k);else for(const key of scale.k as Obj[]){key.s=enlarge(key.s);if(key.e)key.e=enlarge(key.e);}
 const refId=`moro-local-mask-${node.ind}`;assets.push({id:refId,w:side,h:side,layers:[inner]});
 const outer:Obj={...node,ty:0,refId,w:side,h:side};delete outer.shapes;delete outer.masksProperties;delete outer.hasMask;return outer;
}
