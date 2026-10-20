const config = require('./config');
const { createApp } = require('./app');
const { createGoogleBooks } = require('./clients/googleBooks');
const { createGoogleAccount } = require('./clients/googleAccount');
const { createCouch } = require('./clients/couch');
const { createReviewRepository } = require('./repositories/reviews');
const { createUserRepository } = require('./repositories/users');
const { createMailQueue } = require('./messaging/mailQueue');

const log = console;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function initStorage(repositories, attempts = 30) {
  for (let attempt = 1; ; attempt++) {
    try {
      for (const repository of repositories) await repository.init();
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      log.warn(`CouchDB not ready (${err.message}), retrying in 2s...`);
      await sleep(2000);
    }
  }
}

async function main() {
  for (const key of ['clientId', 'clientSecret', 'apiKey']) {
    if (!config.google[key]) log.warn(`Missing Google setting "${key}": check your .env file.`);
  }

  const couch = createCouch(config.couch);
  const reviews = createReviewRepository(couch);
  const users = createUserRepository(couch);
  const mailQueue = createMailQueue({ url: config.rabbitmq.url, queue: config.rabbitmq.mailQueue });

  // A single-node CouchDB logs errors until its system databases exist.
  const systemDatabases = { init: () => Promise.all(['_users', '_replicator'].map(couch.ensureDatabase)) };
  await initStorage([systemDatabases, reviews, users]);

  const app = createApp({
    config,
    books: createGoogleBooks({ apiKey: config.google.apiKey }),
    account: createGoogleAccount({ ...config.google, timeZone: config.timeZone, pagesPerDay: config.pagesPerDay }),
    reviews,
    users,
    mailQueue,
    log,
  });

  const server = app.listen(config.port, () => {
    log.info(`BookMaster (${config.nodeName}) listening on port ${config.port}`);
  });

  const shutdown = () => {
    server.close(() => mailQueue.close().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log.error('Startup failed:', err);
  process.exit(1);
});
