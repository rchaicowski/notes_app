/**
 * @fileoverview Notes management system for the application
 * Handles CRUD operations, pagination, formatting, offline/online sync
 * Supports edit/delete modes, character limits, and multi-line note editing
 * @module notesManager
 */

import { getAuthToken, isAuthenticated } from './auth.js';
import { FormattingManager } from './formattingManager.js';

/**
 * Manages note creation, retrieval, update, and deletion
 * Supports both online (API) and offline (localStorage) modes
 * Handles note display with pagination, formatting, and user interactions
 * Manages edit/delete mode state and keyboard accessibility
 */
export class NotesManager {
  /**
   * Creates a new NotesManager instance
   * Initializes API configuration, storage, and event listeners
   * Sets up offline mode detection and auth state synchronization
   * 
   * @param {SoundManager} soundManager - Sound manager for audio feedback
   * @param {StorageManager} storageManager - Local storage manager for offline data
   */
  constructor(soundManager, storageManager) {
    /** @type {Array<Object>} Array of note objects loaded from API or storage */
    this.notes = [];
    
    /** @type {number} Current page number for pagination (1-indexed) */
    this.currentPage = 1;
    
    /** @type {number} Number of notes displayed per page */
    this.notesPerPage = 15;
    
    /** @type {boolean} Whether edit mode is currently active */
    this.isEditMode = false;
    
    /** @type {boolean} Whether delete mode is currently active */
    this.isDeleteMode = false;
    
    /** @type {string} Base URL for API endpoints */
    this.apiBaseUrl = 'http://localhost:5000/api/notes';
    
    /** @type {SoundManager} Sound manager for audio feedback */
    this.soundManager = soundManager;
    
    /** @type {StorageManager} Local storage manager for offline data */
    this.storageManager = storageManager;
    
    /** @type {number} Maximum characters per note line (character limit) */
    this.maxCharacters = 35;
    
    /** @type {number} Maximum characters for note title */
    this.maxTitleCharacters = 30;
    
    /** @type {number} Maximum lines per note in detail view */
    this.maxLinesPerNote = 15;
    
    /** @type {boolean} Whether app is in offline mode */
    this.isOffline = localStorage.getItem('offlineMode') === 'true';
    
    /** @type {string} Current view mode: 'index' (list) or 'note' (detail) */
    this.currentView = 'index';
    
    /** @type {number|null} Currently open note ID in detail view, null if none */
    this.currentNoteId = null;
    
    /** @type {FormattingManager} Formatting manager for rich text support */
    this.formattingManager = new FormattingManager(soundManager);

    /** @type {boolean} Whether currently editing a new unsaved note */
    this.isNewNote = false;

    // Bind click handler once for proper event listener cleanup
    this.boundHandleNoteClick = this.handleNoteClickEvent.bind(this);

    // Bind event handlers to preserve 'this' context and enable cleanup
    this.handleOfflineModeChange = this.handleOfflineModeChange.bind(this);
    this.handleAuthChange = this.handleAuthChange.bind(this);

    setTimeout(() => {
      const indexInput = document.getElementById('content');
      if (indexInput) {
        indexInput.setAttribute('maxlength', this.maxTitleCharacters);
      }
    }, 100);

    window.addEventListener('offline-mode-changed', this.handleOfflineModeChange);
    window.addEventListener('auth-changed', this.handleAuthChange);

    this.initializeKeyboardSupport();
  }

