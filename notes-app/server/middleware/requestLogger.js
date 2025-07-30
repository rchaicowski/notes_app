const requestLogger = (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl } = req;

    // Log request start
    console.log(`🔵 ${method} ${originalUrl} - Started`);

    // Once the request is finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        // Color status code based on type
        let statusEmoji;
        if (status >= 500) statusEmoji = '🔴'; // Server error
        else if (status >= 400) statusEmoji = '🟡'; // Client error
        else if (status >= 300) statusEmoji = '🟣'; // Redirect
        else if (status >= 200) statusEmoji = '🟢'; // Success
        else statusEmoji = '⚪'; // Information
        
        console.log(
            `${statusEmoji} ${method} ${originalUrl} - ${status} - ${duration}ms`
        );
    });

    next();
};

module.exports = { requestLogger };
