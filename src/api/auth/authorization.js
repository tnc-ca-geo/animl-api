const jwt = require('jwt-simple');

function getUserInfo(req) {
    const token = req.headers.Authorization || req.headers.authorization;
    if (!token) {
        return {};
    }
    return jwt.decode(token.replace("Bearer", ""), null, true /* API Gateway handles verification */);
}

module.exports = {
    getUserInfo,
};
