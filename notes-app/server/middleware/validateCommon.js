const { AppError } = require('./errorHandler');

const validateQueryParams = (req, res, next) => {
    try {
        // Validate pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;

        if (page < 1) {
            throw new AppError('Page number must be positive', 400);
        }

        if (limit < 1 || limit > 100) {
            throw new AppError('Limit must be between 1 and 100', 400);
        }

        // Store sanitized values
        req.query.page = page;
        req.query.limit = limit;
        
        next();
    } catch (error) {
        error.name = 'ValidationError';
        next(error);
    }
};

// Validate content type header
const validateHeaders = (req, res, next) => {
    try {
        // Check Content-Type for POST and PUT requests
        if (['POST', 'PUT'].includes(req.method)) {
            const contentType = req.headers['content-type'];
            if (!contentType || !contentType.includes('application/json')) {
                throw new AppError('Content-Type must be application/json', 400);
            }
        }
        
        next();
    } catch (error) {
        error.name = 'ValidationError';
        next(error);
    }
};

module.exports = { validateQueryParams, validateHeaders };
