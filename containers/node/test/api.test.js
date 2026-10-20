const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { BOOK, fakeDeps } = require('./helpers');

describe('REST API', () => {
  it('GET /status reports the service as online', async () => {
    const res = await request(fakeDeps().app).get('/status').expect(200);
    assert.deepEqual(res.body, { status: 'online', node: 'test-node' });
  });

  it('byid without an id answers 400', async () => {
    const res = await request(fakeDeps().app).get('/api/getreview/byid').expect(400);
    assert.equal(res.body.error, 'attribute id not declared');
  });

  it('byid with an unknown id answers 404', async () => {
    const res = await request(fakeDeps().app).get('/api/getreview/byid/mariorossi').expect(404);
    assert.equal(res.body.error, 'No book for this id in google books');
  });

  it('byid returns the reviews of the book (path or query parameter)', async () => {
    const { app, deps } = fakeDeps();
    await deps.reviews.add({ bookId: BOOK.id, email: 'a@b.c', stars: 4, text: 'Bello' });

    for (const url of [`/api/getreview/byid/${BOOK.id}`, `/api/getreview/byid?id=${BOOK.id}`]) {
      const res = await request(app).get(url).expect(200);
      assert.equal(res.body.title, BOOK.title);
      assert.equal(res.body.picture, BOOK.thumbnail);
      assert.equal(res.body.number_of_reviews, 1);
      assert.equal(res.body.reviews[0].text, 'Bello');
    }
  });

  it('bytitle without a title answers 400', async () => {
    const res = await request(fakeDeps().app).get('/api/getreview/bytitle').expect(400);
    assert.equal(res.body.error, 'attribute title not declared');
  });

  it('bytitle finds the first matching book', async () => {
    const res = await request(fakeDeps().app).get('/api/getreview/bytitle?title=come+stai').expect(200);
    assert.equal(res.body.id, BOOK.id);
    assert.equal(res.body.number_of_reviews, 0);
    assert.deepEqual(res.body.reviews, []);
  });

  it('bytitle with no match answers 404', async () => {
    const res = await request(fakeDeps().app).get('/api/getreview/bytitle/nessunrisultato').expect(404);
    assert.equal(res.body.error, 'No books with this title');
  });

  it('answers 503 when the reviews database is down', async () => {
    const reviews = { async listForBook() { throw new Error('ECONNREFUSED'); } };
    const res = await request(fakeDeps({ reviews }).app).get(`/api/getreview/byid/${BOOK.id}`).expect(503);
    assert.equal(res.body.error, 'database_unavailable');
  });

  it('answers 502 JSON when Google Books fails', async () => {
    const err = Object.assign(new Error('quota'), { response: { status: 429 } });
    const books = { async search() { throw err; } };
    const res = await request(fakeDeps({ books }).app).get('/api/getreview/bytitle/x').expect(502);
    assert.ok(res.body.error);
  });
});
