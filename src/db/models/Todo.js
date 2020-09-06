const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  content: { type: String, required: true }
});

module.exports = mongoose.model('Todo', todoSchema);;
