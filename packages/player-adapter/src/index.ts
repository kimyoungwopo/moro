import lottie from 'lottie-web/build/player/lottie_light';
import type { AnimationItem } from 'lottie-web';
import type { Obj } from '../../document-core/src';
export function createPlayer(container: HTMLElement, document: Obj, onError: () => void, onReady: () => void): AnimationItem {
  const item = lottie.loadAnimation({ container, renderer: 'svg', animationData: structuredClone(document), loop: false, autoplay: false, rendererSettings: { progressiveLoad: false } });
  item.addEventListener('data_failed', onError);
  item.addEventListener('error', onError);
  item.addEventListener('DOMLoaded', onReady);
  return item;
}
