const express = require('express');
const { SHELVES } = require('../clients/googleBooks');
const { requireLogin } = require('../middleware/session');
const { httpError, volumeIdOr404 } = require('../lib/httpError');

const NOTICES = {
  added: 'Libro aggiunto allo scaffale.',
  removed: 'Libro rimosso dallo scaffale.',
  read: 'Libro spostato tra i letti.',
  plan: 'Promemoria di lettura creato nel tuo Google Calendar.',
};

const shelfUrl = (shelf, notice) => `/mybook?scaffale=${shelf}${notice ? `&ok=${notice}` : ''}`;

function shelfOr404(key) {
  if (!Object.hasOwn(SHELVES, key)) throw httpError(404, 'Scaffale non trovato');
  return SHELVES[key];
}

function libraryRouter({ books, account }) {
  const router = express.Router();

  router.get('/mybook', async (req, res) => {
    if (!req.google) return res.render('mybook', { title: 'La mia libreria' });

    const shelfKey = Object.hasOwn(SHELVES, req.query.scaffale) ? req.query.scaffale : 'da_leggere';
    const items = await books.listShelf(req.google, SHELVES[shelfKey].id);
    res.render('mybook', {
      title: 'La mia libreria',
      shelves: SHELVES,
      shelfKey,
      items,
      notice: NOTICES[req.query.ok],
    });
  });

  // Registered before "/mybook/:shelf" so these names are not taken for shelves.
  router.post('/mybook/mark-read', requireLogin, async (req, res) => {
    const id = volumeIdOr404(req.body.id);
    await books.addToShelf(req.google, SHELVES.letti.id, id);
    await books.removeFromShelf(req.google, SHELVES.da_leggere.id, id);
    res.redirect(shelfUrl('letti', 'read'));
  });

  router.post('/mybook/start-reading', requireLogin, async (req, res) => {
    const book = await books.getVolume(volumeIdOr404(req.body.id));
    if (!book) throw httpError(404, 'Libro non trovato');
    await account.createReadingPlan(req.google, book);
    res.redirect(shelfUrl('da_leggere', 'plan'));
  });

  router.post('/mybook/:shelf', requireLogin, async (req, res) => {
    const shelf = shelfOr404(req.params.shelf);
    await books.addToShelf(req.google, shelf.id, volumeIdOr404(req.body.id));
    res.redirect(shelfUrl(req.params.shelf, 'added'));
  });

  router.post('/mybook/:shelf/remove', requireLogin, async (req, res) => {
    const shelf = shelfOr404(req.params.shelf);
    await books.removeFromShelf(req.google, shelf.id, volumeIdOr404(req.body.id));
    res.redirect(shelfUrl(req.params.shelf, 'removed'));
  });

  return router;
}

module.exports = { libraryRouter };
