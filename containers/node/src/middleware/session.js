// The Google tokens live in httpOnly cookies, so any web replica behind the
// load balancer can serve any request without a shared session store.
const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const cookieOptions = (config) => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax',
  maxAge: THIRTY_DAYS,
});

function setTokenCookies(res, config, tokens) {
  if (tokens.access_token) res.cookie(ACCESS_COOKIE, tokens.access_token, cookieOptions(config));
  if (tokens.refresh_token) res.cookie(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(config));
}

function clearTokenCookies(res, config) {
  const { maxAge, ...options } = cookieOptions(config);
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
}

// Attaches an authenticated Google client as `req.google` when the user is logged in.
function googleSession({ account, config }) {
  return (req, res, next) => {
    const accessToken = req.cookies[ACCESS_COOKIE];
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (accessToken || refreshToken) {
      req.google = account.clientFor({ accessToken, refreshToken });
      // Persist a refreshed access token so the next request does not refresh again.
      req.google.on('tokens', (tokens) => {
        if (!res.headersSent) setTokenCookies(res, config, { access_token: tokens.access_token });
      });
    }
    res.locals.loggedIn = Boolean(req.google);
    next();
  };
}

function requireLogin(req, res, next) {
  if (req.google) return next();
  res.redirect('/mybook');
}

module.exports = { googleSession, requireLogin, setTokenCookies, clearTokenCookies };
