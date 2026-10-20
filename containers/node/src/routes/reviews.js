const express = require('express');
const { requireLogin } = require('../middleware/session');
const { httpError, volumeIdOr404 } = require('../lib/httpError');

const MAX_TEXT = 2000;

function validateReview(body) {
  const stars = Number(body.stars);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const errors = [];
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) errors.push('Scegli da 1 a 5 stelle.');
  if (!text) errors.push('Scrivi un commento.');
  if (text.length > MAX_TEXT) errors.push(`Il commento può avere al massimo ${MAX_TEXT} caratteri.`);
  return { stars, text, errors };
}

function reviewsRouter({ books, reviews, account }) {
  const router = express.Router();

  async function findBook(id) {
    const book = await books.getVolume(volumeIdOr404(id));
    if (!book) throw httpError(404, 'Libro non trovato');
    return book;
  }

  router.get('/books/:id/reviews', async (req, res) => {
    const book = await findBook(req.params.id);
    const list = await reviews.listForBook(book.id);
    res.render('reviews', { title: `Recensioni · ${book.title}`, book, reviews: list });
  });

  router.get('/books/:id/reviews/new', requireLogin, async (req, res) => {
    const book = await findBook(req.params.id);
    res.render('review_form', { title: 'Lascia una recensione', book, errors: [], form: {} });
  });

  router.post('/books/:id/reviews', requireLogin, async (req, res) => {
    const book = await findBook(req.params.id);
    const { stars, text, errors } = validateReview(req.body);
    if (errors.length) {
      return res.status(400).render('review_form', { title: 'Lascia una recensione', book, errors, form: req.body });
    }
    const email = await account.getEmail(req.google);
    await reviews.add({ bookId: book.id, email, stars, text });
    res.redirect(`/books/${book.id}/reviews`);
  });

  return router;
}

module.exports = { reviewsRouter, validateReview };
