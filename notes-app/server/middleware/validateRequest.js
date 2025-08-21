const { AppError } = require('./errorHandler');

// Validation rules for notes
const noteValidationRules = {
    content: {
        required: true,
        minLength: 1,
        maxLength: 1000
    }
};

// Validation middleware
const validateNote = (req, res, next) => {
    try {
        const { content } = req.body;

        // Check if content exists
        if (!content) {
            throw new AppError('Note content is required', 400);
        }

        // Check content type
        if (typeof content !== 'string') {
            throw new AppError('Note content must be text', 400);
        }

        // Remove dangerous HTML/Script tags
        const sanitized = content
            .replace(/<[^>]*>/g, '')  // Remove HTML tags
            .replace(/javascript:/gi, ''); // Remove javascript: protocols

        // Check length after sanitization
        if (sanitized.trim().length === 0) {
            throw new AppError('Note content cannot be empty', 400);
        }

        if (sanitized.length > 1000) {
            throw new AppError('Note content cannot exceed 1000 characters', 400);
        }

        // Store sanitized content
        req.body.content = sanitized.trim();
        next();
    } catch (error) {
        error.name = 'ValidationError';
        next(error);
    }
};

const validateId = (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id) || id <= 0) {
            throw new AppError('Invalid note ID', 400);
        }

        req.params.id = id;
        next();
    } catch (error) {
        error.name = 'ValidationError';
        next(error);
    }
};

module.exports = {
    validateNote
};
