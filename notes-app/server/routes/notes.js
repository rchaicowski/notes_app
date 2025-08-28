const express = require('express');
const router = express.Router();
const pool = require('../db');
const { validateNote } = require('../middleware/validateRequest');
const { validateId } = require('../middleware/validateId');
const { validateQueryParams, validateHeaders } = require('../middleware/validateCommon');
const { AppError } = require('../middleware/errorHandler');
const { limiter, strictLimiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');

// GET all notes with pagination
router.get('/', auth, limiter, validateQueryParams, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT id, content, created_at, updated_at, user_id FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// POST a new note
router.post('/', auth, strictLimiter, validateHeaders, validateNote, async (req, res, next) => {
    try {
        const result = await pool.query(
            'INSERT INTO notes (content, created_at, updated_at, user_id) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $2) RETURNING *',
            [req.body.content, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// PUT (update) a note
router.put('/:id', auth, strictLimiter, validateHeaders, validateId, validateNote, async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE notes SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
            [req.body.content, id, req.user.id]
        );

        if (result.rowCount === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// DELETE a note
router.delete('/:id', auth, strictLimiter, validateId, async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.user.id]);

        if (result.rowCount === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json({ message: 'Note deleted', note: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
