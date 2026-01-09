/**
 * @fileoverview ID validation middleware
 * @module middleware/validateId
 */

const { AppError } = require('./errorHandler');

/**
 * Validates route parameter ID
 * Ensures ID is a positive integer
 * 
 * @middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 * @throws {AppError} 400 - If ID invalid
 */
const validateId = (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id) || id <= 0) {
            throw new AppError('Invalid ID', 400, 'INVALID_ID');
        }

        req.params.id = id;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { validateId };
