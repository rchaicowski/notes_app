/**
 * @fileoverview Rate limiting middleware
 * Three-tier system protecting against API abuse and brute force attacks
 * @module middleware/rateLimiter
 */

const rateLimit = require('express-rate-limit');

/**
 * General rate limiter for read operations
 * Applies to most GET endpoints
 * 
 * Limits: 100 requests per 15 minutes per IP
 * 
 * @constant
 * @type {Function}
 */
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    message: {
        status: 'error',
        message: 'Too many requests. Please try again after 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable deprecated X-RateLimit-* headers
    statusCode: 429, // HTTP 429 Too Many Requests
});

/**
 * Strict rate limiter for write operations
 * Applies to POST, PUT, DELETE endpoints
 * 
 * Limits: 30 requests per 15 minutes per IP
 * More restrictive to prevent database abuse
 * 
 * @constant
 * @type {Function}
 */
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // limit each IP to 30 write operations per window
    message: {
        status: 'error',
        message: 'Too many write operations. Please try again after 15 minutes.',
        code: 'WRITE_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
});

/**
 * Very strict rate limiter for authentication endpoints
 * Applies to login, register, password reset endpoints
 * 
 * Limits: 10 requests per 15 minutes per IP
 * Protects against brute force attacks on user accounts
 * Only failed attempts count (successful logins are skipped)
 * 
 * @constant
 * @type {Function}
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // allow 10 attempts per IP per window (increased from 6)
    message: {
        status: 'error',
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    skipSuccessfulRequests: true, // Only count failed attempts
    // Custom handler for logging suspicious activity
    handler: (req, res) => {
        console.log(`⚠️ Auth rate limit hit: IP ${req.ip} on ${req.path}`);
        res.status(429).json({
            status: 'error',
            message: 'Too many authentication attempts. Please try again after 15 minutes.',
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
        });
    }
});

module.exports = { limiter, strictLimiter, authLimiter };
