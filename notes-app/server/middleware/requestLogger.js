const SENSITIVE_KEYS_RE = /password|token|authToken|ssn|card|cvv|secret/i;

function maskSensitive(key, value) {
    if (key && SENSITIVE_KEYS_RE.test(key)) return '[REDACTED]';
    return value;
}

function safeStringify(obj, maxLen = 1000) {
    try {
        const str = JSON.stringify(obj, maskSensitive, 2);
        if (str.length > maxLen) return str.slice(0, maxLen) + '... [truncated]';
        return str;
    } catch (err) {
        return '[unserializable]';
    }
}

const requestLogger = (req, res, next) => {
    // Get timestamp when request starts
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log the incoming request with timestamp
    console.log(`\n📝 ${timestamp} - ${req.method} ${req.url}`);

    // Avoid logging sensitive payloads in full. For auth routes only show keys and mask values.
    const sensitivePaths = ['/api/users/login', '/api/users/register', '/api/users/account'];
    const isSensitivePath = sensitivePaths.some(p => req.url.startsWith(p));

    if (req.body && Object.keys(req.body).length > 0) {
        if (isSensitivePath) {
            // Log only keys and masked values
            console.log('📦 Request Body (masked):', safeStringify(req.body, 500));
        } else {
            // Log body but mask known sensitive keys and truncate long payloads
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
            `${statusEmoji} ${req.method} ${req.url} - ${status} - ${duration}ms`
        );
    });

    next();
};

module.exports = { requestLogger };
