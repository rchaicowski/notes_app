const express = require('express');
const router = express.Router();
const pool = require('../db');

function sanitizeInput(input, maxLength = 255) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

// GET all notes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notes ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching notes:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST a new note
router.post('/', async (req, res) => {
  let { title, content } = req.body;
  title = sanitizeInput(title);
  content = sanitizeInput(content);

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error inserting note:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT (update) a note
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  let { title, content } = req.body;
  title = sanitizeInput(title);
  content = sanitizeInput(content);

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE notes SET title = $1, content = $2 WHERE id = $3 RETURNING *',
      [title, content, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error updating note:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE a note
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.json({ message: 'Note deleted', note: result.rows[0] });
  } catch (err) {
    console.error('❌ Error deleting note:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
