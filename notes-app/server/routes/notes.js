const express = require('express');
const router = express.Router();
const pool = require('../db');
const { validateNote } = require('../middleware/validateRequest');
const { AppError } = require('../middleware/errorHandler');
const { limiter, strictLimiter } = require('../middleware/rateLimiter');

function sanitizeInput(input, maxLength = 255) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

// GET all notes
router.get('/', limiter, async (req, res, next) => {
    try {
        const result = await pool.query('SELECT id, content FROM notes ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// POST a new note (only content)
router.post('/', strictLimiter, validateNote, async (req, res, next) => {
    try {
        const result = await pool.query(
            'INSERT INTO notes (content) VALUES ($1) RETURNING *',
            [req.body.content]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// PUT (update) a note (only content)
router.put('/:id', strictLimiter, validateNote, async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE notes SET content = $1 WHERE id = $2 RETURNING *',
            [req.body.content, id]
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
router.delete('/:id', strictLimiter, async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json({ message: 'Note deleted', note: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
