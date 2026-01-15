/**
 * @fileoverview Secure token generation utilities
 * @module utils/tokenGenerator
 */

const crypto = require('crypto');

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function getExpirationTime(hours) {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + hours);
    return expiration;
}

function isExpired(expirationTime) {
    return new Date() > new Date(expirationTime);
}

module.exports = {
    generateToken,
    getExpirationTime,
    isExpired
};
