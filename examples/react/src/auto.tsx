import { useEffect, useRef, useState } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';
import type { AnimationItem } from 'lottie-web';
import animationData from './orbit.moro.json';

// lottie-web 5.13.0. This document was checked by Moro before export.
export default function MoroAnimation() {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<AnimationItem | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const item = lottie.loadAnimation({ container: host.current, renderer: 'svg',
      animationData: structuredClone(animationData), loop: true, autoplay: false });
    player.current = item;
    item.setSpeed(1);
    const start = !reduced ? true : false;
    if (start) item.play();
    const started = () => setPlaying(true);
    const stopped = () => setPlaying(false);
    item.addEventListener('enterFrame', started);
    item.addEventListener('complete', stopped);
    return () => { item.destroy(); player.current = null; };
  }, []);
  function play() { player.current?.play(); setPlaying(true); }
  function pause() { player.current?.pause(); setPlaying(false); }

  return <div >
    <div ref={host} aria-hidden="true" style={{ width: '100%', maxWidth: 400, aspectRatio: String(animationData.w) + ' / ' + String(animationData.h) }} />
    <button type="button" aria-pressed={playing} onClick={() => playing ? pause() : play()}>
      {playing ? 'Pause animation' : 'Play animation'}
    </button>
  </div>;
}
