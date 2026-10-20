function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

// Google Books volume ids are short URL-safe strings, e.g. "t_i_yQEACAAJ".
const isVolumeId = (value) => typeof value === 'string' && /^[\w-]{1,64}$/.test(value);

function volumeIdOr404(value) {
  if (!isVolumeId(value)) throw httpError(404, 'Libro non trovato');
  return value;
}

module.exports = { httpError, isVolumeId, volumeIdOr404 };
