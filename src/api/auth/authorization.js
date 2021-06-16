const jwt = require('jwt-simple');

const BEARER_TOKEN_PATTERN = /^Bearer [-_=.0-9a-zA-Z]+$/i;

function getUserInfo(req) {
    const token = req.headers.Authorization || req.headers.authorization;
    if (!token || !BEARER_TOKEN_PATTERN.test(token)) {
        return {};
    }
    return jwt.decode(
        token.substring('Bearer '.length), // Everything after the Bearer prefix.
        null, // Secret doesn't matter since the APIG verifies.
        true // API Gateway handles verification, so we don't.
    );
}

module.exports = {
    getUserInfo,
};
