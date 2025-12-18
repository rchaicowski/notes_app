/**
 * @fileoverview Storage manager for handling online/offline data persistence
 * Manages syncing between local storage and remote API
 * Handles pending operations when offline and syncs when connection restored
 * @module storageManager
 */

/**
 * Manages note storage with online/offline synchronization
 * Automatically syncs pending changes when connection is restored
 * Maintains separate queues for create, update, and delete operations
 */
export class StorageManager {
  /**
   * Creates a new StorageManager instance
   * Initializes storage mode, API configuration, and pending operation queues
   * Sets up automatic sync when network connectivity changes
   * 
   * WARNING: Event listeners are never removed - potential memory leak
   */
  constructor() {
    /** @type {boolean} Whether currently in online mode */
    this.isOnline = localStorage.getItem('storageMode') === 'online';
    
    /** @type {string} Base URL for API endpoints */
    this.apiUrl = 'http://localhost:5000/api/notes';
    
    /** @type {Array<Object>} Notes pending sync to server (created offline) */
    this.pendingSync = JSON.parse(localStorage.getItem('pendingSync') || '[]');
    
    /** @type {Array<number>} Note IDs pending deletion on server */
    this.pendingDeletes = JSON.parse(localStorage.getItem('pendingDeletes') || '[]');
    
    /** @type {Array<Object>} Notes pending update on server (edited offline) */
    this.pendingUpdates = JSON.parse(localStorage.getItem('pendingUpdates') || '[]');

    // Listen for online/offline events
    // ISSUE: These listeners are never removed - memory leak
    // ISSUE: Missing authentication in API calls
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Handles network coming back online
   * Attempts to sync all pending operations in order: create, update, delete
   * @async
   * @returns {Promise<void>}
   */
  async handleOnline() {
    if (this.isOnline) {
      await this.syncPendingNotes();
      await this.syncPendingUpdates();
      await this.syncPendingDeletes();
    }
  }

  /**
   * Handles network going offline
   * Switches to offline mode if currently online
   * @returns {void}
   */
  handleOffline() {
    if (this.isOnline) this.fallbackToOffline();
  }

  /**
   * Syncs notes created offline to the server
   * Updates local IDs with server-assigned IDs after successful sync
   * Shows sync progress in UI indicator
   * 
   * ISSUE: Returns early on first error, abandoning remaining notes
   * ISSUE: No retry logic for transient failures
   * 
   * @async
   * @returns {Promise<Array<Object>>} Array of synced notes with old/new ID mapping
   */
  async syncPendingNotes() {
    if (this.pendingSync.length === 0) return;

    const indicator = document.querySelector('.storage-mode-indicator');
    if (indicator) {
      indicator.className = 'storage-mode-indicator syncing';
      indicator.innerHTML = '<div class="status-dot online"></div>Syncing notes...';
    }

    const syncedNotes = [];
    for (const note of this.pendingSync) {
      try {
        // ISSUE: Missing Authorization header
        // ISSUE: Only sends 'content', loses 'title' and 'formatting'
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: note.content })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const savedNote = await response.json();
        syncedNotes.push({ oldId: note.id, newNote: savedNote });
        
        // Update local storage to replace temporary ID with real ID
        this.updateNoteIdInLocalStorage(note.id, savedNote);
        
      } catch (error) {
        console.error('Failed to sync note:', error);
        // ISSUE: Returns early, abandoning remaining notes in queue
        return syncedNotes;
      }
    }

    // Clear synced notes from pending
    this.pendingSync = [];
    localStorage.setItem('pendingSync', '[]');
    
