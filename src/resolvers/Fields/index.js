// Field level resolvers for resolving possible query chains
// https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolver-chains

const camera = require('./camera');
const image = require('./image');

module.exports = {
  Camera: { ...camera},
  Image: { ...image },
};

