import { getConcertCalendarId } from "../utils/fetch-concert-calendar-id";
import { getGoogleAccessToken } from "../utils/fetch-google-access-token";
import { google } from "googleapis";
import { logger } from "../utils/winston-logger";
import { prisma } from "../lib/db";
// @ts-ignore
import zippy from "zipcode-city-distance";

export const createEvent = async ({
  id,
  email,
  zipcode,
}: {
  id: string;
  email: string | null;
  zipcode: string | null;
}) => {
  try {
    logger.info(`Processing events for user | UserID: ${id} | Email: ${email} | Zipcode: ${zipcode}`);
    
    const token = await getGoogleAccessToken(id);

    if (!token) {
      logger.warn(`Failed to get Google access token for user | UserID: ${id}`);
      return;
    }
    
    logger.info(`Successfully obtained Google access token for user | UserID: ${id}`);

    const config = new google.auth.OAuth2();
    config.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: "v3", auth: config });

    const userArtists = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        followingArtists: true,
      },
    });

    if (
      !userArtists?.followingArtists ||
      userArtists.followingArtists.length == 0
    ) {
      logger.warn(`No following artists found for user | UserID: ${id} | Email: ${email}`);
      return;
    }

    logger.info(`Found ${userArtists.followingArtists.length} followed artists for user | UserID: ${id}`);
    const artistIds = userArtists.followingArtists.map(data => data.artistId);
    logger.info(`Artist IDs followed by user: ${artistIds.join(', ')} | UserID: ${id}`);

    const zipcodesInUsersRange = zippy.getRadius(
      zipcode,
      process.env.NEXT_PUBIC_EVENT_RADIUS,
      "M"
    );

    logger.info(`Found ${zipcodesInUsersRange.length} zipcodes in range for user | UserID: ${id} | Zipcode: ${zipcode}`);

    const events = await prisma.event.findMany({
      where: {
        artistId: {
          in: userArtists.followingArtists.map((data) => data.artistId),
        },
        zipcode: {
          in: [
            ...zipcodesInUsersRange.map((data: any) => data.zipcode),
            zipcode,
          ],
        },
      },
      take: 2,
    });

    if (events.length == 0) {
      logger.warn(`No events found for user's followed artists | UserID: ${id}`);
      return;
    }

    logger.info(`Found ${events.length} events for user | UserID: ${id}`);
    
    // Log event details
    events.forEach((event, index) => {
      logger.info(`Event ${index+1} details | Title: ${event.title} | ArtistID: ${event.artistId} | UserID: ${id} | Venue: ${event.venue}`);
    });

    const calendarData = events.map((event) => {
      return {
        summary: event.title,
        location: `${event.venue}, ${event.state}, ${event.country}`,
        description: `
          Event Link - ${event.url}
          `,
        start: {
          dateTime: event.dateTime.toISOString(),
          timeZone: "America/New_York",
        },
        end: {
          dateTime: event.dateTime.toISOString(),
          timeZone: "America/New_York",
        },
      };
    });

    const calendarId = await getConcertCalendarId(calendar);

    if (!calendarId) {
      logger.warn(`Failed to get calendar ID for user | UserID: ${id}`);
      return;
    }

    logger.info(`Adding ${calendarData.length} events to calendar for user | UserID: ${id} | CalendarID: ${calendarId}`);
    
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: calendarData[0],
    });

    logger.info(`Successfully added event to calendar | UserID: ${id} | EventTitle: ${calendarData[0].summary} | Status: ${response.status}`);
  } catch (error) {
    logger.error(`Error creating events for user | UserID: ${id} | Error: ${error}`);
  }
};
