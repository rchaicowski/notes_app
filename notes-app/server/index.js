require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const { requestLogger } = require('./middleware/requestLogger');

// Parse allowed origins from env (comma separated). Fallback to localhost dev origins.
const rawOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean);
const isDev = (process.env.NODE_ENV || 'development') === 'development';

const corsOptions = {
  origin: (origin, callback) => {
    // allow non-browser requests (curl/postman) which typically have no origin
    if (!origin) return callback(null, true);
    if (rawOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Helmet + CSP: stricter in production, slightly relaxed in development for convenience
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  connectSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'"],
  frameAncestors: ["'self'"],
  styleSrc: ["'self'"]
};

if (isDev) {
  // Allow common dev hosts and inline styles/eval used by some dev tools
  cspDirectives.scriptSrc.push("'unsafe-eval'", "'unsafe-inline'", 'http://localhost:35729');
  cspDirectives.styleSrc.push("'unsafe-inline'");
}

if (isDev) {
  app.use(
    helmet({
      contentSecurityPolicy: { directives: cspDirectives },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false
    })
  );
} else {
  app.use(
    helmet({
      contentSecurityPolicy: { directives: cspDirectives }
    })
  );
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
