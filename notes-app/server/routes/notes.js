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
            'SELECT id, title, content, formatting, created_at, updated_at, user_id FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
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
        const title = (req.body.title && typeof req.body.title === 'string') ? req.body.title.trim() : 'Untitled';
        const formatting = req.body.formatting || [];

        const result = await pool.query(
            'INSERT INTO notes (title, content, formatting, created_at, updated_at, user_id) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4) RETURNING *',
            [title, req.body.content, JSON.stringify(formatting), req.user.id]
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
        const title = (req.body.title && typeof req.body.title === 'string') ? req.body.title.trim() : undefined;
        const formatting = req.body.formatting;

        // Build query dynamically to allow partial updates
        const fields = [];
        const values = [];
        let idx = 1;

        if (typeof title !== 'undefined') {
            fields.push(`title = $${idx++}`);
            values.push(title);
        }

        if (typeof req.body.content !== 'undefined') {
            fields.push(`content = $${idx++}`);
            values.push(req.body.content);
        }

        if (typeof formatting !== 'undefined') {
            fields.push(`formatting = $${idx++}::jsonb`);
            values.push(JSON.stringify(formatting));
        }

        // Always update updated_at
        fields.push(`updated_at = CURRENT_TIMESTAMP`);

        if (fields.length === 0) {
            throw new AppError('No valid fields provided for update', 400);
        }

        const query = `UPDATE notes SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`;
        values.push(id, req.user.id);

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// GET single note detail (includes formatting)
router.get('/:id', auth, validateId, async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, req.user.id]);

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
