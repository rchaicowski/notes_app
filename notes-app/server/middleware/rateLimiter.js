const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        status: 'error',
        message: 'Too many requests. Please try again after 15 minutes.',
        details: 'Rate limit exceeded'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// More restrictive limiter for write operations (POST, PUT, DELETE)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // limit each IP to 30 write operations per windowMs
    message: {
        status: 'error',
        message: 'Too many write operations. Please try again after 15 minutes.',
        details: 'Rate limit exceeded for write operations'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Very strict limiter for authentication endpoints to mitigate brute-force attacks
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 6, // allow only a few attempts per IP per window
    message: {
        status: 'error',
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
        details: 'Rate limit exceeded for authentication'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { limiter, strictLimiter, authLimiter };
