import { prisma } from "../lib/db";
import { getConcertCalendarId } from "../utils/fetch-concert-calendar-id";
import { getGoogleAccessToken } from "../utils/fetch-google-access-token";
import { google } from "googleapis";
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
    const token = await getGoogleAccessToken(id);

    console.log("Google Access Token", token);

    if (!token) return;

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
    )
      return;

    const zipcodesInUsersRange = zippy.getRadius(
      zipcode,
      process.env.NEXT_PUBIC_EVENT_RADIUS,
      "M"
    );

    console.log(zipcodesInUsersRange);

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

    console.log("Events for the artists", events);

    if (events.length == 0) return;

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

    if (!calendarId) return;

    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: calendarData[0],
    });

    console.log(response);
  } catch (error) {
    console.log(error);
  }
};
