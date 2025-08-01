const requestLogger = (req, res, next) => {
    // Get timestamp when request starts
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log the incoming request with timestamp
    console.log(`\n� ${timestamp} - ${req.method} ${req.url}`);
    
    // Log request body if present (useful for POST/PUT requests)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
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
