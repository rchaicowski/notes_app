/**
 * @fileoverview Note validation middleware with content sanitization
 * Validates note content, title, and formatting with XSS prevention
 * @module middleware/validateRequest
 */

const { AppError } = require('./errorHandler');
const sanitizeHtml = require('sanitize-html');

// Configuration constants matching frontend limits
const MAX_TITLE_LENGTH = 30;       // Match NotesManager.maxTitleCharacters
const MAX_CONTENT_LENGTH = 700;    // Allow comfortable room (15 lines × ~46 chars)
const MAX_FORMATTING_ITEMS = 200;  // Max formatting objects per note
const MAX_FORMATTING_BYTES = 50 * 1024; // 50 KB max formatting payload

// Allowed formatting types for structured format
const ALLOWED_FORMATTING_TYPES = new Set([
    'bold', 'italic', 'underline', 'strike', 'link', 
    'color', 'highlight', 'heading', 'paragraph', 'list'
]);

/**
 * Sanitizes text content by removing HTML tags and dangerous patterns
 * 
 * @param {*} input - Input to sanitize
 * @returns {string} Sanitized text (empty string if invalid input)
 */
function sanitizeContent(input) {
    if (typeof input !== 'string') return '';
    // Strip all HTML tags and attributes
    return sanitizeHtml(input, { 
        allowedTags: [], 
        allowedAttributes: {} 
    })
    .replace(/javascript:/gi, '')  // Remove javascript: protocol
    .trim();
}

/**
 * Validates hex color format
 * 
 * @param {string} str - Color string to validate
 * @returns {boolean} True if valid hex color (#RGB or #RRGGBB)
 */
function isValidHexColor(str) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(str);
}

/**
 * Note validation middleware
 * 
 * Validates and sanitizes note data for POST and PUT requests:
 * - POST: content required
 * - PUT: at least one of title, content, or formatting required
 * - XSS prevention through HTML sanitization
 * - Size limit enforcement
 * - Formatting structure validation
 * 
 * Supports two formatting formats:
 * 1. Legacy: HTML snapshots per field/line
 * 2. Modern: Structured type/range/value objects
 * 
 * @middleware
 * @param {Object} req - Express request
 * @param {Object} req.body - Request body
 * @param {string} [req.body.title] - Note title (max 30 chars)
 * @param {string} [req.body.content] - Note content (max 525 chars)
 * @param {Array} [req.body.formatting] - Formatting array
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 * @throws {AppError} 400 - Validation errors
 * @throws {AppError} 413 - Payload too large
 */
