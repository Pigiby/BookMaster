const axios = require('axios');

const BASE_URL = 'https://www.googleapis.com/books/v1';

// Google Books "My Library" bookshelf ids, keyed by the name used in our URLs.
const SHELVES = {
  da_leggere: { id: 2, label: 'Da leggere' },
  preferiti: { id: 0, label: 'Preferiti' },
  letti: { id: 4, label: 'Letti' },
};

function toBook(volume) {
  const info = volume.volumeInfo || {};
  return {
    id: volume.id,
    title: info.title || 'Senza titolo',
    authors: info.authors || [],
    pageCount: info.pageCount || null,
    thumbnail: (info.imageLinks && info.imageLinks.smallThumbnail) || null,
    infoLink: info.infoLink || null,
  };
}

function isNotFound(err) {
  const status = err.response && err.response.status;
  return status === 400 || status === 404;
}

const isTransient = (err) => !err.response || err.response.status >= 500;

function createGoogleBooks({ apiKey, http = axios.create({ baseURL: BASE_URL, timeout: 10000 }), retryDelayMs = 300 }) {
  const withKey = (params = {}) => (apiKey ? { ...params, key: apiKey } : params);

  // The public Books API intermittently answers 503 "backendFailed"; a quick retry usually succeeds.
  async function get(url, params, attempts = 4) {
    for (let attempt = 1; ; attempt++) {
      try {
        return (await http.get(url, { params })).data;
      } catch (err) {
        if (attempt >= attempts || !isTransient(err)) throw err;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  return {
    // Public catalogue (API key only).
    async search(query, maxResults = 20) {
      const data = await get('/volumes', withKey({ q: query, maxResults }));
      return (data.items || []).map(toBook);
    },

    async getVolume(volumeId) {
      try {
        const data = await get(`/volumes/${encodeURIComponent(volumeId)}`, withKey());
        return toBook(data);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },

    // User library (needs an authenticated google-auth-library OAuth2Client).
    async listShelf(auth, shelfId) {
      const { data } = await auth.request({
        url: `${BASE_URL}/mylibrary/bookshelves/${shelfId}/volumes`,
        params: withKey({ maxResults: 40 }),
      });
      return (data.items || []).map(toBook);
    },

    async addToShelf(auth, shelfId, volumeId) {
      await auth.request({
        url: `${BASE_URL}/mylibrary/bookshelves/${shelfId}/addVolume`,
        method: 'POST',
        params: withKey({ volumeId }),
      });
    },

    async removeFromShelf(auth, shelfId, volumeId) {
      await auth.request({
        url: `${BASE_URL}/mylibrary/bookshelves/${shelfId}/removeVolume`,
        method: 'POST',
        params: withKey({ volumeId }),
      });
    },
  };
}

module.exports = { createGoogleBooks, SHELVES, toBook };
