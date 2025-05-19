require('dotenv').config({ path: './server/.env' });

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const notesRoutes = require('./routes/notes');
app.use('/api/notes', notesRoutes);  // ✅ All note routes are here now

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
