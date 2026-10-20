const express = require('express');
const { setTokenCookies, clearTokenCookies } = require('../middleware/session');

function authRouter({ account, users, mailQueue, config, log }) {
  const router = express.Router();
  const callbackPath = new URL(config.google.redirectUri).pathname;

  // Sends the welcome email (through RabbitMQ) only on a user's first login.
  async function welcomeIfNew(tokens) {
    const auth = account.clientFor({ accessToken: tokens.access_token });
    const email = await account.getEmail(auth);
    if (await users.registerIfNew(email)) await mailQueue.sendWelcome(email);
  }

  router.get('/login', (req, res) => {
    res.redirect(account.authUrl());
  });

  router.get(callbackPath, async (req, res) => {
    const { code } = req.query;
    if (typeof code !== 'string') return res.redirect('/mybook');

    const tokens = await account.exchangeCode(code);
    setTokenCookies(res, config, tokens);
    welcomeIfNew(tokens).catch((err) => log.error('welcome email failed:', err.message));
    res.redirect('/mybook');
  });

  router.get('/logout', (req, res) => {
    clearTokenCookies(res, config);
    res.redirect('/');
  });

  return router;
}

module.exports = { authRouter };
