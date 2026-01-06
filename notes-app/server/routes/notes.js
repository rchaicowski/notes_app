/**
 * @fileoverview Notes routes - handles CRUD operations for user notes
 * All routes require authentication and user ownership verification
 * @module routes/notes
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { validateNote } = require('../middleware/validateRequest');
const { validateId } = require('../middleware/validateId');
const { validateQueryParams, validateHeaders } = require('../middleware/validateCommon');
const { AppError } = require('../middleware/errorHandler');
const { limiter, strictLimiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');

/**
 * Middleware: Ensures the authenticated user still exists in the database
 * 
 * This prevents operations with deleted user accounts. Since users can delete
 * their account while logged in, their JWT token may still be valid after
 * deletion. This middleware catches that scenario and returns a clear error.
 * 
 * Without this check, deleted users could:
 * - Create notes with non-existent user_id (foreign key violation)
 * - Receive empty results instead of proper error messages
 * 
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} req.user - User object from auth middleware
 * @param {number} req.user.id - User ID from decoded JWT
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @throws {401} If user is not authenticated or doesn't exist in database
 */
const ensureUserExists = async (req, res, next) => {
    try {
        // Check if auth middleware provided user
        if (!req.user || !req.user.id) {
            throw new AppError('Authentication required', 401);
        }
        
        // Verify user still exists in database
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.id]);
        
        if (userCheck.rowCount === 0) {
            throw new AppError('User account no longer exists', 401);
        }
        
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/notes
 * Retrieves all notes for the authenticated user
 * 
 * Returns notes ordered by creation date (newest first).
 * Note: Currently returns all notes without pagination. For large note collections,
 * consider implementing pagination with LIMIT/OFFSET or cursor-based pagination.
 * 
 * @route GET /api/notes
 * @access Private - Requires authentication
 * @middleware auth - Validates JWT token
 * @middleware ensureUserExists - Verifies user exists in database
 * @middleware limiter - Rate limiting (100 req/15min)
 * @middleware validateQueryParams - Validates query string parameters
 * @returns {Array<Object>} 200 - Array of note objects
 * @returns {Object} 401 - Authentication error
 * @returns {Object} 500 - Server error
 * @example
 * // Response:
 * [
 *   {
 *     id: 1,
 *     title: "My Note",
 *     content: "Note content",
 *     formatting: [...],
 *     created_at: "2025-01-07T10:00:00Z",
 *     updated_at: "2025-01-07T10:00:00Z",
 *     user_id: 42
 *   }
 * ]
 */
