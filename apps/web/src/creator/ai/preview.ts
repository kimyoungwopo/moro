import { exportLottie } from '../../../../../packages/creator-core/src';
import type { CreatorProject } from '../../../../../packages/creator-core/src';
import { createPlayer } from '../../../../../packages/player-adapter/src';
export type PreviewCallbacks = { onFrame: (frame: number) => void; onPlaying: (playing: boolean) => void; onError: () => void; loop?: boolean };
export type ProposalPlayback = { seek: (frame: number) => void; play: () => void; pause: () => void; destroy: () => void };
// DOM/player I/O only. Export once per mount, never per seek or playback tick.
export function mountProposalPreview(host: HTMLElement, project: CreatorProject, callbacks: PreviewCallbacks): ProposalPlayback {
  let live = true, frame = 0;
  const last = project.durationFrames - 1;
  const item = createPlayer(host, exportLottie(project), () => { if (live) callbacks.onError(); }, () => { if (live) item.goToAndStop(frame, true); });
  const enterFrame = () => {
    if (!live) return;
    frame = Math.max(0, Math.min(last, Math.floor(item.currentFrame)));
    callbacks.onFrame(frame);
  };
  const complete = () => {
    if (!live) return;
    frame = last; item.goToAndStop(last, true); callbacks.onFrame(frame); callbacks.onPlaying(false);
  };
  item.setLoop(callbacks.loop === true);
  item.addEventListener('enterFrame', enterFrame);
  item.addEventListener('complete', complete);
  item.goToAndStop(0, true);
  return {
    seek(value) {
      if (!live || !Number.isFinite(value)) return;
      frame = Math.max(0, Math.min(last, Math.round(value)));
      item.goToAndStop(frame, true); callbacks.onFrame(frame); callbacks.onPlaying(false);
    },
    play() {
      if (!live) return;
      if (frame >= last) { frame = 0; item.goToAndStop(0, true); callbacks.onFrame(0); }
      item.play(); callbacks.onPlaying(true);
    },
    pause() { if (live) { item.pause(); callbacks.onPlaying(false); } },
    destroy() {
      if (!live) return;
      live = false;
      item.removeEventListener('enterFrame', enterFrame);
      item.removeEventListener('complete', complete);
      item.destroy();
    },
  };
}
