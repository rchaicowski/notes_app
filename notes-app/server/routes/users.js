/**
 * @fileoverview User authentication and account management routes
 * Handles user registration, login, and account deletion with security features
 * @module routes/users
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { validateHeaders, validateUser } = require('../middleware/validateCommon');
const { limiter, authLimiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Validate JWT_SECRET exists at startup
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is required');
}

// Token expiry: 7 days (balanced between security and user convenience)
const TOKEN_EXPIRY = '7d';

/**
 * DELETE /api/users/account
 * Deletes the authenticated user's account and all associated data
 * 
 * @route DELETE /api/users/account
 * @access Private
 * @returns {Object} 200 - Success message
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Server error
 */
router.delete('/account', auth, async (req, res, next) => {
    try {
        await pool.query('BEGIN');

        const userResult = await pool.query(
            'SELECT email FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            throw new AppError('User not found', 404);
        }

        const userEmail = userResult.rows[0].email;

        // Delete all user's notes
        await pool.query('DELETE FROM notes WHERE user_id = $1', [req.user.id]);

        // Delete the user account
        await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

        // Add email to cooldown list (15-minute block)
        await pool.query(
            'INSERT INTO deleted_emails (email, deleted_at) VALUES ($1, CURRENT_TIMESTAMP)',
            [userEmail]
        );

        await pool.query('COMMIT');

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        await pool.query('ROLLBACK');
        next(error);
    }
});

/**
 * POST /api/users/register
 * Creates a new user account with email/password authentication
 * 
 * @route POST /api/users/register
 * @access Public
 * @param {Object} req.body - Registration data
 * @param {string} req.body.email - User email (required)
 * @param {string} req.body.password - User password (required, min 8 chars)
 * @param {string} req.body.name - User display name (optional)
 * @returns {Object} 201 - User object and JWT token
 * @returns {Object} 400 - Validation error
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
router.post('/register', authLimiter, validateHeaders, validateUser, async (req, res, next) => {
    try {
        const { email, password, name } = req.body;

        await pool.query('BEGIN');

        // Check if user exists or email is in cooldown
        const [userExists, recentlyDeleted] = await Promise.all([
            pool.query('SELECT id FROM users WHERE email = $1', [email]),
            pool.query(
                'SELECT email FROM deleted_emails WHERE email = $1 AND deleted_at > NOW() - INTERVAL \'15 minutes\'',
                [email]
            )
        ]);

        if (userExists.rows.length > 0) {
            await pool.query('ROLLBACK');
            throw new AppError('Email already registered', 400);
        }

        if (recentlyDeleted.rows.length > 0) {
            await pool.query('ROLLBACK');
            throw new AppError(
                'This email was recently associated with a deleted account. Please wait 15 minutes before registering again.',
                400
            );
        }

        // Hash password with bcrypt
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user account
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, password_hash, name]
        );

        const user = result.rows[0];

        // Remove email from cooldown list
        await pool.query('DELETE FROM deleted_emails WHERE email = $1', [email]);

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        await pool.query('COMMIT');

        res.status(201).json({
            user: user,
            token: token
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        next(error);
    }
});

/**
 * POST /api/users/login
 * Authenticates a user and returns a JWT token
 * 
 * @route POST /api/users/login
 * @access Public
 * @param {Object} req.body - Login credentials
 * @param {string} req.body.email - User email (required)
 * @param {string} req.body.password - User password (required)
 * @returns {Object} 200 - User object and JWT token
 * @returns {Object} 400 - Missing credentials
 * @returns {Object} 401 - Invalid credentials
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
router.post('/login', authLimiter, validateHeaders, validateUser, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const result = await pool.query(
            'SELECT id, email, name, password_hash FROM users WHERE email = $1',
            [email]
        );

        // User not found - generic error prevents user enumeration
        if (result.rows.length === 0) {
            throw new AppError('Invalid credentials', 401);
        }

        const user = result.rows[0];

        // Verify password with bcrypt
        const validPassword = await bcrypt.compare(password, user.password_hash);

        // Invalid password - same generic error
        if (!validPassword) {
            throw new AppError('Invalid credentials', 401);
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        // Return user data (never include password_hash)
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            token: token
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/cleanup-deleted-emails
 * Maintenance endpoint - removes expired entries from deleted_emails table
 * 
 * Call this periodically via cron job to clean up old cooldown entries.
 * Recommended: Every hour or every 30 minutes
 * 
 * @route GET /api/users/cleanup-deleted-emails
 * @access Public
 * @returns {Object} 200 - Cleanup statistics
 * @returns {Object} 500 - Server error
 */
router.get('/cleanup-deleted-emails', limiter, async (req, res, next) => {
    try {
        // Delete entries older than 15 minutes
        const deleteResult = await pool.query(
            'DELETE FROM deleted_emails WHERE deleted_at <= NOW() - INTERVAL \'15 minutes\' RETURNING email'
        );

        // Get remaining count
        const remainingResult = await pool.query(
            'SELECT COUNT(*) FROM deleted_emails'
        );

        res.json({
            message: 'Cleanup completed',
            deletedCount: deleteResult.rowCount,
            remainingCount: parseInt(remainingResult.rows[0].count)
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
