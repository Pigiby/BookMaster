const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleBooks, toBook } = require('../src/clients/googleBooks');
const { createGoogleAccount } = require('../src/clients/googleAccount');

describe('googleBooks', () => {
  it('maps a volume and tolerates missing fields', () => {
    assert.deepEqual(toBook({ id: 'abc', volumeInfo: {} }), {
      id: 'abc', title: 'Senza titolo', authors: [], pageCount: null, thumbnail: null, infoLink: null,
    });
  });

  it('sends the API key and returns null for unknown volumes', async () => {
    const seen = [];
    const http = {
      async get(url, { params }) {
        seen.push([url, params]);
        throw Object.assign(new Error('not found'), { response: { status: 404 } });
      },
    };
    const books = createGoogleBooks({ apiKey: 'KEY', http });
    assert.equal(await books.getVolume('nope'), null);
    assert.deepEqual(seen, [['/volumes/nope', { key: 'KEY' }]]);
  });

  it('rethrows other upstream errors without retrying', async () => {
    let calls = 0;
    const http = { async get() { calls++; throw Object.assign(new Error('quota'), { response: { status: 429 } }); } };
    await assert.rejects(createGoogleBooks({ http }).getVolume('x'), /quota/);
    assert.equal(calls, 1);
  });

  it('retries transient 5xx answers', async () => {
    let calls = 0;
    const http = {
      async get() {
        if (++calls < 3) throw Object.assign(new Error('backendFailed'), { response: { status: 503 } });
        return { data: { items: [{ id: 'abc', volumeInfo: { title: 'Dune' } }] } };
      },
    };
    const results = await createGoogleBooks({ http, retryDelayMs: 1 }).search('dune');
    assert.equal(results[0].title, 'Dune');
    assert.equal(calls, 3);
  });
});

describe('googleAccount.createReadingPlan', () => {
  const account = createGoogleAccount({ timeZone: 'Europe/Rome', pagesPerDay: 15 });

  it('schedules one daily event per 15 pages, rounded up', async () => {
    let sent;
    const auth = { async request(opts) { sent = opts; } };
    const { days } = await account.createReadingPlan(auth, { title: 'Libro', pageCount: 31 }, new Date('2026-01-01T10:00:00Z'));
    assert.equal(days, 3);
    assert.equal(sent.method, 'POST');
    assert.deepEqual(sent.data.recurrence, ['RRULE:FREQ=DAILY;COUNT=3']);
    assert.equal(sent.data.end.dateTime, '2026-01-01T10:30:00.000Z');
  });

  it('falls back to a single day when the page count is unknown', async () => {
    const auth = { async request() {} };
    const { days } = await account.createReadingPlan(auth, { title: 'Libro', pageCount: null });
    assert.equal(days, 1);
  });
});
