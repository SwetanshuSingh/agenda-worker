export type EventData = {
  title: string;
  url: string;
  venue: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;
  dateTime: Date;
};

export type SpotifyArtistData = {
  external_urls: {
    spotify: string;
  };
  href: string;
  id: string;
  name: string;
  type: string;
  uri: string;
  genres: string[];
};

export type FinalArtistData = {
  userIDs: string[];
  artistId: string;
  name: string;
  image: string;
  genres: string[];
};
