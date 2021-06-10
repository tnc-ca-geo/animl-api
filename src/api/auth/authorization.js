const jwt = require('jwt-simple');

function getUserInfo(req) {
    const token = req.headers.authorization;
    if (!token) {
        return {};
    }
    return jwt.decode(token, null, true /* API Gateway handles verification */);
}

module.exports = {
    getUserInfo,
};
