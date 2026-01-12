/**
 * @fileoverview Main Express server application
 * Configures security, routing, middleware, and database connectivity
 * Implements production-ready features: health checks, graceful shutdown, error handling
 * @module server
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Configuration constants
const DEFAULT_PORT = 5000;
const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000';
const DEFAULT_NOTES_BODY_LIMIT = '1mb';
const DEFAULT_USER_BODY_LIMIT = '100kb';

const PORT = process.env.PORT || DEFAULT_PORT;
const NOTES_BODY_LIMIT = process.env.NOTES_BODY_LIMIT || DEFAULT_NOTES_BODY_LIMIT;
const USER_BODY_LIMIT = process.env.USER_BODY_LIMIT || DEFAULT_USER_BODY_LIMIT;

// Middleware
const { requestLogger } = require('./middleware/requestLogger');
const db = require('./db');

/**
 * CORS Configuration
 * Parses allowed origins from environment variable (comma-separated)
 * Defaults to common localhost development ports
 */
const rawOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const isDev = (process.env.NODE_ENV || 'development') === 'development';

const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser requests (curl/postman) which typically have no origin
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

/**
 * Helmet Security Configuration
 * Adds security headers and Content Security Policy
 * More relaxed in development for dev tools, stricter in production
 */
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
    // Allow dev tools and inline styles in development
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

/**
 * Root endpoint - API information
 * Returns basic API metadata and available endpoints
 */
app.get('/', (req, res) => {
    res.json({
        name: 'Notes API',
        version: '1.0.0',
        status: 'running',
        environment: isDev ? 'development' : 'production',
        endpoints: {
            notes: '/api/notes',
            users: '/api/users',
            health: '/health'
        }
    });
});

/**
 * Health check endpoint
 * Used by load balancers and monitoring services to verify server is alive
 * Returns server status and uptime
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: isDev ? 'development' : 'production'
    });
});

/**
 * Routes with per-route body size limits
 * Notes endpoints allow larger payloads (formatting data)
 * User endpoints have smaller limits (just credentials)
 */
const notesRoutes = require('./routes/notes');
const userRoutes = require('./routes/users');

app.use('/api/notes', express.json({ limit: NOTES_BODY_LIMIT }), requestLogger, notesRoutes);
app.use('/api/users', express.json({ limit: USER_BODY_LIMIT }), requestLogger, userRoutes);

/**
 * 404 handler for unknown routes
 * Returns JSON error instead of HTML for consistency
 * Must be placed before error handler
 */
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND'
    });
});

/**
 * Global error handler
 * Catches all errors from routes and middleware
 * Must be last middleware
 */
app.use(errorHandler);

/**
 * Validate critical environment variables at startup
 * Fails fast if required config is missing
 */
if (!process.env.JWT_SECRET) {
    console.error('❌ Missing JWT_SECRET environment variable. Set JWT_SECRET in your .env or environment.');
    process.exit(1);
}

/**
 * Graceful shutdown handler
 * Closes server and database connections properly
 * Prevents interrupted requests and connection leaks
 * 
 * @param {string} signal - Signal name (SIGTERM or SIGINT)
 */
let server; // Declare server variable for shutdown access

async function gracefulShutdown(signal) {
    console.log(`\n⏳ Received ${signal}, shutting down gracefully...`);
    
    // Close HTTP server (stops accepting new requests)
    if (server) {
        server.close(() => {
            console.log('✅ HTTP server closed');
        });
    }
    
    // Close database pool
    try {
        if (db && typeof db.closePool === 'function') {
            await db.closePool();
            console.log('✅ Database pool closed');
        }
    } catch (err) {
        console.error('⚠️ Error closing database pool:', err.message);
    }
    
    process.exit(0);
}

/**
 * Server initialization and startup
 * Starts HTTP server, initializes database, and sets up shutdown handlers
 */
(async () => {
    try {
        // Start HTTP server
        server = app.listen(PORT, () => {
            console.log(`✅ Server is running on port ${PORT}`);
            console.log(`📝 Environment: ${isDev ? 'development' : 'production'}`);
            console.log(`🔒 CORS allowed origins: ${rawOrigins.join(', ')}`);
        });

        // Optional database initialization (only if RUN_DB_INIT=true)
        if (typeof db.runInitSqlIfRequested === 'function') {
            await db.runInitSqlIfRequested();
        }
        
        // Verify database connectivity
        if (db && typeof db.query === 'function') {
            const res = await db.query('SELECT NOW()');
            if (res && res.rows && res.rows[0] && res.rows[0].now) {
                console.log('✅ Connected to DB at:', res.rows[0].now);
            }
        }
        
        // Set up graceful shutdown handlers
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
    } catch (err) {
        console.error('❌ Startup error:', err);
        process.exit(1);
    }
})();
