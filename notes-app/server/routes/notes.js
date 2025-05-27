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
    const result = await pool.query('SELECT id, content FROM notes ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching notes:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST a new note (only content)
router.post('/', async (req, res) => {
  let { content } = req.body;
  console.log('📨 Received content:', content);
  content = sanitizeInput(content);
  if (!content) return res.status(400).json({ message: 'Content is required' });
  try {
    const result = await pool.query(
      'INSERT INTO notes (content) VALUES ($1) RETURNING *',
      [content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error inserting note:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT (update) a note (only content)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  let { content } = req.body;
  content = sanitizeInput(content);

  if (!content) {
    return res.status(400).json({ message: 'Content is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE notes SET content = $1 WHERE id = $2 RETURNING *',
      [content, id]
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
