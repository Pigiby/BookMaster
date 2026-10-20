/**
 * @api {get} /status Stato del servizio
 * @apiName Status
 * @apiGroup Servizio
 * @apiDescription Utile come health check: risponde la replica che ha servito la richiesta.
 *
 * @apiSuccess {String} status Sempre <code>online</code>
 * @apiSuccess {String} node   Nome della replica web che ha risposto
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     { "status": "online", "node": "3967894e01d3" }
 */

/**
 * @apiDefine ReviewsSuccess
 * @apiSuccess {String} id                 Id del libro su Google Books
 * @apiSuccess {String} title              Titolo del libro
 * @apiSuccess {String} picture            Copertina del libro (può essere <code>null</code>)
 * @apiSuccess {Number} number_of_reviews  Numero di recensioni
 * @apiSuccess {Object[]} reviews          Recensioni, dalla più vecchia
 * @apiSuccess {String} reviews.email      Email di chi ha scritto la recensione
 * @apiSuccess {Number} reviews.stars      Stelle, da 1 a 5
 * @apiSuccess {String} reviews.text       Testo della recensione
 * @apiSuccess {String} reviews.createdAt  Data in formato ISO 8601
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "id": "t_i_yQEACAAJ",
 *       "title": "Come stai?",
 *       "picture": "http://books.google.com/books/content?id=t_i_yQEACAAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api",
 *       "number_of_reviews": 1,
 *       "reviews": [
 *         {
 *           "email": "example@gmail.com",
 *           "stars": 5,
 *           "text": "Questo libro mi piace particolarmente",
 *           "createdAt": "2026-10-20T14:27:43.719Z"
 *         }
 *       ]
 *     }
 *
 * @apiError (503) database_unavailable Il database delle recensioni non è raggiungibile
 * @apiError (502) upstream_error       Google Books non ha risposto
 */

/**
 * @api {get} /api/getreview/bytitle/:title Recensioni di un libro cercato per titolo
 * @apiName GetReviewByTitle
 * @apiGroup Recensioni
 * @apiDescription Cerca il titolo su Google Books e restituisce le recensioni del primo risultato.
 * Il titolo si può passare anche come query string: <code>/api/getreview/bytitle?title=harry+potter</code>.
 *
 * @apiParam {String} title Titolo (o parte del titolo) del libro
 * @apiExample {curl} Esempio:
 *     curl -k https://localhost/api/getreview/bytitle/harry+potter
 *
 * @apiUse ReviewsSuccess
 *
 * @apiError (400) attribute_not_declared Manca il titolo
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     { "error": "attribute title not declared" }
 *
 * @apiError (404) no_books Nessun libro trovato con quel titolo
 * @apiErrorExample Not-Found:
 *     HTTP/1.1 404 Not Found
 *     { "error": "No books with this title" }
 */

/**
 * @api {get} /api/getreview/byid/:id Recensioni di un libro per id
 * @apiName GetReviewById
 * @apiGroup Recensioni
 * @apiDescription L'id è quello di Google Books. Si può passare anche come query string:
 * <code>/api/getreview/byid?id=t_i_yQEACAAJ</code>.
 *
 * @apiParam {String} id Id del libro su Google Books
 * @apiExample {curl} Esempio:
 *     curl -k https://localhost/api/getreview/byid/t_i_yQEACAAJ
 *
 * @apiUse ReviewsSuccess
 *
 * @apiError (400) attribute_not_declared Manca l'id
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     { "error": "attribute id not declared" }
 *
 * @apiError (404) no_book Nessun libro con questo id su Google Books
 * @apiErrorExample Not-Found:
 *     HTTP/1.1 404 Not Found
 *     { "error": "No book for this id in google books" }
 */
