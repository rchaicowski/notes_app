const { AppError } = require('./errorHandler');
const sanitizeHtml = require('sanitize-html');

// Validation middleware for notes
// - For POST requests: content (string) is required
// - For PUT requests: at least one of title, content or formatting must be provided
// - formatting (if provided) must be a JSON array with a limited size and well-formed items
const MAX_CONTENT_LENGTH = 1000; // characters after sanitization
const MAX_FORMATTING_ITEMS = 200;
const MAX_FORMATTING_BYTES = 50 * 1024; // 50 KB
const ALLOWED_FORMATTING_TYPES = new Set(['bold', 'italic', 'underline', 'strike', 'link', 'color', 'highlight', 'heading', 'paragraph', 'list']);

function sanitizeContent(input) {
    if (typeof input !== 'string') return '';
    // Use sanitize-html to strip any tags and attributes
    return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).replace(/javascript:/gi, '').trim();
}

function isValidHexColor(str) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(str);
}

// Validation middleware
const validateNote = (req, res, next) => {
    try {
        const method = (req.method || '').toUpperCase();
        const { title } = req.body;
        let { content, formatting } = req.body;

        // For POST, content is required; for PUT allow missing content if other updatable fields are present
        const hasContent = typeof content !== 'undefined' && content !== null;
        const hasFormatting = typeof formatting !== 'undefined' && formatting !== null;
        const hasTitle = typeof title !== 'undefined' && title !== null;

        if (method === 'POST') {
            if (!hasContent) throw new AppError('Note content is required', 400);
        } else if (method === 'PUT') {
            if (!hasContent && !hasFormatting && !hasTitle) {
                throw new AppError('At least one of title, content or formatting must be provided', 400);
            }
        }

        // Validate and sanitize content if present
        if (hasContent) {
            if (typeof content !== 'string') {
                throw new AppError('Note content must be text', 400);
            }

            const sanitized = sanitizeContent(content);

            if (sanitized.length === 0) {
                throw new AppError('Note content cannot be empty', 400);
            }

            if (sanitized.length > MAX_CONTENT_LENGTH) {
                throw new AppError(`Note content cannot exceed ${MAX_CONTENT_LENGTH} characters`, 400);
            }

            req.body.content = sanitized;
        }

        // Validate formatting if provided
        if (hasFormatting) {
            // Accept JSON string or object
            if (typeof formatting === 'string') {
                try {
                    formatting = JSON.parse(formatting);
                } catch (err) {
                    throw new AppError('Formatting must be valid JSON', 400);
                }
            }

            if (!Array.isArray(formatting)) {
                throw new AppError('Formatting must be an array', 400);
            }

            // Byte-size check
            const bytes = Buffer.byteLength(JSON.stringify(formatting), 'utf8');
            if (bytes > MAX_FORMATTING_BYTES) {
                throw new AppError(`Formatting payload too large (max ${MAX_FORMATTING_BYTES} bytes)`, 413);
            }

            if (formatting.length > MAX_FORMATTING_ITEMS) {
                throw new AppError(`Formatting contains too many items (max ${MAX_FORMATTING_ITEMS})`, 413);
            }

            // Determine which format the client sent. Older client uses [{ field, html, text, line }]
            // Newer structured format uses [{ type, range, value }, ...]
            const contentLength = (req.body.content || '').length;

            if (formatting.length > 0 && formatting[0] && typeof formatting[0].field === 'string') {
                // Client is sending HTML snapshots per field/line. Validate and sanitize HTML.
                const allowedTags = ['strong', 'em', 'u', 'span', 'a', 'b', 'i', 'p', 'br'];
                const allowedAttributes = {
                    'span': ['class'],
                    'a': ['href', 'target', 'rel']
                };

                for (let i = 0; i < formatting.length; i++) {
                    const item = formatting[i];
                    if (typeof item !== 'object' || item === null) {
                        throw new AppError(`Formatting item at index ${i} must be an object`, 400);
                    }

                    const { field, html, text, line } = item;
                    if (!field || (field !== 'title' && field !== 'content')) {
                        throw new AppError(`Invalid formatting field at index ${i}`, 400);
                    }

                    if (field === 'content') {
                        if (typeof line === 'undefined' || !Number.isInteger(line) || line < 0) {
                            throw new AppError(`Formatting content item at index ${i} missing valid line number`, 400);
                        }
                    }

                    if (typeof html === 'string' && html.trim().length > 0) {
                        // Sanitize HTML but allow basic formatting tags
                        const clean = sanitizeHtml(html, { allowedTags, allowedAttributes });
                        formatting[i].html = clean;
                    }

                    if (typeof text === 'string') {
                        formatting[i].text = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
                    }
                }

                req.body.formatting = formatting;
            } else {
                // Structured formatting (type/range/value) expected
                for (let i = 0; i < formatting.length; i++) {
                    const item = formatting[i];
                    if (typeof item !== 'object' || item === null) {
                        throw new AppError(`Formatting item at index ${i} must be an object`, 400);
                    }

                    const { type, range, value } = item;

                    if (!type || typeof type !== 'string' || !ALLOWED_FORMATTING_TYPES.has(type)) {
                        throw new AppError(`Invalid formatting type at index ${i}`, 400);
                    }

                    if (!Array.isArray(range) || range.length !== 2) {
                        throw new AppError(`Formatting range at index ${i} must be an array of two numbers`, 400);
                    }

                    const [start, end] = range.map(Number);
                    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) {
                        throw new AppError(`Invalid formatting range at index ${i}`, 400);
                    }

                    // If content length is known, validate against it
                    if (contentLength > 0 && end > contentLength) {
                        throw new AppError(`Formatting range at index ${i} exceeds content length`, 400);
                    }

                    // Validate value for certain types
                    if (type === 'color') {
                        if (typeof value !== 'string' || !isValidHexColor(value)) {
                            throw new AppError(`Invalid color value at index ${i}`, 400);
                        }
                    }

                    if (type === 'link') {
                        if (typeof value !== 'string') {
                            throw new AppError(`Invalid link value at index ${i}`, 400);
                        }
                        try {
                            const url = new URL(value);
                            if (!['http:', 'https:'].includes(url.protocol)) {
                                throw new AppError(`Invalid URL protocol in formatting at index ${i}`, 400);
                            }
                        } catch (err) {
                            throw new AppError(`Invalid URL in formatting at index ${i}`, 400);
                        }
                    } else {
                        // For other types, sanitize string values to remove any HTML
                        if (typeof value === 'string') {
                            formatting[i].value = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
                        }
                    }
                }

                req.body.formatting = formatting;
            }
        }

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
