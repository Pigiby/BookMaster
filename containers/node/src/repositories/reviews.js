const DB = 'reviews';

const DESIGN_DOC = {
  _id: '_design/reviews',
  views: {
    by_book: {
      map: 'function (doc) { if (doc.type === "review") emit([doc.bookId, doc.createdAt], null); }',
    },
  },
};

const toReview = (doc) => ({
  email: doc.email,
  stars: doc.stars,
  text: doc.text,
  createdAt: doc.createdAt,
});

function createReviewRepository(couch) {
  return {
    async init() {
      await couch.ensureDatabase(DB);
      await couch.ensureDocument(DB, DESIGN_DOC);
    },

    async add({ bookId, email, stars, text }) {
      await couch.http.post(`/${DB}`, {
        type: 'review',
        bookId,
        email,
        stars,
        text,
        createdAt: new Date().toISOString(),
      });
    },

    async listForBook(bookId) {
      const { data } = await couch.http.get(`/${DB}/_design/reviews/_view/by_book`, {
        params: {
          startkey: JSON.stringify([bookId]),
          endkey: JSON.stringify([bookId, {}]),
          include_docs: true,
        },
      });
      return data.rows.map((row) => toReview(row.doc));
    },
  };
}

module.exports = { createReviewRepository };
