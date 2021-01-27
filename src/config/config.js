const {
  MONGO_DB_URL,
  MEGADETECTOR_API_KEY
} = process.env;

const CONFIG = {
  MONGO_DB_URL,
  ANIML_IMAGES_URL: 'https://d3pkyb5gv8sihx.cloudfront.net/',
  ANIML_API_URL: 'https://omu1dx586i.execute-api.us-west-1.amazonaws.com/dev/',
  AUTOMATION_QUEUE_URL: 'https://sqs.us-west-1.amazonaws.com/830244800171/automationQueue',
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
  EMAIL_ALERT_SENDER: 'tnc.iot.bot@gmail.com'
};


module.exports = { ...CONFIG };
