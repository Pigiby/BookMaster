const DB = 'users';

function createUserRepository(couch) {
  return {
    async init() {
      await couch.ensureDatabase(DB);
    },

    // Returns true only the first time an email is seen. The document id is the email,
    // so CouchDB itself rejects duplicates even when several replicas race.
    async registerIfNew(email) {
      try {
        await couch.http.put(`/${DB}/${encodeURIComponent(email)}`, {
          email,
          createdAt: new Date().toISOString(),
        });
        return true;
      } catch (err) {
        if (couch.statusOf(err) === 409) return false;
        throw err;
      }
    },
  };
}

module.exports = { createUserRepository };
