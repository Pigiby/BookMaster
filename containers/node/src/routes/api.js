const express = require('express');
const { isVolumeId } = require('../lib/httpError');

function apiRouter({ books, reviews, config, log }) {
  const router = express.Router();

  async function sendReviews(res, book) {
    let list;
    try {
      list = await reviews.listForBook(book.id);
    } catch (err) {
      log.error('reviews database unavailable:', err.message);
      return res.status(503).json({ error: 'database_unavailable', id: book.id, title: book.title });
    }
    res.json({
      id: book.id,
      title: book.title,
      picture: book.thumbnail,
      number_of_reviews: list.length,
      reviews: list,
    });
  }

  router.get('/status', (req, res) => {
    res.json({ status: 'online', node: config.nodeName });
  });

  // Both /api/getreview/byid/<id> and /api/getreview/byid?id=<id> are accepted.
  router.get('/api/getreview/byid{/:id}', async (req, res) => {
    const id = req.params.id || req.query.id;
    if (!id) return res.status(400).json({ error: 'attribute id not declared' });

    const book = isVolumeId(id) ? await books.getVolume(id) : null;
    if (!book) return res.status(404).json({ error: 'No book for this id in google books' });
    await sendReviews(res, book);
  });

  router.get('/api/getreview/bytitle{/:title}', async (req, res) => {
    const title = req.params.title || req.query.title;
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'attribute title not declared' });

    const [book] = await books.search(title, 1);
    if (!book) return res.status(404).json({ error: 'No books with this title' });
    await sendReviews(res, book);
  });

  return router;
}

module.exports = { apiRouter };
