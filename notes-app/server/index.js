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

// Less restrictive Helmet Configuration for development
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
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

app.use(express.json());
app.use(requestLogger); // Add logging middleware

// Routes
const notesRoutes = require('./routes/notes');
app.use('/api/notes', notesRoutes);  // ✅ All note routes are here now

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
