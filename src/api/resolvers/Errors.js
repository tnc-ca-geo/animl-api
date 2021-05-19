
const { createError } = require('apollo-errors');

const DuplicateImageError = createError('DuplicateImageError', {
    message: 'This image has already been added to the database'
});

module.exports = {
  DuplicateImageError,
};