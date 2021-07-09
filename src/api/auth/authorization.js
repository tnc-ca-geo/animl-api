const jwt = require('jwt-simple');

const BEARER_TOKEN_PATTERN = /^Bearer [-_=.0-9a-zA-Z]+$/i;

async function getUserInfo(req, config) {
    const token = req.headers.Authorization || req.headers.authorization;
    const api_key = req.headers['x-api-key'];
    // if x-api-key header is present, call was to /internal path
    // and was made by an internal lambda
    if (api_key == config.APIKEY) {
        return {
            "cognito:groups": [
              "animl_superuser"
            ],
          }
    }

    if (!token || !BEARER_TOKEN_PATTERN.test(token)) {
        return {};
    }
    // else, call was made to /external (from the UI), so decode the user's 
    // access token
    return jwt.decode(
        token.substring('Bearer '.length), // Everything after the Bearer prefix.
        null, // Secret doesn't matter since the APIG verifies.
        true // API Gateway handles verification, so we don't.
    );
}

module.exports = {
    getUserInfo,
};
