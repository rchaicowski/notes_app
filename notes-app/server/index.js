require('dotenv').config({ path: './server/.env' });

// index.js
const express = require('express');
const cors = require('cors');
const pool = require('./db'); // <- Import your DB pool

const app = express();
const PORT = process.env.PORT || 5000;

const notes = [];

// Middleware
app.use(cors());
app.use(express.json());

function sanitizeInput(input, maxLength = 255) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

// Routes

// GET notes from the database
app.get('/api/notes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notes ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching notes:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST a new note to the database
app.post('/api/notes', async (req, res) => {
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

// DELETE a note
app.delete('/api/notes/:id', async (req, res) => {
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

// PUT update a note
app.put('/api/notes/:id', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
