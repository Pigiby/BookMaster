const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { BOOK, fakeDeps, LOGGED_IN, flush } = require('./helpers');

describe('pages', () => {
  it('renders the home page', async () => {
    const res = await request(fakeDeps().app).get('/').expect(200);
    assert.match(res.text, /Benvenuto su BookMaster/);
  });

  it('renders search results', async () => {
    const res = await request(fakeDeps().app).get('/search?q=come').expect(200);
    assert.match(res.text, /Come stai\?/);
  });

  it('answers 404 for unknown pages', async () => {
    await request(fakeDeps().app).get('/nope').expect(404);
  });
});

describe('login', () => {
  it('/login redirects to Google', async () => {
    const res = await request(fakeDeps().app).get('/login').expect(302);
    assert.match(res.headers.location, /accounts\.google\.com/);
  });

  it('the OAuth callback stores the tokens and sends one welcome email', async () => {
    const { app, calls } = fakeDeps();
    const res = await request(app).get('/steps?code=xyz').expect(302);
    const cookies = res.headers['set-cookie'].join(';');
    assert.match(cookies, /access_token=new-access/);
    assert.match(cookies, /HttpOnly/);

    await request(app).get('/steps?code=xyz').expect(302); // second login: no new email
    await flush();
    assert.deepEqual(calls.filter((c) => c[0] === 'sendWelcome'), [['sendWelcome', 'reader@example.com']]);
  });

  it('/logout clears the cookies', async () => {
    const res = await request(fakeDeps().app).get('/logout').set('Cookie', LOGGED_IN).expect(302);
    assert.match(res.headers['set-cookie'].join(';'), /access_token=;/);
  });
});

describe('library', () => {
  it('shows the login button when logged out', async () => {
    const res = await request(fakeDeps().app).get('/mybook').expect(200);
    assert.match(res.text, /login-with-google-btn/);
  });

  it('lists the selected shelf when logged in', async () => {
    const res = await request(fakeDeps().app).get('/mybook?scaffale=preferiti').set('Cookie', LOGGED_IN).expect(200);
    assert.match(res.text, /Come stai\?/);
  });

  it('adds a book to a shelf', async () => {
    const { app, calls } = fakeDeps();
    const res = await request(app).post('/mybook/preferiti').set('Cookie', LOGGED_IN).type('form').send({ id: BOOK.id }).expect(302);
    assert.equal(res.headers.location, '/mybook?scaffale=preferiti&ok=added');
    assert.deepEqual(calls, [['addToShelf', 0, BOOK.id]]);
  });

  it('marking as read moves the book from "da leggere" to "letti"', async () => {
    const { app, calls } = fakeDeps();
    await request(app).post('/mybook/mark-read').set('Cookie', LOGGED_IN).type('form').send({ id: BOOK.id }).expect(302);
    assert.deepEqual(calls, [['addToShelf', 4, BOOK.id], ['removeFromShelf', 2, BOOK.id]]);
  });

  it('creates a reading plan', async () => {
    const { app, calls } = fakeDeps();
    await request(app).post('/mybook/start-reading').set('Cookie', LOGGED_IN).type('form').send({ id: BOOK.id }).expect(302);
    assert.deepEqual(calls, [['createReadingPlan', BOOK.id]]);
  });

  it('rejects unknown shelves and malformed ids', async () => {
    const { app } = fakeDeps();
    await request(app).post('/mybook/cantina').set('Cookie', LOGGED_IN).type('form').send({ id: BOOK.id }).expect(404);
    await request(app).post('/mybook/preferiti').set('Cookie', LOGGED_IN).type('form').send({ id: '../x' }).expect(404);
  });

  it('redirects to login when logged out', async () => {
    const res = await request(fakeDeps().app).post('/mybook/preferiti').type('form').send({ id: BOOK.id }).expect(302);
    assert.equal(res.headers.location, '/mybook');
  });

  it('logs the user out when Google rejects the token', async () => {
    const err = Object.assign(new Error('unauthorized'), { response: { status: 401 } });
    const books = { async listShelf() { throw err; } };
    const res = await request(fakeDeps({ books }).app).get('/mybook').set('Cookie', LOGGED_IN).expect(302);
    assert.match(res.headers['set-cookie'].join(';'), /access_token=;/);
  });
});

describe('reviews', () => {
  it('saves a review and lists it', async () => {
    const { app, store } = fakeDeps();
    await request(app)
      .post(`/books/${BOOK.id}/reviews`).set('Cookie', LOGGED_IN).type('form')
      .send({ stars: '5', text: '  Bellissimo  ' })
      .expect(302)
      .expect('Location', `/books/${BOOK.id}/reviews`);
    assert.deepEqual(store, [{ bookId: BOOK.id, email: 'reader@example.com', stars: 5, text: 'Bellissimo' }]);

    const res = await request(app).get(`/books/${BOOK.id}/reviews`).expect(200);
    assert.match(res.text, /Bellissimo/);
  });

  it('rejects invalid reviews', async () => {
    const { app, store } = fakeDeps();
    const res = await request(app)
      .post(`/books/${BOOK.id}/reviews`).set('Cookie', LOGGED_IN).type('form')
      .send({ stars: '9', text: '' })
      .expect(400);
    assert.match(res.text, /Scegli da 1 a 5 stelle/);
    assert.equal(store.length, 0);
  });

  it('escapes review text (no stored XSS)', async () => {
    const { app, deps } = fakeDeps();
    await deps.reviews.add({ bookId: BOOK.id, email: 'x@y.z', stars: 3, text: '<script>alert(1)</script>' });
    const res = await request(app).get(`/books/${BOOK.id}/reviews`).expect(200);
    assert.doesNotMatch(res.text, /<script>alert/);
    assert.match(res.text, /&lt;script&gt;/);
  });

  it('answers 404 for an unknown book', async () => {
    await request(fakeDeps().app).get('/books/sconosciuto/reviews').expect(404);
  });
});