  /**
   * Initialize keyboard support for edit/delete mode buttons
   * Allows Enter/Space to activate edit and delete mode buttons
   * Sets up keydown event listeners for accessibility
   * @returns {void}
   */
  initializeKeyboardSupport() {
    const editBtn = document.getElementById('editModeBtn');
    const deleteBtn = document.getElementById('deleteModeBtn');

    editBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleEditMode();
      }
    });

    deleteBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleDeleteMode();
      }
    });
  }

  /**
   * Handles offline mode change events
   * Updates offline state and reloads notes
   * @param {CustomEvent} event - Event with isOffline detail
   * @returns {void}
   */
  handleOfflineModeChange(event) {
    this.isOffline = event.detail.isOffline;
    this.loadNotes();
  }

  /**
   * Handles authentication state change events
   * Reloads notes if authenticated, clears notes if logged out
   * @param {CustomEvent} event - Event with isAuthenticated detail
   * @returns {void}
   */
  handleAuthChange(event) {
    if (event.detail.isAuthenticated) {
      this.loadNotes();
    } else {
      this.notes = [];
      this.renderNotes();
    }
  }

  /**
   * Cleans up event listeners and resources
   * Should be called when NotesManager instance is no longer needed
   * Prevents memory leaks from window event listeners
   * @returns {void}
   */
  destroy() {
    window.removeEventListener('offline-mode-changed', this.handleOfflineModeChange);
    window.removeEventListener('auth-changed', this.handleAuthChange);
    
    // Remove note list click handler if it exists
    const list = document.getElementById('notesList');
    if (list && this.boundHandleNoteClick) {
      list.removeEventListener('click', this.boundHandleNoteClick);
    }
  }

  /**
   * Constructs HTTP headers for authenticated API requests
   * Includes Content-Type and Bearer token authorization
   * 
   * @returns {Object<string, string>} Headers object with auth token
   */
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    };
  }

  /**
   * Loads notes from API or fallback to local storage
   * Checks authentication and offline mode before fetching
   * Falls back to localStorage if API fails or user is offline
   * 
   * @async
   * @returns {Promise<void>}
   */
  async loadNotes() {
    if (this.isOffline) {
      this.fallbackToLocalNotes();
      return;
    }

    if (!isAuthenticated()) {
      this.fallbackToLocalNotes();
      return;
    }

    try {
      const response = await fetch(this.apiBaseUrl, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.fallbackToLocalNotes();
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.notes = await response.json();
      this.renderNotes();
    } catch (error) {
      console.error('Error loading notes:', error);
      this.fallbackToLocalNotes();
    }
  }

  /**
   * Falls back to loading notes from localStorage
   * Transforms legacy note format (single content field) to new format (separate title/content)
   * Used when API is unavailable or user is in offline mode
   * Updates notes array and renders the list
   * @returns {void}
   */
  fallbackToLocalNotes() {
    const localNotes = this.storageManager.getFromLocalStorage();
    this.notes = localNotes.map(note => {
      if (note.title === undefined) {
        const content = note.content || '';
        const lines = content.split('\n');
        return {
          ...note,
          title: lines[0]?.substring(0, 35) || 'Untitled',
          content: lines.slice(1).join('\n') || ''
        };
      }
      return note;
    });
    this.renderNotes();
  }

  /**
   * Saves a note to API or localStorage
   * Persists title, content, and formatting information
   * Creates new note or updates existing based on isUpdate flag
   * 
   * @async
   * @param {Object} noteData - Note content object
   * @param {string} noteData.title - Note title (max 30 chars)
   * @param {string} noteData.content - Note content
   * @param {Array<Object>} noteData.formatting - Formatting metadata
   * @param {boolean} [isUpdate=false] - Whether this is an update vs create
   * @param {number|null} [noteId=null] - Note ID for updates
   * @returns {Promise<Object>} Saved note object with ID and timestamps
   * @throws {Error} If save fails and user is authenticated online
   */
  async saveNote(noteData, isUpdate = false, noteId = null) {
    if (this.isOffline) {
      const note = {
        id: isUpdate ? noteId : Date.now(),
        title: noteData.title || 'Untitled',
        content: noteData.content || '',
        formatting: noteData.formatting || [],
        created_at: isUpdate ? (this.notes.find(n => n.id === noteId)?.created_at || new Date().toISOString()) : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const allNotes = this.storageManager.getFromLocalStorage();
      if (isUpdate) {
        const index = allNotes.findIndex(n => n.id === noteId);
        if (index !== -1) {
          allNotes[index] = note;
        }
      } else {
        allNotes.push(note);
      }
      localStorage.setItem('notes', JSON.stringify(allNotes));
      return note;
    }

    if (!isAuthenticated()) {
      throw new Error('Please log in to save notes online');
    }

    try {
      const options = {
        method: isUpdate ? 'PUT' : 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          title: noteData.title || 'Untitled',
          content: noteData.content || '',
          formatting: noteData.formatting || []
        })
      };
      const url = isUpdate ? `${this.apiBaseUrl}/${noteId}` : this.apiBaseUrl;
      const response = await fetch(url, options);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to save notes online');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
    }
  }

  /**
   * Deletes a note from API or localStorage
   * Removes note by ID from current notes array
   * 
   * @async
   * @param {number} noteId - ID of note to delete
   * @returns {Promise<Object>} Response object with success status
   * @throws {Error} If deletion fails while authenticated
   */
  async deleteNote(noteId) {
    if (this.isOffline) {
      const allNotes = this.storageManager.getFromLocalStorage();
      const filteredNotes = allNotes.filter(n => n.id !== noteId);
      localStorage.setItem('notes', JSON.stringify(filteredNotes));
      return { success: true };
    }

    if (!isAuthenticated()) {
      throw new Error('Please log in to delete notes online');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/${noteId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to delete notes online');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  /**
   * Opens and displays a single note in detail view
   * Finds note by ID and renders its full content with formatting
   * Switches current view to 'note' and sets currentNoteId
   * 
   * @param {number} noteId - ID of note to display
   * @returns {void}
   */
  showNote(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;

    this.currentView = 'note';
    this.currentNoteId = noteId;
    this.renderNoteView(note);
  }

  /**
   * Returns to index (list) view from note detail view
   * Closes formatting toolbar, clears current note, and rerenders list
   * Resets view state and shows form/pagination elements
   * @returns {void}
   */
  showIndex() {
    this.currentView = 'index';
    this.currentNoteId = null;

    this.formattingManager.toggleToolbar(false);
    document.getElementById('editModeBtn').classList.remove('active');

    const form = document.getElementById('noteForm');
    const pagination = document.querySelector('.page-navigation');
    if (form) form.style.display = 'flex';
    if (pagination) pagination.style.display = 'flex';

    this.renderNotes();
  }

  /**
   * Creates a new blank note and opens it in detail view
   * Pre-fills title from index input if available
   * Switches to note edit view for user to enter content
   * Clears the index input field after reading its value
   * @returns {void}
   */
  createNewNote() {
    const contentInput = document.getElementById('content');
    const inputValue = contentInput ? contentInput.value.trim() : '';

    const newNote = {
      id: null,
      title: inputValue || '',
      content: '',
      formatting: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (contentInput) {
      contentInput.value = '';
    }

    this.currentView = 'note';
    this.currentNoteId = null;
    this.renderNoteView(newNote, true);
  }

  /**
   * Renders a single note in detail view with editable title and content lines
   * Creates contentEditable elements for title and content with character limits
   * Sets up event listeners for input validation, navigation, and formatting
   * Shows action buttons (Back to Index, Save Note) and initializes formatting toolbar
   * 
   * @param {Object} note - Note object to render
   * @param {number|null} note.id - Note ID (null for new notes)
   * @param {string} note.title - Note title
   * @param {string} note.content - Note content (multi-line)
   * @param {Array<Object>} [note.formatting] - Formatting metadata
   * @param {boolean} [isNew=false] - Whether this is a new unsaved note
   * @returns {void}
   */
  renderNoteView(note, isNew = false) {
    const form = document.getElementById('noteForm');
    const pagination = document.querySelector('.page-navigation');
    if (form) form.style.display = 'none';
    if (pagination) pagination.style.display = 'none';

    this.isNewNote = isNew;

    const list = document.getElementById('notesList');
    list.innerHTML = '';

    const noteContainer = document.createElement('div');
    noteContainer.className = 'note-view';

    const titleLine = document.createElement('div');
    titleLine.className = 'note-line title-line';
    
    const titleDiv = document.createElement('div');
    titleDiv.id = 'note-title';
    titleDiv.className = 'note-title-editable';
    titleDiv.contentEditable = 'true';
    titleDiv.setAttribute('data-placeholder', 'Note Title');
    titleDiv.textContent = note.title || '';
    
    titleLine.appendChild(titleDiv);
    noteContainer.appendChild(titleLine);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'note-content-container';

    const contentLines = note.content ? note.content.split('\n') : [];
    for (let i = 0; i < this.maxLinesPerNote; i++) {
      const line = document.createElement('div');
      line.className = 'note-line content-line';
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'note-content-line';
      contentDiv.contentEditable = 'true';
      contentDiv.setAttribute('data-line', i);
      if (i === 0) {
        contentDiv.setAttribute('data-placeholder', 'Start writing...');
      }
      contentDiv.textContent = contentLines[i] || '';
      
      line.appendChild(contentDiv);
      contentContainer.appendChild(line);
    }

    noteContainer.appendChild(contentContainer);

    const actionButtons = document.createElement('div');
    actionButtons.className = 'note-actions';
    actionButtons.innerHTML = `
      <button id="back-to-index" class="note-action-btn">← Back to Index</button>
      <button id="save-note" class="note-action-btn save-btn">Save Note</button>
    `;
    noteContainer.appendChild(actionButtons);

    list.appendChild(noteContainer);

    setTimeout(() => {
      this.formattingManager.initializeToolbar();
      if (note.formatting) {
        this.formattingManager.applyFormattingToNote(noteContainer, note.formatting);
      }
    }, 100);

    document.getElementById('back-to-index').addEventListener('click', () => {
      this.showIndex();
    });

    document.getElementById('save-note').addEventListener('click', () => {
      this.saveCurrentNote();
    });

    const contentDivs = document.querySelectorAll('.note-content-line');
    const titleDivElement = document.getElementById('note-title');

    contentDivs.forEach((div, index) => {
      div.addEventListener('input', (e) => {
        const text = div.textContent;
        if (text.length > this.maxCharacters) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const cursorPos = range.startOffset;
            div.textContent = text.substring(0, this.maxCharacters);
            
            const newRange = document.createRange();
            const textNode = div.firstChild;
            if (textNode) {
              newRange.setStart(textNode, Math.min(cursorPos, this.maxCharacters));
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          } else {
            // Fallback if no selection
            div.textContent = text.substring(0, this.maxCharacters);
          }
        } else if (text.length === this.maxCharacters && index < contentDivs.length - 1) {
          setTimeout(() => {
            contentDivs[index + 1].focus();
          }, 10);
        }
      });

      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (index < contentDivs.length - 1) {
            contentDivs[index + 1].focus();
          }
        } else if (e.key === 'Backspace') {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (range.startOffset === 0 && div.textContent.length === 0 && index > 0) {
              e.preventDefault();
              const prevDiv = contentDivs[index - 1];
              prevDiv.focus();
              const newRange = document.createRange();
              newRange.selectNodeContents(prevDiv);
              newRange.collapse(false);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
        }
      });
    });

    titleDivElement.addEventListener('input', (e) => {
      const text = titleDivElement.textContent;
      if (text.length > this.maxTitleCharacters) {
        e.preventDefault();
        titleDivElement.textContent = text.substring(0, this.maxTitleCharacters);
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(titleDivElement);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });

    titleDivElement.addEventListener('keydown', (e) => {
      const text = titleDivElement.textContent;
      
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstContentLine = document.querySelector('.note-content-line');
        if (firstContentLine) {
          firstContentLine.focus();
        }
      } else if (text.length >= this.maxTitleCharacters && 
                 e.key.length === 1 && 
                 !e.ctrlKey && 
                 !e.metaKey) {
        const selection = window.getSelection();
        if (selection && selection.isCollapsed) {
          e.preventDefault();
        }
      }
    });
    if (isNew) {
      titleDivElement.focus();
    } else {
      const firstEmptyLine = Array.from(contentDivs).find(div => !div.textContent.trim());
      if (firstEmptyLine) {
        firstEmptyLine.focus();
      } else {
        contentDivs[0].focus();
      }
    }
  }

  /**
   * Checks if any content lines have text
   * Used to determine if note has content before saving
   * 
   * @returns {boolean} True if any content line has non-whitespace text
   * @deprecated This method appears unused in current implementation
   */
  hasContentInLines() {
    const contentInputs = document.querySelectorAll('.note-content-line');
    return Array.from(contentInputs).some(input => input.value.trim());
  }

  /**
   * Saves the currently open note in detail view
   * Extracts title and content from editable elements
   * Collects formatting metadata and persists to API or localStorage
   * Creates new note or updates existing based on isNewNote flag
   * Provides visual feedback on successful save
   * 
   * @async
   * @returns {Promise<void>}
   */
  async saveCurrentNote() {
    const titleDiv = document.getElementById('note-title');
    const contentDivs = document.querySelectorAll('.note-content-line');

    if (!titleDiv) return;

    const title = titleDiv.textContent.trim() || 'Untitled';
    const contentLines = Array.from(contentDivs).map(div => div.textContent);
    const content = contentLines.join('\n').replace(/\n+$/, '');
    const noteView = document.querySelector('.note-view');
    const formatting = this.formattingManager.getFormattingForNote(noteView);

    try {
      let savedNote;
      if (this.isNewNote || this.currentNoteId === null) {
        savedNote = await this.saveNote({ title, content, formatting });
        this.notes.push(savedNote);
        this.currentNoteId = savedNote.id;
        this.isNewNote = false;
      } else {
        savedNote = await this.saveNote({ title, content, formatting }, true, this.currentNoteId);
        const index = this.notes.findIndex(n => n.id === this.currentNoteId);
        if (index !== -1) {
          this.notes[index] = savedNote;
        }
      }

      this.soundManager.play('pencil', 200);

      const saveBtn = document.getElementById('save-note');
      if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.opacity = '0.7';
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.opacity = '1';
        }, 1000);
      }

    } catch (error) {
      console.error('Failed to save note:', error);
      alert(error.message || 'Failed to save note.');
    }
  }

  /**
   * Toggles edit mode on/off
   * In note view: shows/hides formatting toolbar
   * In index view: highlights notes for editing (click to open)
   * Updates button states and plays audio feedback
   * @returns {void}
   */
  toggleEditMode() {
    if (this.currentView === 'note') {
      this.soundManager.play('pencil', 200);
      this.formattingManager.toggleToolbar(!this.formattingManager.isToolbarOpen);
      const editBtn = document.getElementById('editModeBtn');
      if (this.formattingManager.isToolbarOpen) {
        editBtn.classList.add('active');
      } else {
        editBtn.classList.remove('active');
      }
      return;
    }
    this.soundManager.play('pencil', 200);
    this.isEditMode ? this.exitModes() : this.enterEditMode();
  }

  /**
   * Toggles delete mode on/off
   * Highlights notes for deletion (click to delete)
   * Only works in index view
   * Updates button states and plays audio feedback
   * @returns {void}
   */
  toggleDeleteMode() {
    if (this.currentView === 'note') return;
    this.soundManager.play('eraser', 200);
    this.isDeleteMode ? this.exitModes() : this.enterDeleteMode();
  }

  /**
   * Activates edit mode
   * Highlights all notes with edit styling
   * Updates button ARIA state and visual indicators
   * Exits any other active modes first
   * @returns {void}
   */
  enterEditMode() {
    this.exitModes();
    this.isEditMode = true;
    const editBtn = document.getElementById('editModeBtn');
    editBtn?.setAttribute('aria-pressed', 'true');
    
    editBtn?.classList.add('active');
    document.body.classList.add('edit-mode');
    this.highlightNotes('edit');
  }

  /**
   * Activates delete mode
   * Highlights all notes with delete styling
   * Updates button ARIA state and visual indicators
   * Exits any other active modes first
   * @returns {void}
   */
  enterDeleteMode() {
    this.exitModes();
    this.isDeleteMode = true;
    const deleteBtn = document.getElementById('deleteModeBtn');
    deleteBtn?.setAttribute('aria-pressed', 'true');
    
    deleteBtn?.classList.add('active');
    document.body.classList.add('delete-mode');
    this.highlightNotes('delete');
  }

  /**
   * Deactivates edit and delete modes
   * Removes highlighting and button active states
   * Closes formatting toolbar if open in note view
   * Resets ARIA attributes for accessibility
   * @returns {void}
   */
  exitModes() {
    this.isEditMode = this.isDeleteMode = false;
    const editBtn = document.getElementById('editModeBtn');
    const deleteBtn = document.getElementById('deleteModeBtn');
    editBtn?.setAttribute('aria-pressed', 'false');
    deleteBtn?.setAttribute('aria-pressed', 'false');
    
    editBtn?.classList.remove('active');
    deleteBtn?.classList.remove('active');
    document.body.classList.remove('edit-mode', 'delete-mode');
    this.removeHighlights();
    if (this.currentView === 'note') {
      this.formattingManager.toggleToolbar(false);
    }
  }

  /**
   * Adds visual highlighting to all notes for a specific mode
   * Applies CSS classes for visual feedback and changes cursor style
   * 
   * @param {string} mode - Mode type: 'edit' or 'delete'
   * @returns {void}
   */
  highlightNotes(mode) {
    const currentPageElement = document.getElementById(`page-${this.currentPage}`);
    if (currentPageElement) {
      currentPageElement.querySelectorAll('li').forEach(note => {
        note.classList.add(`highlight-${mode}`);
        note.style.cursor = 'pointer';
      });
    }
  }

  /**
   * Removes edit/delete highlighting from all notes
   * Restores default cursor style
   * Cleans up visual indicators from mode operations
   * @returns {void}
   */
  removeHighlights() {
    document.querySelectorAll('#notesList li').forEach(note => {
      note.classList.remove('highlight-edit', 'highlight-delete');
      note.style.cursor = 'default';
    });
  }

  /**
   * Handles click events on note list items
   * Routes to appropriate action based on current mode (edit/delete/view)
   * Bound in constructor to enable proper event listener cleanup
   * 
   * @param {MouseEvent} e - Click event
   * @returns {void}
   */
  handleNoteClickEvent(e) {
    const li = e.target.closest('li');
    if (!li) return;

    if (this.isEditMode) {
      const noteId = parseInt(li.dataset.noteId);
      this.showNote(noteId);
      this.exitModes();
    } else if (this.isDeleteMode) {
      this.deleteNoteById(parseInt(li.dataset.id));
      this.exitModes();
    } else {
      const noteId = parseInt(li.dataset.noteId);
      this.showNote(noteId);
    }
  }

  /**
   * Renders the list of notes for the current page
   * Handles note item creation, click handlers, and formatting application
   * Supports formatted text rendering in note list
   * Sets up event delegation for note interactions based on current mode
   * Updates pagination info after rendering
   * @returns {void}
   */
  renderNotes() {
    if (this.currentView === 'note') return;

    const list = document.getElementById('notesList');
    list.innerHTML = '';

    const pageDiv = document.createElement('div');
    pageDiv.className = 'notes-page active';
    pageDiv.id = `page-${this.currentPage}`;

    this.getNotesForPage(this.currentPage).forEach((note, i) => {
      const li = document.createElement('li');
      li.dataset.id = (this.currentPage - 1) * this.notesPerPage + i;
      li.dataset.page = this.currentPage;
      li.dataset.noteId = note.id;
      const titleFormatting = note.formatting?.find(f => f.field === 'title')?.formats || [];
      const formattedTitle = this.formattingManager.renderFormattedText(note.title, titleFormatting);
      li.innerHTML = `<div class="note-content">${formattedTitle}</div>`;
      
      pageDiv.appendChild(li);
    });

    list.appendChild(pageDiv);

    // Use the bound handler stored in constructor
    list.removeEventListener('click', this.boundHandleNoteClick);
    list.addEventListener('click', this.boundHandleNoteClick);

    this.updatePageInfo();
    if (this.isEditMode) this.highlightNotes('edit');
    else if (this.isDeleteMode) this.highlightNotes('delete');
  }

  /**
   * Calculates total number of pages based on note count
   * 
   * @returns {number} Total page count (minimum 0)
   */
  getTotalPages() {
    return Math.ceil(this.notes.length / this.notesPerPage);
  }

  /**
   * Gets array of notes for a specific page
   * Slices notes array based on pagination settings
   * 
   * @param {number} page - Page number (1-indexed)
   * @returns {Array<Object>} Notes for the specified page
   */
  getNotesForPage(page) {
    return this.notes.slice((page - 1) * this.notesPerPage, page * this.notesPerPage);
  }

  /**
   * Updates pagination info display and button states
   * Shows current page number and total pages
   * Disables prev/next buttons at boundaries
   * Handles internationalization if language controller is available
   * Adjusts current page if it exceeds total pages
   * @returns {void}
   */
  updatePageInfo() {
    const totalPages = this.getTotalPages();
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (!pageInfo || !prevBtn || !nextBtn) return;

    if (totalPages === 0) {
      if (window.app?.languageController) {
        const noPages = window.app.languageController.getTranslation('page.noPages') || 'No pages';
        pageInfo.textContent = noPages;
      } else {
        pageInfo.textContent = 'No pages';
      }
      prevBtn.disabled = nextBtn.disabled = true;
      return;
    }

    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    if (window.app?.languageController) {
      const template = window.app.languageController.getTranslation('page.info');
      pageInfo.textContent = template.replace('{current}', this.currentPage).replace('{total}', totalPages);
    } else {
      pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }

    prevBtn.disabled = this.currentPage === 1;
    nextBtn.disabled = this.currentPage === totalPages;
    this.totalPages = totalPages;
  }

  /**
   * Deletes a note by array index with user confirmation
   * Updates pagination if needed, rerenders list, and plays feedback sound
   * Prompts user for confirmation before deletion
   * Adjusts current page if last note on page is deleted
   * 
   * @async
   * @param {number} index - Index of note in current notes array
   * @returns {Promise<void>}
   */
  async deleteNoteById(index) {
    const note = this.notes[index];
    if (!note) {
      alert('Note not found');
      return;
    }

    if (!confirm(`Delete "${note.title}"?`)) {
      return;
    }

    try {
      await this.deleteNote(note.id);
      this.notes.splice(index, 1);

      const newTotalPages = this.getTotalPages();
      if (newTotalPages === 0) {
        this.currentPage = 1;
      } else if (this.currentPage > newTotalPages) {
        this.currentPage = newTotalPages;
      }

      this.renderNotes();
      this.soundManager.play('eraser', 200);
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert(error.message || 'Failed to delete note.');
    }
  }

  /**
   * Changes to next or previous page with animation
   * Plays page turn sound and triggers flip animation
   * Does nothing if already at first/last page or in note view
   * 
   * @param {string} direction - Direction to navigate: 'next' or 'prev'
   * @returns {void}
   */
  changePage(direction) {
    if (this.currentView === 'note') return;

    const total = this.getTotalPages();
    if ((direction === 'next' && this.currentPage < total) ||
      (direction === 'prev' && this.currentPage > 1)) {
      this.currentPage += (direction === 'next' ? 1 : -1);
    } else return;

    this.soundManager.play('page_turn', 200);

    const notepad = document.querySelector('.notepad');
    notepad.classList.add('page-flip-animation');
    setTimeout(() => { this.renderNotes(); notepad.classList.remove('page-flip-animation'); }, 200);
  }

  /**
   * Legacy method for backward compatibility
   * Character limit is now set on the input element directly
   * 
   * @deprecated Use input element maxlength attribute instead
   * @returns {void}
   */
  setupCharacterLimit() {
  }

  /**
   * Legacy method for backward compatibility
   * Character limit initialization is now handled in constructor
   * 
   * @deprecated Character limit is now set automatically in constructor
   * @returns {void}
   */
  initializeCharacterLimit() {
  }

  /**
   * Handles add button click
   * Creates new note or updates existing based on context
   * Legacy method for form submission compatibility
   * 
   * @async
   * @returns {Promise<void>}
   */
  async handleAddOrUpdate() {
    this.createNewNote();
  }
}
