const { MONGO_DB_URL } = process.env;

const CONFIG = {
  MONGO_DB_URL,
  TIME_FORMATS: {
    EXIF: 'YYYY:MM:DD hh:mm:ss',
    // imageId: 'YYYY-MM-DD:hh-mm-ss',
  },
};

module.exports = { ...CONFIG };
