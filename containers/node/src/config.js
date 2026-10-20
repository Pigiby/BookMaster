// All runtime configuration comes from environment variables (see .env.example).
const env = process.env;

const amqpUrl = (user = 'guest', password = 'guest', host = 'rabbitmq:5672') =>
  `amqp://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}`;

const publicUrl =(env.PUBLIC_URL || 'https://localhost').replace(/\/$/, '');

module.exports = {
  port: Number(env.PORT) || 3000,
  nodeName: env.NODE_NAME || require('os').hostname(),
  publicUrl,
  cookieSecure: publicUrl.startsWith('https://'),
  timeZone: env.TIME_ZONE || 'Europe/Rome',
  pagesPerDay: Number(env.PAGES_PER_DAY) || 15,

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    apiKey: env.GOOGLE_API_KEY,
    // Must match an "Authorized redirect URI" of the OAuth client in Google Cloud Console.
    redirectUri: env.GOOGLE_REDIRECT_URI || `${publicUrl}/steps`,
  },

  couch: {
    url: env.COUCHDB_URL || 'http://couchdb:5984',
    user: env.COUCHDB_USER || 'admin',
    password: env.COUCHDB_PASSWORD || 'admin',
  },

  rabbitmq: {
    url: env.RABBITMQ_URL || amqpUrl(env.RABBITMQ_USER, env.RABBITMQ_PASSWORD, env.RABBITMQ_HOST),
    mailQueue: env.MAIL_QUEUE || 'mail',
  },
};
