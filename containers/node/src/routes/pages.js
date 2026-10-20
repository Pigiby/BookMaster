const express = require('express');
const { SHELVES } = require('../clients/googleBooks');

function pagesRouter({ books }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
  });

  router.get('/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const results = q ? await books.search(q) : null;
    res.render('search', { title: 'Cerca', q, results, shelves: SHELVES });
  });

  return router;
}

module.exports = { pagesRouter };