const validateNote = (req, res, next) => {
    try {
        const method = (req.method || '').toUpperCase();
        const { title } = req.body;
        let { content, formatting } = req.body;

        // Check what fields are present
        const hasContent = typeof content !== 'undefined' && content !== null;
        const hasFormatting = typeof formatting !== 'undefined' && formatting !== null;
        const hasTitle = typeof title !== 'undefined' && title !== null;

        // POST requires content, PUT requires at least one field
        if (method === 'POST') {
            if (!hasContent) {
                throw new AppError('Note content is required', 400, 'CONTENT_REQUIRED');
            }
        } else if (method === 'PUT') {
            if (!hasContent && !hasFormatting && !hasTitle) {
                throw new AppError(
                    'At least one of title, content or formatting must be provided',
                    400,
                    'NO_UPDATE_FIELDS'
                );
            }
        }

        // Validate and sanitize title if present
        if (hasTitle) {
            if (typeof title !== 'string') {
                throw new AppError('Title must be text', 400, 'INVALID_TITLE_TYPE');
            }

            const sanitized = sanitizeContent(title);

            if (sanitized.length > MAX_TITLE_LENGTH) {
                throw new AppError(
                    `Title cannot exceed ${MAX_TITLE_LENGTH} characters`,
                    400,
                    'TITLE_TOO_LONG'
                );
            }

            req.body.title = sanitized;
        }

        // Validate and sanitize content if present
        if (hasContent) {
            if (typeof content !== 'string') {
                throw new AppError('Content must be text', 400, 'INVALID_CONTENT_TYPE');
            }

            const sanitized = sanitizeContent(content);

            if (sanitized.length === 0) {
                throw new AppError('Content cannot be empty', 400, 'CONTENT_EMPTY');
            }

            if (sanitized.length > MAX_CONTENT_LENGTH) {
                throw new AppError(
                    `Content cannot exceed ${MAX_CONTENT_LENGTH} characters`,
                    400,
                    'CONTENT_TOO_LONG'
                );
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
                    throw new AppError('Formatting must be valid JSON', 400, 'INVALID_JSON');
                }
            }

            if (!Array.isArray(formatting)) {
                throw new AppError('Formatting must be an array', 400, 'INVALID_FORMATTING_TYPE');
            }

            // Check byte size
            const bytes = Buffer.byteLength(JSON.stringify(formatting), 'utf8');
            if (bytes > MAX_FORMATTING_BYTES) {
                throw new AppError(
                    `Formatting payload too large (max ${MAX_FORMATTING_BYTES} bytes)`,
                    413,
                    'FORMATTING_TOO_LARGE'
                );
            }

            // Check item count
            if (formatting.length > MAX_FORMATTING_ITEMS) {
                throw new AppError(
                    `Too many formatting items (max ${MAX_FORMATTING_ITEMS})`,
                    413,
                    'TOO_MANY_FORMATTING_ITEMS'
                );
            }

            const contentLength = (req.body.content || '').length;

            // Detect format type: legacy (has 'field' property) or modern (has 'type' property)
            if (formatting.length > 0 && formatting[0] && typeof formatting[0].field === 'string') {
                // LEGACY FORMAT: HTML snapshots per field/line
                const allowedTags = ['strong', 'em', 'u', 'span', 'a', 'b', 'i', 'p', 'br'];
                const allowedAttributes = {
                    'span': ['class'],
                    'a': ['href', 'target', 'rel']
                };

                for (let i = 0; i < formatting.length; i++) {
                    const item = formatting[i];
                    
                    if (typeof item !== 'object' || item === null) {
                        throw new AppError(
                            `Formatting item at index ${i} must be an object`,
                            400,
                            'INVALID_FORMATTING_ITEM'
                        );
                    }

                    const { field, html, text, line } = item;

                    // Validate field
                    if (!field || (field !== 'title' && field !== 'content')) {
                        throw new AppError(
                            `Invalid formatting field at index ${i}`,
                            400,
                            'INVALID_FORMATTING_FIELD'
                        );
                    }

                    // Content items need line numbers
                    if (field === 'content') {
                        if (typeof line === 'undefined' || !Number.isInteger(line) || line < 0) {
                            throw new AppError(
                                `Formatting content item at index ${i} missing valid line number`,
                                400,
                                'MISSING_LINE_NUMBER'
                            );
                        }
                    }

                    // Sanitize HTML if present
                    if (typeof html === 'string' && html.trim().length > 0) {
                        const clean = sanitizeHtml(html, { allowedTags, allowedAttributes });
                        formatting[i].html = clean;
                    }

                    // Sanitize text if present
                    if (typeof text === 'string') {
                        formatting[i].text = sanitizeHtml(text, { 
                            allowedTags: [], 
                            allowedAttributes: {} 
                        });
                    }
                }

                req.body.formatting = formatting;

            } else {
                // MODERN FORMAT: Structured type/range/value
                for (let i = 0; i < formatting.length; i++) {
                    const item = formatting[i];
                    
                    if (typeof item !== 'object' || item === null) {
                        throw new AppError(
                            `Formatting item at index ${i} must be an object`,
                            400,
                            'INVALID_FORMATTING_ITEM'
                        );
                    }

                    const { type, range, value } = item;

                    // Validate type
                    if (!type || typeof type !== 'string' || !ALLOWED_FORMATTING_TYPES.has(type)) {
                        throw new AppError(
                            `Invalid formatting type at index ${i}`,
                            400,
                            'INVALID_FORMATTING_TYPE'
                        );
                    }

                    // Validate range
                    if (!Array.isArray(range) || range.length !== 2) {
                        throw new AppError(
                            `Formatting range at index ${i} must be an array of two numbers`,
                            400,
                            'INVALID_RANGE_FORMAT'
                        );
                    }

                    const [start, end] = range.map(Number);
                    
                    if (!Number.isInteger(start) || !Number.isInteger(end) || 
                        start < 0 || end <= start) {
                        throw new AppError(
                            `Invalid formatting range at index ${i}`,
                            400,
                            'INVALID_RANGE_VALUES'
                        );
                    }

                    // Validate range is within content
                    if (contentLength > 0 && end > contentLength) {
                        throw new AppError(
                            `Formatting range at index ${i} exceeds content length`,
                            400,
                            'RANGE_OUT_OF_BOUNDS'
                        );
                    }

                    // Validate value for specific types
                    if (type === 'color') {
                        if (typeof value !== 'string' || !isValidHexColor(value)) {
                            throw new AppError(
                                `Invalid color value at index ${i} (must be hex: #RGB or #RRGGBB)`,
                                400,
                                'INVALID_COLOR_VALUE'
                            );
                        }
                    } else if (type === 'link') {
                        if (typeof value !== 'string') {
                            throw new AppError(
                                `Invalid link value at index ${i}`,
                                400,
                                'INVALID_LINK_VALUE'
                            );
                        }
                        
                        // Validate URL and protocol
                        try {
                            const url = new URL(value);
                            if (!['http:', 'https:'].includes(url.protocol)) {
                                throw new AppError(
                                    `Invalid URL protocol at index ${i} (only http/https allowed)`,
                                    400,
                                    'INVALID_URL_PROTOCOL'
                                );
                            }
                        } catch (err) {
                            throw new AppError(
                                `Invalid URL in formatting at index ${i}`,
                                400,
                                'INVALID_URL'
                            );
                        }
                    } else {
                        // For other types, sanitize string values
                        if (typeof value === 'string') {
                            formatting[i].value = sanitizeHtml(value, { 
                                allowedTags: [], 
                                allowedAttributes: {} 
                            });
                        }
                    }
                }

                req.body.formatting = formatting;
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    validateNote
};
