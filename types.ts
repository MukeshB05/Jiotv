
export interface Channel {
  id: string;
  name: string;
  group: string;
  logo: string;
  url: string;
  licenseKey?: string;
  licenseType?: string;
  userAgent?: string;
  cookie?: string;
  isFavorite?: boolean;
}

export interface GroupedChannels {
  [key: string]: Channel[];
}
