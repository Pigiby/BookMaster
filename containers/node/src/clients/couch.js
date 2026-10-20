const axios = require('axios');

const statusOf = (err) => err.response && err.response.status;

function createCouch({ url, user, password }) {
  const http = axios.create({ baseURL: url, auth: { username: user, password }, timeout: 5000 });

  return {
    http,
    statusOf,

    // Idempotent: several web replicas may run this at the same time.
    async ensureDatabase(name) {
      try {
        await http.put(`/${name}`);
      } catch (err) {
        if (statusOf(err) !== 412) throw err; // 412 = already exists
      }
    },

    async ensureDocument(db, doc) {
      try {
        await http.put(`/${db}/${doc._id}`, doc);
      } catch (err) {
        if (statusOf(err) !== 409) throw err; // 409 = already exists
      }
    },
  };
}

module.exports = { createCouch };
