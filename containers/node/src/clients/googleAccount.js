const { OAuth2Client } = require('google-auth-library');

const SCOPES = [
  'https://www.googleapis.com/auth/books',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.events',
];
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function createGoogleAccount({ clientId, clientSecret, redirectUri, timeZone, pagesPerDay }) {
  const newClient = () => new OAuth2Client({ clientId, clientSecret, redirectUri });

  return {
    authUrl() {
      // prompt=consent guarantees a refresh token, needed once the 1h access token expires.
      return newClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
    },

    async exchangeCode(code) {
      const { tokens } = await newClient().getToken(code);
      return tokens;
    },

    clientFor({ accessToken, refreshToken }) {
      const client = newClient();
      client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
      return client;
    },

    async getEmail(auth) {
      const { data } = await auth.request({ url: USERINFO_URL });
      return data.email;
    },

    // Daily 30-minute calendar reminder until the book is finished at `pagesPerDay` pages a day.
    async createReadingPlan(auth, book, start = new Date()) {
      const days = Math.max(1, Math.ceil((book.pageCount || pagesPerDay) / pagesPerDay));
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const event = {
        summary: book.title,
        description: `Prenditi una piccola pausa e leggi ${pagesPerDay} pagine di questo libro`,
        colorId: '4',
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
        recurrence: [`RRULE:FREQ=DAILY;COUNT=${days}`],
      };
      await auth.request({ url: EVENTS_URL, method: 'POST', data: event });
      return { days };
    },
  };
}

module.exports = { createGoogleAccount, SCOPES };
