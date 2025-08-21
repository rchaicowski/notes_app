const { AppError } = require('./errorHandler');

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

module.exports = { validateId };
