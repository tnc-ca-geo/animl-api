const { MONGO_DB_URL, SESSION_SECRET } = process.env;

const CONFIG = {
  SESSION_SECRET,
  MONGO_DB_URL,
  TIME_FORMATS: {
    EXIF: 'YYYY:MM:DD hh:mm:ss',
    // imageId: 'YYYY-MM-DD:hh-mm-ss',
  },
};

module.exports = { ...CONFIG };