    return syncedNotes;
  }

  /**
   * Syncs notes updated offline to the server
   * Updates are sent in order they were queued
   * 
   * ISSUE: Returns early on first error, abandoning remaining updates
   * 
   * @async
   * @returns {Promise<void>}
   */
  async syncPendingUpdates() {
    if (this.pendingUpdates.length === 0) return;

    for (const update of this.pendingUpdates) {
      try {
        // ISSUE: Missing Authorization header
        // ISSUE: Only sends 'content', loses 'title' and 'formatting'
        const response = await fetch(`${this.apiUrl}/${update.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: update.content })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
      } catch (error) {
        console.error('Failed to sync update:', error);
        // ISSUE: Returns early, abandoning remaining updates
        return;
      }
    }

    this.pendingUpdates = [];
    localStorage.setItem('pendingUpdates', '[]');
  }

  /**
   * Syncs notes deleted offline to the server
   * Skips temporary IDs (notes never synced to server)
   * Updates UI indicator when complete
   * 
   * ISSUE: Returns early on first error, abandoning remaining deletes
   * 
   * @async
   * @returns {Promise<void>}
   */
  async syncPendingDeletes() {
    if (this.pendingDeletes.length === 0) return;

    for (const noteId of this.pendingDeletes) {
      try {
        // Don't try to delete temporary IDs from server
        if (!this.isTemporaryId(noteId)) {
          // ISSUE: Missing Authorization header
          const response = await fetch(`${this.apiUrl}/${noteId}`, { method: 'DELETE' });
          if (!response.ok && response.status !== 404) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }
      } catch (error) {
        console.error('Failed to sync delete:', error);
        // ISSUE: Returns early, abandoning remaining deletes
        return;
      }
    }

    this.pendingDeletes = [];
    localStorage.setItem('pendingDeletes', '[]');
    this.updateIndicator('All changes synced', 'online', 2000);
  }

  /**
   * Saves a new note to server or local storage
   * If online, attempts server save first, falls back to local on failure
   * If offline, saves locally and queues for sync
   * 
   * @async
   * @param {Object} note - Note object to save
   * @param {string} note.content - Note content
   * @returns {Promise<Object>} Saved note with assigned ID
   */
  async saveNote(note) {
    if (this.isOnline) {
      try {
        // ISSUE: Missing Authorization header
        // ISSUE: Only sends 'content', loses 'title' and 'formatting'
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: note.content })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const savedNote = await response.json();
        this.saveToLocalStorage(savedNote);
        return savedNote;
        
      } catch (error) {
        console.error('Failed to save note online:', error);
        // Generate temporary ID and save locally
        const tempNote = { ...note, id: Date.now() };
        this.saveToLocalStorage(tempNote);
        this.addToPendingSync(tempNote);
        this.fallbackToOffline();
        return tempNote;
      }
    } else {
      // Offline mode - generate temporary ID
      const tempNote = { ...note, id: Date.now() };
      this.saveToLocalStorage(tempNote);
      this.addToPendingSync(tempNote);
      return tempNote;
    }
  }

  /**
   * Updates an existing note on server or in local storage
   * If online and ID is permanent, attempts server update
   * If offline or temporary ID, saves locally and queues for sync
   * 
   * @async
   * @param {number} noteId - ID of note to update
   * @param {string} content - New note content
   * @returns {Promise<Object>} Updated note object
   */
  async updateNote(noteId, content) {
    const updatedNote = { id: noteId, content };

    if (this.isOnline && !this.isTemporaryId(noteId)) {
      try {
        // ISSUE: Missing Authorization header
        // ISSUE: Only sends 'content', loses 'title' and 'formatting'
        const response = await fetch(`${this.apiUrl}/${noteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const serverNote = await response.json();
        this.saveToLocalStorage(serverNote);
        return serverNote;
        
      } catch (error) {
        console.error('Failed to update note online:', error);
        this.saveToLocalStorage(updatedNote);
        this.addToPendingUpdate(updatedNote);
        this.fallbackToOffline();
        return updatedNote;
      }
    } else {
      // Offline mode or temporary ID
      this.saveToLocalStorage(updatedNote);
      
      if (this.isTemporaryId(noteId)) {
        // Update the pending sync entry
        this.updatePendingSyncNote(noteId, content);
      } else {
        // Add to pending updates
        this.addToPendingUpdate(updatedNote);
      }
      
      return updatedNote;
    }
  }

  /**
   * Deletes a note from server or local storage
   * If online and ID is permanent, attempts server delete
   * If offline or temporary ID, removes locally and queues for sync
   * 
   * @async
   * @param {number} noteId - ID of note to delete
   * @returns {Promise<void>}
   * @throws {Error} If online delete fails
   */
  async deleteNote(noteId) {
    if (this.isOnline && !this.isTemporaryId(noteId)) {
      try {
        // ISSUE: Missing Authorization header
        const response = await fetch(`${this.apiUrl}/${noteId}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.deleteFromLocalStorage(noteId);
        return;
        
      } catch (error) {
        console.error('Failed to delete note online:', error);
        this.deleteFromLocalStorage(noteId);
        this.addToPendingDelete(noteId);
        this.fallbackToOffline();
        throw error;
      }
    } else {
      // Offline mode or temporary ID
      this.deleteFromLocalStorage(noteId);
      
      if (!this.isTemporaryId(noteId)) {
        this.addToPendingDelete(noteId);
      }
    }
  }

  /**
   * Replaces a temporary note ID with server-assigned ID in local storage
   * Used after successfully syncing a note created offline
   * 
   * @param {number} oldId - Temporary ID to replace
   * @param {Object} newNote - Note object with server-assigned ID
   * @returns {void}
   */
  updateNoteIdInLocalStorage(oldId, newNote) {
    const notes = this.getFromLocalStorage();
    const index = notes.findIndex(n => n.id === oldId);
    if (index !== -1) {
      notes[index] = newNote;
      localStorage.setItem('notes', JSON.stringify(notes));
    }
  }

  /**
   * Updates content of a note in pending sync queue
   * Used when editing a note that hasn't been synced yet
   * 
   * @param {number} noteId - ID of note to update
   * @param {string} newContent - New content for the note
   * @returns {void}
   */
  updatePendingSyncNote(noteId, newContent) {
    const index = this.pendingSync.findIndex(n => n.id === noteId);
    if (index !== -1) {
      this.pendingSync[index].content = newContent;
      localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
    }
  }

  /**
   * Checks if an ID is temporary (generated locally, not from server)
   * Temporary IDs are timestamps, which are 13 digits long
   * 
   * ISSUE: Fragile detection - assumes timestamp format, breaks in year 2286
   * 
   * @param {number} id - ID to check
   * @returns {boolean} True if ID is temporary (timestamp-based)
   */
  isTemporaryId(id) { 
    return typeof id === 'number' && id.toString().length === 13; 
  }

  /**
   * Removes a note from local storage
   * Also removes from pending sync, update, and delete queues
   * 
   * @param {number} noteId - ID of note to remove
   * @returns {void}
   */
  deleteFromLocalStorage(noteId) {
    const notes = this.getFromLocalStorage().filter(n => n.id !== noteId);
    localStorage.setItem('notes', JSON.stringify(notes));
    
    // Also remove from pending sync if it exists
    this.pendingSync = this.pendingSync.filter(n => n.id !== noteId);
    localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
    
    // Remove from pending updates
    this.pendingUpdates = this.pendingUpdates.filter(n => n.id !== noteId);
    localStorage.setItem('pendingUpdates', JSON.stringify(this.pendingUpdates));
  }

  /**
   * Adds a note to pending sync queue
   * Updates existing entry if note already in queue
   * 
   * @param {Object} note - Note to queue for syncing
   * @returns {void}
   */
  addToPendingSync(note) {
    // Check if note already exists in pendingSync and update it
    const existingIndex = this.pendingSync.findIndex(n => n.id === note.id);
    if (existingIndex !== -1) {
      this.pendingSync[existingIndex] = note;
    } else {
      this.pendingSync.push(note);
    }
    localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
  }

  /**
   * Adds a note to pending update queue
   * Updates existing entry if note already in queue
   * 
   * @param {Object} note - Note to queue for updating
   * @returns {void}
   */
  addToPendingUpdate(note) {
    const existingIndex = this.pendingUpdates.findIndex(n => n.id === note.id);
    if (existingIndex !== -1) {
      this.pendingUpdates[existingIndex] = note;
    } else {
      this.pendingUpdates.push(note);
    }
    localStorage.setItem('pendingUpdates', JSON.stringify(this.pendingUpdates));
  }

  /**
   * Adds a note ID to pending delete queue
   * Prevents duplicates
   * 
   * @param {number} noteId - ID of note to queue for deletion
   * @returns {void}
   */
  addToPendingDelete(noteId) {
    if (!this.pendingDeletes.includes(noteId)) {
      this.pendingDeletes.push(noteId);
      localStorage.setItem('pendingDeletes', JSON.stringify(this.pendingDeletes));
    }
  }

  /**
   * Saves or updates a note in local storage
   * Creates new entry or updates existing based on ID
   * 
   * @param {Object} note - Note object to save
   * @param {number} note.id - Note ID
   * @param {string} note.content - Note content
   * @returns {void}
   */
  saveToLocalStorage(note) {
    const notes = this.getFromLocalStorage();
    const existingIndex = notes.findIndex(n => n.id === note.id);
    
    if (existingIndex !== -1) {
      // Update existing note
      notes[existingIndex] = note;
    } else {
      // Add new note
      notes.push(note);
    }
    
    localStorage.setItem('notes', JSON.stringify(notes));
  }

  /**
   * Retrieves all notes from local storage
   * Returns empty array if no notes exist
   * 
   * @returns {Array<Object>} Array of note objects
   */
  getFromLocalStorage() { 
    return JSON.parse(localStorage.getItem('notes') || '[]'); 
  }

  /**
   * Switches to offline mode
   * Updates storage mode flag and UI indicator
   * 
   * @returns {void}
   */
  fallbackToOffline() {
    this.isOnline = false;
    localStorage.setItem('storageMode', 'offline');
    this.updateIndicator('Currently using offline storage', 'offline');
  }

  /**
   * Sets storage mode to online or offline
   * When switching to online, attempts to sync all pending operations
   * Reloads notes after successful sync
   * 
   * @async
   * @param {boolean} isOnline - True for online mode, false for offline
   * @returns {Promise<void>}
   */
  async setMode(isOnline) {
    this.isOnline = isOnline;
    localStorage.setItem('storageMode', isOnline ? 'online' : 'offline');
    
    if (isOnline) {
      // When switching to online mode, try to sync
      await this.syncPendingNotes();
      await this.syncPendingUpdates();
      await this.syncPendingDeletes();
      
      // Notify that sync is complete
      this.updateIndicator('Currently using online storage', 'online');
      
      // Reload notes to reflect any changes
      if (window.app && window.app.notesManager) {
        await window.app.notesManager.loadNotes();
      }
    } else {
      this.updateIndicator('Currently using offline storage', 'offline');
    }
  }

  /**
   * Updates storage mode indicator in the UI
   * Shows current status and optionally resets after delay
   * 
   * ISSUE: Tightly coupled to DOM structure - not reusable
   * 
   * @param {string} message - Status message to display
   * @param {string} status - Status type: 'online', 'offline', or 'syncing'
   * @param {number} [resetDelay=0] - Milliseconds to wait before resetting to default message
   * @returns {void}
   */
  updateIndicator(message, status, resetDelay = 0) {
    const indicator = document.querySelector('.storage-mode-indicator');
    if (!indicator) return;
    indicator.className = `storage-mode-indicator ${status}`;
    indicator.innerHTML = `<div class="status-dot ${status}"></div>${message}`;
    
    if (resetDelay > 0) {
      setTimeout(() => {
        const currentMode = this.isOnline ? 'online' : 'offline';
        indicator.className = `storage-mode-indicator ${currentMode}`;
        indicator.innerHTML = `<div class="status-dot ${currentMode}"></div>Currently using ${currentMode} storage`;
      }, resetDelay);
    }
  }

  /**
   * Returns current sync status and pending operation counts
   * Useful for debugging and displaying sync state in UI
   * 
   * @returns {Object} Status object with pending counts and online state
   * @returns {number} return.pendingSync - Number of notes pending creation sync
   * @returns {number} return.pendingUpdates - Number of notes pending update sync
   * @returns {number} return.pendingDeletes - Number of notes pending deletion sync
   * @returns {boolean} return.isOnline - Whether currently in online mode
   */
  getPendingStatus() {
    return {
      pendingSync: this.pendingSync.length,
      pendingUpdates: this.pendingUpdates.length,
      pendingDeletes: this.pendingDeletes.length,
      isOnline: this.isOnline
    };
  }
}
