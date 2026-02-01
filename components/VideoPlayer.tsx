
import React, { useMemo } from 'react';
import { Channel } from '../types';

interface VideoPlayerProps {
  channel: Channel | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ channel }) => {
  const isTV = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('tv') || ua.includes('googletv') || ua.includes('apple tv') || ua.includes('firetv') || ua.includes('smarttv');
  }, []);

  const playerUrl = useMemo(() => {
    if (!channel) return null;
    
    try {
      const sourceUrl = channel.url;
      const urlObj = new URL(sourceUrl);
      
      let hdnea = urlObj.searchParams.get('__hdnea__');
      if (!hdnea && sourceUrl.includes('__hdnea__=')) {
        const match = sourceUrl.match(/__hdnea__=([^&|]+)/);
        if (match) hdnea = match[1];
      }

      const baseUrl = 'https://servertvhub.site/jio/jwplayer.php';
      const encodedUrl = encodeURIComponent(sourceUrl);
      const tokenParam = hdnea ? encodeURIComponent(`__hdnea__=${hdnea}`) : '';
      const drmParam = encodeURIComponent(channel.licenseKey || '');
      
      let finalUrl = `${baseUrl}?url=${encodedUrl}`;
      if (tokenParam) finalUrl += `&token=${tokenParam}`;
      if (drmParam) finalUrl += `&drm=${drmParam}`;
      if (isTV) finalUrl += '&tv=1';
      
      return finalUrl;
    } catch (e) {
      console.error("Failed to construct external player URL", e);
      return `https://servertvhub.site/jio/jwplayer.php?url=${encodeURIComponent(channel.url)}&drm=${encodeURIComponent(channel.licenseKey || '')}${isTV ? '&tv=1' : ''}`;
    }
  }, [channel, isTV]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden pointer-events-auto">
      {playerUrl ? (
        <iframe
          src={playerUrl}
          className="w-full h-full border-0 absolute inset-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          title="Player"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
           <div className="text-center opacity-10">
              <svg className="w-48 h-48 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
              <p className="text-3xl font-bold uppercase tracking-[1em] ml-4">No Signal</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
