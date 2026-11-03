import {parseProject,type CreatorProject} from '../../../../../packages/creator-core/src';
export type MotionExample={id:string;name:string;projectUrl:string;posterUrl:string};
export const EXAMPLE_NOTICE='Previously AI-generated example — opening this does not call AI';
export const MOTION_EXAMPLES:readonly MotionExample[]=[
  {id:'ai-chick',name:'Chick greeting',projectUrl:'/authoring/ai-chick/project.moro.json',posterUrl:'/authoring/ai-chick/poster.png'},
  {id:'ai-confetti',name:'Confetti celebration',projectUrl:'/authoring/ai-confetti/project.moro.json',posterUrl:'/authoring/ai-confetti/poster.png'},
];
export async function loadExample(example:MotionExample):Promise<CreatorProject> {
  const response=await fetch(example.projectUrl);
  if(!response.ok) throw new Error(`Could not load ${example.name}. Please retry.`);
  return parseProject(await response.text());
}
