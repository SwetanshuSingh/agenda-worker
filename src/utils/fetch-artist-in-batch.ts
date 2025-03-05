import { prisma } from "../lib/db";
import { fetchArtistInfo } from "./fetch-artist-info";
import { fetchAndSaveEventsInfo } from "./fetch-and-save-event-info";
import { logger } from "./winston-logger";

type ArtistData = {
  id: string;
  name: string;
  genres: string[];
};

const fetchArtistsInBatches = async (batchSize: number) => {
  try {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const artists = await prisma.artist.findMany({
        take: batchSize,
        skip: offset,
        orderBy: { name: "asc" }, // Ensure stable pagination
      });

      if (artists.length === 0) {
        hasMore = false;
        break;
      }

      const artistNames = artists.map((artist) => artist.name);
      let artistData: ArtistData[] = [];

      await fetchArtistInfo(artistNames, artistData);

      if (artistData.length > 0) {
        await fetchAndSaveEventsInfo(artistData);
        logger.info(`Events Saved for the artist | ${artistData.length}`);
      }

      offset += batchSize;
    }
  } catch (error) {
    logger.error("Error occurred while fetching Event Info");
  }
};

export default fetchArtistsInBatches;
