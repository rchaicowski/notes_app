require('dotenv').config({ path: './server/.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const { requestLogger } = require('./middleware/requestLogger');

// Configure CORS with more permissive settings
app.use(cors({
    origin: '*',  // Allow all origins for now
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure Helmet: enable stricter defaults in production, relaxed in development
if (process.env.NODE_ENV === 'production') {
  app.use(helmet()); // use default, secure settings in production
} else {
  // Less restrictive Helmet Configuration for development to avoid blocking inline scripts/styles
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: false,
    hidePoweredBy: true,
    hsts: false,
    ieNoOpen: true,
    noSniff: false,
    referrerPolicy: false,
    xssFilter: true
  }));
}

// NOTE: apply body-parsing with sensible limits per-route so we can keep a
// small global/default limit and allow larger payloads only where needed.
// Defaults can be overridden via environment variables.
const NOTES_BODY_LIMIT = process.env.NOTES_BODY_LIMIT || '1mb';
const USER_BODY_LIMIT = process.env.USER_BODY_LIMIT || '100kb';

// Routes (apply per-route body parsers so requestLogger runs after parsing)
const notesRoutes = require('./routes/notes');
const userRoutes = require('./routes/users');

app.use('/api/notes', express.json({ limit: NOTES_BODY_LIMIT }), requestLogger, notesRoutes);
app.use('/api/users', express.json({ limit: USER_BODY_LIMIT }), requestLogger, userRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
