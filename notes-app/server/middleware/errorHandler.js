// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('🔴 Error:', err.message);

    // Different error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid input data',
            details: err.message
        });
    }

    if (err.name === 'DatabaseError') {
        return res.status(503).json({
            status: 'error',
            message: 'Database error',
            details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }

    // Default error
    res.status(err.status || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
};

// Custom error class
class AppError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { errorHandler, AppError };
