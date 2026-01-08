/**
 * @fileoverview Centralized error handling middleware
 * @module middleware/errorHandler
 */

/**
 * Error handling middleware
 * Catches and formats all errors with consistent responses
 * 
 * @middleware
 * @param {Error|AppError} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';
    
    // Log error with context
    console.error('🔴 Error:', {
        message: err.message,
        status: err.status || 500,
        code: err.code,
        method: req.method,
        path: req.path,
        user: req.user?.id || 'anonymous',
        timestamp: new Date().toISOString()
    });

    // JWT token expired
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            status: 'error',
            message: 'Token has expired',
            code: 'TOKEN_EXPIRED',
            details: isDev ? err.message : null
        });
    }

    // JWT token invalid
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid token',
            code: 'TOKEN_INVALID',
            details: isDev ? err.message : null
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid input data',
            code: 'VALIDATION_ERROR',
            details: isDev ? err.message : null
        });
    }

    // Postgres unique constraint (duplicate)
    if (err.code === '23505') {
        return res.status(409).json({
            status: 'error',
            message: 'Resource already exists',
            code: 'DUPLICATE_RESOURCE',
            details: isDev ? err.message : null
        });
    }

    // Postgres foreign key violation
    if (err.code === '23503') {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid reference',
            code: 'INVALID_REFERENCE',
            details: isDev ? err.message : null
        });
    }

    // Postgres not null violation
    if (err.code === '23502') {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required field',
            code: 'MISSING_FIELD',
            details: isDev ? err.message : null
        });
    }

    // Default error response
    const status = err.status || 500;
    const message = isDev || status < 500 
        ? err.message 
        : 'Internal server error';

    res.status(status).json({
        status: 'error',
        message: message,
        code: err.code || 'INTERNAL_ERROR',
        details: isDev ? err.message : null,
        ...(isDev && { stack: err.stack })
    });
};

/**
 * Custom application error class
 * 
 * @class
 * @extends Error
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} [code] - Optional error code
 * @example
 * throw new AppError('Not found', 404, 'USER_NOT_FOUND');
 */
class AppError extends Error {
    constructor(message, status, code = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { errorHandler, AppError };
