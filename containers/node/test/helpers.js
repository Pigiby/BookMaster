const { EventEmitter } = require('events');
const { createApp } = require('../src/app');

const BOOK = {
  id: 't_i_yQEACAAJ',
  title: 'Come stai?',
  authors: ['Autore'],
  pageCount: 40,
  thumbnail: 'http://books.google.com/cover.jpg',
  infoLink: 'http://books.google.com/info',
};

const config = {
  nodeName: 'test-node',
  cookieSecure: false,
  google: { redirectUri: 'https://localhost/steps' },
};

// In-memory stand-ins for every external service, recording the calls they receive.
function fakeDeps(overrides = {}) {
  const calls = [];
  const record = (name) => (...args) => { calls.push([name, ...args.slice(1)]); };
  const store = [];

  const books = {
    async search(q) { return q.includes('nessunrisultato') ? [] : [BOOK]; },
    async getVolume(id) { return id === BOOK.id ? BOOK : null; },
    async listShelf() { return [BOOK]; },
    addToShelf: record('addToShelf'),
    removeFromShelf: record('removeFromShelf'),
  };

  const account = {
    authUrl: () => 'https://accounts.google.com/o/oauth2/auth?fake',
    async exchangeCode() { return { access_token: 'new-access', refresh_token: 'new-refresh' }; },
    clientFor: (tokens) => Object.assign(new EventEmitter(), { tokens }),
    async getEmail() { return 'reader@example.com'; },
    async createReadingPlan(auth, book) { calls.push(['createReadingPlan', book.id]); return { days: 3 }; },
  };

  const reviews = {
    async init() {},
    async add(review) { store.push(review); },
    async listForBook(bookId) { return store.filter((r) => r.bookId === bookId); },
  };

  const seen = new Set();
  const users = {
    async init() {},
    async registerIfNew(email) { if (seen.has(email)) return false; seen.add(email); return true; },
  };

  const mailQueue = { async sendWelcome(email) { calls.push(['sendWelcome', email]); } };
  const log = { info() {}, warn() {}, error() {} };

  const deps = { config, books, account, reviews, users, mailQueue, log, ...overrides };
  return { deps, calls, store, app: createApp({ ...deps, logRequests: false }) };
}

const LOGGED_IN = 'access_token=abc; refresh_token=def';

// Lets a test wait for fire-and-forget work (e.g. the welcome email) to settle.
const flush = () => new Promise((resolve) => setImmediate(resolve));

module.exports = { BOOK, fakeDeps, LOGGED_IN, flush };
