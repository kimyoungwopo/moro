import {expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createProject} from '../packages/creator-core/src';
import MotionLibrary from '../apps/web/src/creator/library/MotionLibrary';
import {openLibraryProject,confirmDelete} from '../apps/web/src/creator/library/actions';
it('keeps the library open when the parent cancels unsaved-work confirmation',()=>{
  const close=vi.fn(),open=vi.fn(()=>false),project=createProject();
  openLibraryProject(project,'example',open,close);
  expect(open).toHaveBeenCalledWith(project,'example');expect(close).not.toHaveBeenCalled();
});
it('closes only after the parent accepts a saved document',()=>{
  const close=vi.fn(),open=vi.fn(()=>true);
  openLibraryProject(createProject(),'saved',open,close);expect(close).toHaveBeenCalledOnce();
});
it('requires explicit delete confirmation and waits for actual removal',async()=>{
  const remove=vi.fn(async()=>{}),confirm=vi.fn<(message:string)=>boolean>(()=>false);
  expect(await confirmDelete('motion-1','Greeting',confirm,remove)).toBe(false);
  expect(remove).not.toHaveBeenCalled();
  expect(confirm.mock.calls[0]?.[0]).toContain('Greeting');
  confirm.mockReturnValue(true);expect(await confirmDelete('motion-1','Greeting',confirm,remove)).toBe(true);
  expect(remove).toHaveBeenCalledWith('motion-1');
});
it('renders a labelled native dialog with compact Examples/Saved sections and loading state',()=>{
  const html=renderToStaticMarkup(createElement(MotionLibrary,{currentProject:createProject(),onOpen:()=>true,onClose:()=>{}}));
  expect(html).toContain('<dialog');expect(html).toContain('aria-labelledby=');
  for(const text of ['Examples','Saved','Save current project','Close','Loading saved motions','Chick greeting','Confetti celebration','Previously AI-generated example — opening this does not call AI']) expect(html).toContain(text);
  expect(html).toContain('/authoring/ai-chick/poster.png');
});
