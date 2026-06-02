// Floating media player widget.
import type { RefObject } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { mediaCurrentTime } from '../state';

interface Props {
  kind: 'audio' | 'video' | string;
  url: string;
  name: string;
  floating?: boolean;
}

export function MediaPlayer({ kind, url, name, floating }: Props) {
  if (kind !== 'audio' && kind !== 'video') return null;
  const ref = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const push = (): void => { mediaCurrentTime.value = el.currentTime || 0; };
    el.addEventListener('timeupdate', push);
    el.addEventListener('seeked', push);
    el.addEventListener('loadedmetadata', push);
    push();
    return () => {
      el.removeEventListener('timeupdate', push);
      el.removeEventListener('seeked', push);
      el.removeEventListener('loadedmetadata', push);
    };
  }, [url]);
  const cls = 'media-player media-player-' + kind + (floating ? ' media-player-floating' : '');
  return (
    <div class={cls}>
      {kind === 'audio'
        ? <audio controls preload="metadata" src={url} aria-label={name} ref={ref as RefObject<HTMLAudioElement>} />
        : <video controls preload="metadata" src={url} aria-label={name} ref={ref as RefObject<HTMLVideoElement>} />}
    </div>
  );
}
