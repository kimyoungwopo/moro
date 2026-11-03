import { inverseMatrixV2, transformPointV2, worldMatricesV2, sampleLayerV2, updateLayerV2, setKeyframeV2 } from '../../../../packages/creator-core/src/v2';
import type { ProjectV2, Vec2 } from '../../../../packages/creator-core/src/v2';
export type Handle = {kind:'vertex'|'in'|'out';index:number};
export function nearestHandle(project:ProjectV2,id:string,frame:number,point:Vec2,selectedVertex:number):Handle {
 const node=project.layers.find(layer=>layer.id===id);if(node?.type!=='path')throw Error('Select a path first.');
 const matrix=worldMatricesV2(project,frame).get(id)!;
 const candidates:{handle:Handle;point:Vec2}[]=node.path.vertices.map((p,index)=>({handle:{kind:'vertex',index},point:p}));
 const vertex=node.path.vertices[selectedVertex];if(!vertex)throw Error('Invalid vertex.');
 for(const kind of ['in','out'] as const){
  if(!node.path.closed&&((kind==='in'&&selectedVertex===0)||(kind==='out'&&selectedVertex===node.path.vertices.length-1)))continue;
  const tangent=node.path[kind==='in'?'inTangents':'outTangents'][selectedVertex];
  candidates.push({handle:{kind,index:selectedVertex},point:[vertex[0]+tangent[0],vertex[1]+tangent[1]]});
 }
 let best=candidates[0].handle,distance=Infinity;
 for(const candidate of candidates){const world=transformPointV2(matrix,candidate.point);const d=(point[0]-world[0])**2+(point[1]-world[1])**2;if(d<distance){distance=d;best=candidate.handle;}}
 return best;
}
export function dragLayer(project:ProjectV2,id:string,frame:number,from:Vec2,to:Vec2):ProjectV2 {
 const node=project.layers.find(layer=>layer.id===id);if(!node)throw Error('Layer no longer exists.');
 const matrices=worldMatricesV2(project,frame);
 const parent=node.parentId?matrices.get(node.parentId)!:([1,0,0,1,0,0] as const);
 const inverse=inverseMatrixV2([...parent]);const a=transformPointV2(inverse,from);const b=transformPointV2(inverse,to);
 const pose=sampleLayerV2(node,frame);let next=project;
 for(const [property,value] of [['x',pose.x+(b[0]-a[0])],['y',pose.y+(b[1]-a[1])]] as const){
  next=node.tracks[property].length?setKeyframeV2(next,id,property,frame,value):updateLayerV2(next,id,{[property]:value});
 }
 return next;
}
export function dragHandle(project:ProjectV2,id:string,frame:number,handle:Handle,world:Vec2):ProjectV2 {
 const node=project.layers.find(layer=>layer.id===id);if(node?.type!=='path')throw Error('Select a path first.');
 const {kind,index}=handle;
 if(!Number.isInteger(index)||index<0||index>=node.path.vertices.length)throw Error('Invalid vertex.');
 if(!node.path.closed&&((kind==='in'&&index===0)||(kind==='out'&&index===node.path.vertices.length-1)))throw Error('Unused open-path endpoint tangent.');
 const local=transformPointV2(inverseMatrixV2(worldMatricesV2(project,frame).get(id)!),world);
 const path=structuredClone(node.path);const vertex=path.vertices[index];
 if(kind==='vertex')path.vertices[index]=local;
 else path[kind==='in'?'inTangents':'outTangents'][index]=[local[0]-vertex[0],local[1]-vertex[1]];
 return updateLayerV2(project,id,{path});
}
export function convertPath(project:ProjectV2,id:string,closed:boolean):ProjectV2 {
 const node=project.layers.find(layer=>layer.id===id);if(node?.type!=='path')throw Error('Select a path first.');
 if(node.path.closed===closed)return project;
 const path=structuredClone(node.path);path.closed=closed;
 if(!closed){path.inTangents[0]=[0,0];path.outTangents[path.vertices.length-1]=[0,0];}
 return updateLayerV2(project,id,{path,fill:closed?node.fill:null});
}