router.get('/', auth, ensureUserExists, limiter, validateQueryParams, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT id, title, content, formatting, created_at, updated_at, user_id FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/notes
 * Creates a new note for the authenticated user
 * 
 * @route POST /api/notes
 * @access Private - Requires authentication
 * @middleware auth - Validates JWT token
 * @middleware ensureUserExists - Verifies user exists in database
 * @middleware strictLimiter - Strict rate limiting (10 req/15min)
 * @middleware validateHeaders - Validates request headers
 * @middleware validateNote - Validates note content and format
 * @param {Object} req.body - Note data
 * @param {string} [req.body.title] - Note title (defaults to "Untitled")
 * @param {string} req.body.content - Note content (required)
 * @param {Array<Object>} [req.body.formatting] - Formatting metadata (defaults to [])
 * @returns {Object} 201 - Created note object
 * @returns {Object} 400 - Validation error
 * @returns {Object} 401 - Authentication error
 * @returns {Object} 500 - Server error
 * @example
 * // Request body:
 * {
 *   "title": "My New Note",
 *   "content": "This is the note content",
 *   "formatting": [{"type": "bold", "start": 0, "end": 6}]
 * }
 * 
 * // Response (201):
 * {
 *   "id": 123,
 *   "title": "My New Note",
 *   "content": "This is the note content",
 *   "formatting": [...],
 *   "created_at": "2025-01-07T10:00:00Z",
 *   "updated_at": "2025-01-07T10:00:00Z",
 *   "user_id": 42
 * }
 */
router.post('/', auth, ensureUserExists, strictLimiter, validateHeaders, validateNote, async (req, res, next) => {
    try {
        // Sanitize and default values
        const title = (req.body.title && typeof req.body.title === 'string') 
            ? req.body.title.trim() 
            : 'Untitled';
        const formatting = req.body.formatting || [];

        const result = await pool.query(
            'INSERT INTO notes (title, content, formatting, created_at, updated_at, user_id) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4) RETURNING *',
            [title, req.body.content, JSON.stringify(formatting), req.user.id]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/notes/:id
 * Retrieves a specific note by ID
 * 
 * Only returns notes owned by the authenticated user.
 * 
 * @route GET /api/notes/:id
 * @access Private - Requires authentication
 * @middleware auth - Validates JWT token
 * @middleware ensureUserExists - Verifies user exists in database
 * @middleware validateId - Validates note ID parameter
 * @param {string} req.params.id - Note ID
 * @returns {Object} 200 - Note object with full details
 * @returns {Object} 401 - Authentication error
 * @returns {Object} 404 - Note not found or not owned by user
 * @returns {Object} 500 - Server error
 * @example
 * // GET /api/notes/123
 * // Response (200):
 * {
 *   "id": 123,
 *   "title": "My Note",
 *   "content": "Full note content",
 *   "formatting": [...],
 *   "created_at": "2025-01-07T10:00:00Z",
 *   "updated_at": "2025-01-07T10:30:00Z",
 *   "user_id": 42
 * }
 */
router.get('/:id', auth, ensureUserExists, validateId, async (req, res, next) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM notes WHERE id = $1 AND user_id = $2', 
            [id, req.user.id]
        );

        if (result.rowCount === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/notes/:id
 * Updates an existing note
 * 
 * Supports partial updates - only provided fields are updated.
 * At least one field (title, content, or formatting) must be provided.
 * The updated_at timestamp is automatically updated.
 * 
 * @route PUT /api/notes/:id
 * @access Private - Requires authentication
 * @middleware auth - Validates JWT token
 * @middleware ensureUserExists - Verifies user exists in database
 * @middleware strictLimiter - Strict rate limiting (10 req/15min)
 * @middleware validateHeaders - Validates request headers
 * @middleware validateId - Validates note ID parameter
 * @middleware validateNote - Validates note content and format
 * @param {string} req.params.id - Note ID
 * @param {Object} req.body - Fields to update
 * @param {string} [req.body.title] - Updated title
 * @param {string} [req.body.content] - Updated content
 * @param {Array<Object>} [req.body.formatting] - Updated formatting
 * @returns {Object} 200 - Updated note object
 * @returns {Object} 400 - Validation error or no fields provided
 * @returns {Object} 401 - Authentication error
 * @returns {Object} 404 - Note not found or not owned by user
 * @returns {Object} 500 - Server error
 * @example
 * // PATCH /api/notes/123
 * // Request body (partial update):
 * {
 *   "title": "Updated Title"
 * }
 * 
 * // Response (200):
 * {
 *   "id": 123,
 *   "title": "Updated Title",
 *   "content": "Original content unchanged",
 *   "formatting": [...],
 *   "created_at": "2025-01-07T10:00:00Z",
 *   "updated_at": "2025-01-07T11:00:00Z",
 *   "user_id": 42
 * }
 */
router.put('/:id', auth, ensureUserExists, strictLimiter, validateHeaders, validateId, validateNote, async (req, res, next) => {
    const { id } = req.params;
    
    try {
        // Sanitize inputs
        const title = (req.body.title && typeof req.body.title === 'string') 
            ? req.body.title.trim() 
            : undefined;
        const formatting = req.body.formatting;

        // Build dynamic query for partial updates
        const fields = [];
        const values = [];
        let idx = 1;

        if (typeof title !== 'undefined') {
            fields.push(`title = $${idx++}`);
            values.push(title);
        }

        if (typeof req.body.content !== 'undefined') {
            fields.push(`content = $${idx++}`);
            values.push(req.body.content);
        }

        if (typeof formatting !== 'undefined') {
            fields.push(`formatting = $${idx++}::jsonb`);
            values.push(JSON.stringify(formatting));
        }

        // Check if any meaningful fields were provided BEFORE adding updated_at
        if (fields.length === 0) {
            throw new AppError('No valid fields provided for update', 400);
        }

        // Always update the timestamp
        fields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Complete the query
        const query = `UPDATE notes SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`;
        values.push(id, req.user.id);

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/notes/:id
 * Deletes a specific note
 * 
 * Permanently deletes the note. This action cannot be undone.
 * Only notes owned by the authenticated user can be deleted.
 * 
 * @route DELETE /api/notes/:id
 * @access Private - Requires authentication
 * @middleware auth - Validates JWT token
 * @middleware ensureUserExists - Verifies user exists in database
 * @middleware strictLimiter - Strict rate limiting (10 req/15min)
 * @middleware validateId - Validates note ID parameter
 * @param {string} req.params.id - Note ID to delete
 * @returns {Object} 200 - Success message with deleted note data
 * @returns {Object} 401 - Authentication error
 * @returns {Object} 404 - Note not found or not owned by user
 * @returns {Object} 500 - Server error
 * @example
 * // DELETE /api/notes/123
 * // Response (200):
 * {
 *   "message": "Note deleted",
 *   "note": {
 *     "id": 123,
 *     "title": "Deleted Note",
 *     "content": "...",
 *     "user_id": 42
 *   }
 * }
 */
router.delete('/:id', auth, ensureUserExists, strictLimiter, validateId, async (req, res, next) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING *', 
            [id, req.user.id]
        );

        if (result.rowCount === 0) {
            throw new AppError('Note not found', 404);
        }

        res.json({ message: 'Note deleted', note: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
