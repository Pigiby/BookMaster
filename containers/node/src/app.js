const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { googleSession, clearTokenCookies } = require('./middleware/session');
const { httpError } = require('./lib/httpError');
const { pagesRouter } = require('./routes/pages');
const { authRouter } = require('./routes/auth');
const { libraryRouter } = require('./routes/library');
const { reviewsRouter } = require('./routes/reviews');
const { apiRouter } = require('./routes/api');

// Builds the Express app from its dependencies, so tests can pass in fakes.
function createApp({ config, books, account, reviews, users, mailQueue, log = console, logRequests = true }) {
  const deps = { config, books, account, reviews, users, mailQueue, log };
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true); // TLS terminates at nginx
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('view engine', 'pug');

  if (logRequests) app.use(morgan('dev'));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(googleSession(deps));
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  app.use(apiRouter(deps));
  app.use(pagesRouter(deps));
  app.use(authRouter(deps));
  app.use(libraryRouter(deps));
  app.use(reviewsRouter(deps));

  app.use((req, res, next) => next(httpError(404, 'Pagina non trovata')));

  // Express recognises error handlers by their four arguments.
  app.use((err, req, res, next) => {
    const upstream = err.response || {};
    const googleAuthFailed = upstream.status === 401 || (upstream.data && upstream.data.error === 'invalid_grant');

    if (googleAuthFailed && req.google) {
      clearTokenCookies(res, config); // expired or revoked: ask the user to log in again
      return res.redirect('/mybook');
    }

    // Our own errors carry `expose`; anything with `response` failed at a Google API.
    const status = err.expose ? err.status : err.response ? 502 : 500;
    if (status >= 500) log.error(err.response ? `Google API error ${upstream.status}: ${err.message}` : err);
    const message = err.expose ? err.message
      : status === 502 ? 'I servizi Google non rispondono, riprova tra poco.'
      : 'Qualcosa è andato storto, riprova più tardi.';

    if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
    res.status(status).render('error', { title: 'Errore', status, message });
  });

  return app;
}

module.exports = { createApp };
