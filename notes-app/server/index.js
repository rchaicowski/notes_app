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

app.use(express.json());
app.use(requestLogger); // Add logging middleware

// Routes
const notesRoutes = require('./routes/notes');
const userRoutes = require('./routes/users');

app.use('/api/notes', notesRoutes);  // Notes routes
app.use('/api/users', userRoutes);   // User routes

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
