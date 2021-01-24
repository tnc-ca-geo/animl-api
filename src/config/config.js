const {
  MONGO_DB_URL,
  MEGADETECTOR_API_KEY
} = process.env;

const CONFIG = {
  MONGO_DB_URL,
  IMAGES_URL: 'https://dcgt63meba0hf.cloudfront.net/',
  MEGADETECTOR_API_KEY,
  MEGADETECTOR_URL: 'https://aiforearth.azure-api.net/api/v1/camera-trap/sync/detect',
  MEGADETECTOR_CONF_THRESHOLD: 0.8,
  // TODO: get clarity on categories. Is there a 'group' category?
  // https://github.com/microsoft/CameraTraps/blob/master/detection/run_tf_detector.py
  MEGADETECTOR_CATEGORIES: [
    {id: 0, name: 'empty'},
    {id: 1, name: 'animal'},
    {id: 2, name: 'person'},
    {id: 3, name: 'vehicle'}
  ],
  TIME_FORMATS: {
    EXIF: 'YYYY:MM:DD hh:mm:ss',
    // imageId: 'YYYY-MM-DD:hh-mm-ss',
  },
  
};


module.exports = { ...CONFIG };
