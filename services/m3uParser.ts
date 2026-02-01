
import { Channel } from '../types';

export const parseM3U = (content: string): Channel[] => {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      // Parse basic info
      const nameMatch = line.match(/,(.*)$/);
      const idMatch = line.match(/tvg-id="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);

      currentChannel.name = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';
      currentChannel.id = idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 9);
      currentChannel.group = groupMatch ? groupMatch[1] : 'Uncategorized';
      currentChannel.logo = logoMatch ? logoMatch[1] : 'https://picsum.photos/200/200';
    } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_type=')) {
      currentChannel.licenseType = line.split('=')[1];
    } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
      currentChannel.licenseKey = line.split('=')[1];
    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
      currentChannel.userAgent = line.split('=')[1];
    } else if (line.startsWith('#EXTHTTP:')) {
      try {
        const json = JSON.parse(line.replace('#EXTHTTP:', ''));
        currentChannel.cookie = json.cookie;
      } catch (e) {
        console.error("Failed to parse EXTHTTP", e);
      }
    } else if (line.startsWith('http')) {
      currentChannel.url = line;
      if (currentChannel.name) {
        channels.push(currentChannel as Channel);
      }
      currentChannel = {};
    }
  }

  return channels;
};
