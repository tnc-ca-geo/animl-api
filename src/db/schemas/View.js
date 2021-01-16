const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let FiltersSchema = new Schema({
  cameras: { type: [String], default: undefined },
  labels: { type: [String], default: undefined },
  createdStart: { type: Date },
  createdEnd: { type: Date },
  addedStart: { type: Date },
  addedEnd: { type: Date },
});


let ViewSchema = new Schema({
  name: { type: String, required: true },
  filters: { type: FiltersSchema, required: true },
  description: { type: String },
});

module.exports = mongoose.model('View', ViewSchema);