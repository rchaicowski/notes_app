/**
 * @fileoverview User authentication and account management routes
 * Handles user registration, login, account deletion, email verification, and password reset
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
const { generateToken, getExpirationTime, isExpired } = require('../utils/tokenGenerator');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

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
 * Sends verification email to confirm email address
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
            throw new AppError('Email already registered', 400, 'EMAIL_EXISTS');
        }

        if (recentlyDeleted.rows.length > 0) {
            await pool.query('ROLLBACK');
            throw new AppError(
                'This email was recently associated with a deleted account. Please wait 15 minutes before registering again.',
                400,
                'EMAIL_COOLDOWN'
            );
        }

        // Hash password with bcrypt
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Generate verification token (24 hours expiry)
        const verificationToken = generateToken();
        const verificationExpires = getExpirationTime(24);

        // Create user account with verification token
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, name, email_verified, verification_token, verification_token_expires) 
             VALUES ($1, $2, $3, false, $4, $5) 
             RETURNING id, email, name, email_verified`,
            [email, password_hash, name, verificationToken, verificationExpires]
        );

        const user = result.rows[0];

        // Remove email from cooldown list
        await pool.query('DELETE FROM deleted_emails WHERE email = $1', [email]);

        await pool.query('COMMIT');

        // Send verification email (don't wait for it - fire and forget)
        sendVerificationEmail(email, verificationToken).catch(err => {
            console.error('⚠️ Failed to send verification email:', err.message);
        });

        // Generate JWT token (user can still use app, just log warning if not verified)
        const token = jwt.sign(
            { id: user.id },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.status(201).json({
            user: user,
            token: token,
            message: 'Registration successful! Please check your email to verify your account.'
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
            'SELECT id, email, name, password_hash, email_verified FROM users WHERE email = $1',
            [email]
        );

        // User not found - generic error prevents user enumeration
        if (result.rows.length === 0) {
            throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
        }

        const user = result.rows[0];

        // Verify password with bcrypt
        const validPassword = await bcrypt.compare(password, user.password_hash);

        // Invalid password - same generic error
        if (!validPassword) {
            throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
        }

        // Log warning if email not verified (but still allow login)
        if (!user.email_verified) {
            console.log(`⚠️ User ${email} logged in without email verification`);
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
                name: user.name,
                email_verified: user.email_verified
            },
            token: token
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/verify-email
 * Verifies user email with token from email link
 * 
 * @route GET /api/users/verify-email
 * @access Public
 * @query {string} token - Verification token from email
 * @returns {Object} 200 - Success message
 * @returns {Object} 400 - Invalid or expired token
 */
router.get('/verify-email', async (req, res, next) => {
    try {
        const { token } = req.query;

        if (!token) {
            throw new AppError('Verification token is required', 400, 'TOKEN_REQUIRED');
        }

        // Find user with this token
        const result = await pool.query(
            'SELECT id, email, verification_token_expires FROM users WHERE verification_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            throw new AppError('Invalid verification token', 400, 'INVALID_TOKEN');
        }

        const user = result.rows[0];

        // Check if token expired
        if (isExpired(user.verification_token_expires)) {
            throw new AppError('Verification token has expired', 400, 'TOKEN_EXPIRED');
        }

        // Verify email
        await pool.query(
            `UPDATE users 
             SET email_verified = true, 
                 verification_token = NULL, 
                 verification_token_expires = NULL 
             WHERE id = $1`,
            [user.id]
        );

        res.json({
            status: 'success',
            message: 'Email verified successfully! You can now use all features.'
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/users/forgot-password
 * Initiates password reset process
 * Sends email with reset token if user exists
 * 
 * Security: Always returns success to prevent email enumeration
 * 
 * @route POST /api/users/forgot-password
 * @access Public
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email address
 * @returns {Object} 200 - Success message (always, even if email not found)
 * @returns {Object} 400 - Email missing
 * @returns {Object} 429 - Rate limit exceeded
 */
router.post('/forgot-password', limiter, validateHeaders, async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
        }

        // Find user
        const result = await pool.query(
            'SELECT id, email FROM users WHERE email = $1',
            [email]
        );

        // Always return success (don't reveal if email exists - prevents email enumeration)
        if (result.rows.length === 0) {
            return res.json({
                status: 'success',
                message: 'If that email exists, a password reset link has been sent.'
            });
        }

        const user = result.rows[0];

        // Generate reset token (1 hour expiration)
        const resetToken = generateToken();
        const expiresAt = getExpirationTime(1);

        // Store token in database
        await pool.query(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
             VALUES ($1, $2, $3)`,
            [user.id, resetToken, expiresAt]
        );

        // Send email (don't wait - fire and forget)
        sendPasswordResetEmail(email, resetToken).catch(err => {
            console.error('⚠️ Failed to send password reset email:', err.message);
        });

        res.json({
            status: 'success',
            message: 'If that email exists, a password reset link has been sent.'
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/users/reset-password
 * Resets user password with valid token
 * Validates token, checks expiration, updates password
 * 
 * @route POST /api/users/reset-password
 * @access Public
 * @param {Object} req.body - Request body
 * @param {string} req.body.token - Reset token from email
 * @param {string} req.body.password - New password (min 8 chars)
 * @returns {Object} 200 - Success message
 * @returns {Object} 400 - Invalid token, expired token, or weak password
 * @returns {Object} 429 - Rate limit exceeded
 */
router.post('/reset-password', limiter, validateHeaders, async (req, res, next) => {
    try {
        const { token, password } = req.body;

        if (!token) {
            throw new AppError('Reset token is required', 400, 'TOKEN_REQUIRED');
        }

        if (!password || password.length < 8) {
            throw new AppError('Password must be at least 8 characters', 400, 'INVALID_PASSWORD');
        }

        await pool.query('BEGIN');

        // Find token
        const tokenResult = await pool.query(
            `SELECT id, user_id, expires_at, used 
             FROM password_reset_tokens 
             WHERE token = $1`,
            [token]
        );

        if (tokenResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            throw new AppError('Invalid reset token', 400, 'INVALID_TOKEN');
        }

        const resetToken = tokenResult.rows[0];

        // Check if already used
        if (resetToken.used) {
            await pool.query('ROLLBACK');
            throw new AppError('Reset token has already been used', 400, 'TOKEN_USED');
        }

        // Check if expired
        if (isExpired(resetToken.expires_at)) {
            await pool.query('ROLLBACK');
            throw new AppError('Reset token has expired', 400, 'TOKEN_EXPIRED');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Update password
        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [password_hash, resetToken.user_id]
        );

        // Mark token as used
        await pool.query(
            'UPDATE password_reset_tokens SET used = true WHERE id = $1',
            [resetToken.id]
        );

        await pool.query('COMMIT');

        res.json({
            status: 'success',
            message: 'Password reset successful! You can now log in with your new password.'
        });

    } catch (error) {
        await pool.query('ROLLBACK');
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
