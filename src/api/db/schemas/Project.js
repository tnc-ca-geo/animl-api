const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let ProjectSchema = new Schema({
  _id: { type: String, required: true },  // _id is name in_snake_case
  name: { type: String, required: true },
  timezone: { type: String, default: 'America/Los_Angeles', required: true },
  description: { type: String },
});

module.exports = mongoose.model('Project', ProjectSchema);