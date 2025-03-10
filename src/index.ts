import Agenda, { Job } from "agenda";
import { prisma } from "./lib/db";
import {
  getArtistImages,
  getFollowedArtists,
  getSavedTracks,
} from "./actions/spotify";
import addArtistsForUser from "./utils/add-artists-for-user";
import fetchArtistsInBatches from "./utils/fetch-artist-in-batch";
import fetchUsersInBatches from "./utils/fetch-user-in-batch";
import { logger } from "./utils/winston-logger";
import type { FinalArtistData, SpotifyArtistData } from "./types";

type ArtistData = {
  id: string;
  name: string;
  genres: string[];
};

type GetArtistData = {
  userId: string;
  token: string;
};

const agenda = new Agenda({
  db: {
    address: process.env.DATABASE_URL as string,
  },
});

agenda.define("get-artist-data", async (job: Job<GetArtistData>) => {
  try {
    const { userId, token } = job.attrs.data;

    logger.info(`Fetching Artist Data for the User Id - ${userId}`);

    let rawArtistsData: SpotifyArtistData[] = [];

    const savedTracksRes = await getSavedTracks(token);
    const followedTracksRes = await getFollowedArtists(token);

    if (savedTracksRes.data) rawArtistsData = [...savedTracksRes.data];
    if (followedTracksRes.data) rawArtistsData = [...followedTracksRes.data];

    if (rawArtistsData.length == 0) {
      logger.warn(`No Artist Data found |  User Id - ${userId}`);
      return;
    }

    const uniqueArtists = rawArtistsData.reduce<ArtistData[]>((acc, artist) => {
      if (!acc.some((a) => a.id === artist.id)) {
        acc.push(artist);
      }
      return acc;
    }, []);

    const artistData = uniqueArtists.map((artist) => {
      return { id: artist.id, name: artist.name, genres: artist.genres };
    });

    if (artistData.length == 0) {
      logger.warn(`No Artist Data found |  User Id - ${userId}`);
      return;
    }

    const artistIds = artistData.map((data) => data.id);

    const existingArtistIds = await prisma.artist.findMany({
      where: {
        artistId: {
          in: artistIds,
        },
      },
      select: {
        artistId: true,
      },
    });

    const existingIds = new Set(
      existingArtistIds.map((artist) => artist.artistId)
    );

    const missingArtists = artistData.filter(
      (data) => !existingIds.has(data.id)
    );

    if (missingArtists.length == 0) {
      logger.warn(`No new artist found | User Id - ${userId}`);
      return;
    }

    let finalData: FinalArtistData[] = [];

    await getArtistImages(token, userId, missingArtists, finalData);

    logger.info(
      `Final Data for the Artist | User Id - ${userId} | Data Length - ${finalData.length}`
    );

    await addArtistsForUser(userId, finalData);

    logger.info(`Saved Artist Data for the User | User Id = ${userId}`);
  } catch (error) {
    console.log(error);
  }
});

agenda.define("get-artist-events", async (job: Job) => {
  try {
    logger.info("Job Scheduled | Fetching events for the artists");
    await fetchArtistsInBatches(20);
    logger.info("Job Completed | Successfully added events");
  } catch (error) {
    logger.error("Error occurred while fetching artist events");
  }
});

agenda.define("set-events-in-calendar", async (job: Job) => {
  try {
    logger.info("Job Scheduled | Adding events data to the calendar");
    await fetchUsersInBatches(5);
  } catch (error) {
    console.log("Error while creating events", error);
  }
});

(async function () {
  await agenda.start();
  logger.info("Service Worker Started!");
  // await agenda.now("get-artist-events", {});
  // await agenda.now("set-events-in-calendar", {});
  await agenda.every("0 9 * * 1", "get-artist-events"); // Runs every Monday at 9 AM UTC
  await agenda.every("0 9 * * 1", "set-events-in-calendar"); // Runs every Monday at 9 AM UTC
})();
