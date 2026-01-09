/**
 * @fileoverview Common validation middleware
 * Validates query parameters, headers, and user input
 * @module middleware/validateCommon
 */

const { AppError } = require('./errorHandler');

// Configuration constants
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 15;  // Match frontend (15 notes per page)
const MAX_LIMIT = 100;
const MIN_PASSWORD_LENGTH = 8;  // Modern security standard
const MIN_NAME_LENGTH = 1;

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates and sanitizes pagination query parameters
 * 
 * @middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 * @throws {AppError} 400 - If validation fails
 */
const validateQueryParams = (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = parseInt(req.query.limit) || DEFAULT_LIMIT;

        if (page < 1) {
            throw new AppError('Page number must be positive', 400, 'INVALID_PAGE');
        }

        if (limit < 1 || limit > MAX_LIMIT) {
            throw new AppError(`Limit must be between 1 and ${MAX_LIMIT}`, 400, 'INVALID_LIMIT');
        }

        req.query.page = page;
        req.query.limit = limit;
        
        next();
    } catch (error) {
        error.name = 'ValidationError';
        next(error);
    }
};

/**
 * Validates Content-Type header for POST and PUT requests
 * 
 * @middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 * @throws {AppError} 400 - If Content-Type invalid
 */
const validateHeaders = (req, res, next) => {
    try {
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            const contentType = req.headers['content-type'];
            
            if (!contentType || !contentType.includes('application/json')) {
                throw new AppError(
                    'Content-Type must be application/json',
                    400,
                    'INVALID_CONTENT_TYPE'
                );
            }
        }
        
        next();
    } catch (error) {
        error.name = 'ValidationError';
        next(error);
    }
};

/**
 * Validates user registration/login data
 * 
 * @middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 * @throws {AppError} 400 - If validation fails
 */
const validateUser = (req, res, next) => {
    try {
        const { email, password, name } = req.body;

        // Validate email
        if (!email || typeof email !== 'string') {
            throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
        }

        if (!EMAIL_REGEX.test(email)) {
            throw new AppError('Valid email is required', 400, 'INVALID_EMAIL');
        }

        // Validate password
        if (!password || typeof password !== 'string') {
            throw new AppError('Password is required', 400, 'PASSWORD_REQUIRED');
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
            throw new AppError(
                `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
                400,
                'PASSWORD_TOO_SHORT'
            );
        }

        // Validate optional name
        if (name !== undefined && name !== null) {
            if (typeof name !== 'string') {
                throw new AppError('Name must be a string', 400, 'INVALID_NAME_TYPE');
            }
            
            if (name.trim().length < MIN_NAME_LENGTH) {
                throw new AppError(
                    `Name must be at least ${MIN_NAME_LENGTH} character`,
                    400,
                    'NAME_TOO_SHORT'
                );
            }
        }

        next();
    } catch (error) {
        error.name = 'ValidationError';
        next(error);
    }
};

module.exports = { validateQueryParams, validateHeaders, validateUser };
