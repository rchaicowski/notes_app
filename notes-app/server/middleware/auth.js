/**
 * @fileoverview JWT authentication middleware
 * Validates JWT tokens and sets req.user for authenticated requests
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

// Validate JWT_SECRET at startup
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is required');
}

/**
 * Authentication middleware
 * Validates JWT token from Authorization header and sets req.user
 * 
 * Expects header format: Authorization: Bearer <token>
 * On success, sets req.user = { id: <user_id> }
 * 
 * @middleware
 * @param {Object} req - Express request object
 * @param {string} req.headers.authorization - Authorization header with Bearer token
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @throws {AppError} 401 - If token is missing, invalid, or expired
 * @example
 * // Use in routes:
 * router.get('/protected', auth, (req, res) => {
 *   console.log(req.user.id); // User ID from token
 * });
 */
const auth = (req, res, next) => {
    try {
        // Extract token from Authorization header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new AppError('Authentication required', 401);
        }

        // Verify token signature and decode payload
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Validate token structure (must contain user ID)
        if (!decoded.id) {
            throw new AppError('Invalid token structure', 401);
        }

        // Set user info for downstream middleware/routes
        req.user = decoded;
        
        // Optional: Log successful auth (useful for debugging)
        // console.log(`[Auth] User ${decoded.id} authenticated`);
        
        next();
    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
            next(new AppError('Token expired', 401));
        } else if (error.name === 'JsonWebTokenError') {
            next(new AppError('Invalid token', 401));
        } else if (error instanceof AppError) {
            next(error);
        } else {
            next(new AppError('Authentication failed', 401));
        }
    }
};

module.exports = { auth };
