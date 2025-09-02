const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { validateHeaders, validateUser } = require('../middleware/validateCommon');
const { limiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');

// Delete account
router.delete('/account', auth, async (req, res, next) => {
    try {
        // Begin transaction
        await pool.query('BEGIN');

        // Get user's email for cooldown check
        const userEmail = await pool.query(
            'SELECT email FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userEmail.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete all user's notes first
        await pool.query('DELETE FROM notes WHERE user_id = $1', [req.user.id]);

        // Delete the user
        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 RETURNING email',
            [req.user.id]
        );

        // Store the deleted email with a cooldown timestamp
        await pool.query(
            'INSERT INTO deleted_emails (email, deleted_at) VALUES ($1, CURRENT_TIMESTAMP)',
            [userEmail.rows[0].email]
        );

        // Commit transaction
        await pool.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        await pool.query('ROLLBACK');
        next(error);
    }
});

// Register new user
router.post('/register', limiter, validateHeaders, validateUser, async (req, res, next) => {
    try {
        const { email, password, name } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Begin transaction
        await pool.query('BEGIN');

        // Check if user exists or is in cooldown
        const [userExists, recentlyDeleted] = await Promise.all([
            pool.query('SELECT * FROM users WHERE email = $1', [email]),
            pool.query('SELECT * FROM deleted_emails WHERE email = $1 AND deleted_at > NOW() - INTERVAL \'15 minutes\'', [email])
        ]);

        if (userExists.rows.length > 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: 'Email already registered' });
        }

        if (recentlyDeleted.rows.length > 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'This email was recently associated with a deleted account. Please wait 15 minutes before registering again.' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, password_hash, name]
        );

        // Remove from deleted_emails if exists
        await pool.query('DELETE FROM deleted_emails WHERE email = $1', [email]);

        // Generate token
        const token = jwt.sign(
            { id: result.rows[0].id, email: result.rows[0].email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Commit transaction
        await pool.query('COMMIT');

        res.status(201).json({
            user: result.rows[0],
            token
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        next(error);
    }
});

// Login user
router.post('/login', limiter, validateHeaders, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            token
        });
    } catch (error) {
        // Handle unique constraint violation
        if (error.code === '23505' && error.constraint === 'users_email_key') {
            return res.status(400).json({ error: 'Email already registered' });
        }
        next(error);
    }
});

module.exports = router;
