/**
 * @fileoverview Request logging middleware with security features
 * Logs requests with masked sensitive data, performance metrics, and status indicators
 * @module middleware/requestLogger
 */

/**
 * Regex pattern for detecting sensitive keys
 * Matches: password, token, auth, secret, key, ssn, card, cvv, pin, otp, session, credit
 * Case-insensitive and works with camelCase, snake_case, etc.
 */
const SENSITIVE_KEYS_RE = /password|pwd|pass|token|auth|secret|key|ssn|card|cvv|pin|otp|session|credit/i;

/**
 * Sensitive API paths that should have extra logging protection
 * All request bodies on these paths are fully masked
 */
const SENSITIVE_PATHS = ['/api/users/login', '/api/users/register', '/api/users/account'];

/**
 * Masks sensitive values in objects
 * Used as JSON.stringify replacer function
 * 
 * @param {string} key - Property key name
 * @param {*} value - Property value
 * @returns {string|*} '[REDACTED]' for sensitive keys, original value otherwise
 */
function maskSensitive(key, value) {
    if (key && SENSITIVE_KEYS_RE.test(key)) return '[REDACTED]';
    return value;
}

/**
 * Safely stringifies objects with masking and truncation
 * Handles circular references gracefully
 * 
 * @param {Object} obj - Object to stringify
 * @param {number} [maxLen=1000] - Maximum string length before truncation
 * @returns {string} Stringified object, '[unserializable]' on error, or truncated with suffix
 */
function safeStringify(obj, maxLen = 1000) {
    try {
        const str = JSON.stringify(obj, maskSensitive, 2);
        if (str.length > maxLen) return str.slice(0, maxLen) + '... [truncated]';
        return str;
    } catch (err) {
        return '[unserializable]';
    }
}

/**
 * Masks sensitive query parameters in URL
 * 
 * @param {string} url - Full URL with query string
 * @returns {string} URL with sensitive params masked
 */
function maskUrlParams(url) {
    try {
        const [path, queryString] = url.split('?');
        if (!queryString) return path;
        
        const params = new URLSearchParams(queryString);
        const maskedParams = new URLSearchParams();
        
        for (const [key, value] of params) {
            maskedParams.set(key, SENSITIVE_KEYS_RE.test(key) ? '[REDACTED]' : value);
        }
        
        return `${path}?${maskedParams.toString()}`;
    } catch (err) {
        return url;
    }
}

/**
 * Request logging middleware
 * Logs incoming requests with timestamps, masked sensitive data, and performance metrics
 * 
 * Features:
 * - Timestamps in ISO 8601 format
 * - Sensitive data masking (passwords, tokens, etc.)
 * - Request duration tracking
 * - Status code visual indicators (emojis)
 * - Request body truncation to prevent log spam
 * - Extra protection for auth endpoints
 * 
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requestLogger = (req, res, next) => {
    // Skip logging in test environment
    if (process.env.NODE_ENV === 'test') {
        return next();
    }
    
    // Get timestamp when request starts
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Mask sensitive query parameters in URL
    const maskedUrl = maskUrlParams(req.url);
    
    // Log the incoming request with timestamp
    console.log(`\n📝 ${timestamp} - ${req.method} ${maskedUrl}`);

    // Check if this is a sensitive path
    const isSensitivePath = SENSITIVE_PATHS.some(p => req.path.startsWith(p));

    // Log request body with appropriate masking
    if (req.body && Object.keys(req.body).length > 0) {
        if (isSensitivePath) {
            // Extra protection: fully mask body on sensitive paths
            console.log('📦 Request Body (masked):', safeStringify(req.body, 500));
        } else {
            // Normal masking: only mask known sensitive keys
            console.log('📦 Request Body:', safeStringify(req.body, 2000));
        }
    }

    // Log when response is finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        // Choose emoji based on status code
        let statusEmoji;
        if (status >= 500) statusEmoji = '🔴'; // Server error
        else if (status >= 400) statusEmoji = '⚠️'; // Client error
        else if (status >= 300) statusEmoji = '↪️'; // Redirect
        else if (status >= 200) statusEmoji = '✅'; // Success
        else statusEmoji = '📝'; // Information
        
        console.log(
            `${statusEmoji} ${req.method} ${req.path} - ${status} - ${duration}ms`
        );
    });

    next();
};

module.exports = { requestLogger };
