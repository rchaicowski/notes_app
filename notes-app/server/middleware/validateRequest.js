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
            throw new AppError('Content is required', 400);
        }

        // Check content type
        if (typeof content !== 'string') {
            throw new AppError('Content must be text', 400);
        }

        // Check content length
        if (content.length > noteValidationRules.content.maxLength) {
            throw new AppError(`Content must be less than ${noteValidationRules.content.maxLength} characters`, 400);
        }

        if (content.trim().length < noteValidationRules.content.minLength) {
            throw new AppError('Content cannot be empty', 400);
        }

        // If all validation passes, sanitize the content
        req.body.content = content.trim();
        next();
    } catch (error) {
        error.name = 'ValidationError';
        next(error);
    }
};

module.exports = {
    validateNote
};
