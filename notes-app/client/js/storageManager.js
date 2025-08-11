export class StorageManager {
  constructor() {
    this.isOnline = localStorage.getItem('storageMode') === 'online';
    this.apiUrl = 'http://localhost:5000/api/notes';
    this.pendingSync = JSON.parse(localStorage.getItem('pendingSync') || '[]');
    this.pendingDeletes = JSON.parse(localStorage.getItem('pendingDeletes') || '[]');
    this.pendingUpdates = JSON.parse(localStorage.getItem('pendingUpdates') || '[]');

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async handleOnline() {
    if (this.isOnline) {
      await this.syncPendingNotes();
      await this.syncPendingUpdates();
      await this.syncPendingDeletes();
    }
  }

  handleOffline() {
    if (this.isOnline) this.fallbackToOffline();
  }

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
        return syncedNotes;
      }
    }

    // Clear synced notes from pending
    this.pendingSync = [];
    localStorage.setItem('pendingSync', '[]');
    
    return syncedNotes;
  }

  async syncPendingUpdates() {
    if (this.pendingUpdates.length === 0) return;

    for (const update of this.pendingUpdates) {
      try {
        const response = await fetch(`${this.apiUrl}/${update.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: update.content })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
      } catch (error) {
        console.error('Failed to sync update:', error);
        return;
      }
    }

    this.pendingUpdates = [];
    localStorage.setItem('pendingUpdates', '[]');
  }

  async syncPendingDeletes() {
    if (this.pendingDeletes.length === 0) return;

    for (const noteId of this.pendingDeletes) {
      try {
        // Don't try to delete temporary IDs from server
        if (!this.isTemporaryId(noteId)) {
          const response = await fetch(`${this.apiUrl}/${noteId}`, { method: 'DELETE' });
          if (!response.ok && response.status !== 404) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }
      } catch (error) {
        console.error('Failed to sync delete:', error);
        return;
      }
    }

    this.pendingDeletes = [];
    localStorage.setItem('pendingDeletes', '[]');
    this.updateIndicator('All changes synced', 'online', 2000);
  }

  async saveNote(note) {
    if (this.isOnline) {
      try {
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

  async updateNote(noteId, content) {
    const updatedNote = { id: noteId, content };

    if (this.isOnline && !this.isTemporaryId(noteId)) {
      try {
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

  async deleteNote(noteId) {
    if (this.isOnline && !this.isTemporaryId(noteId)) {
      try {
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

  updateNoteIdInLocalStorage(oldId, newNote) {
    const notes = this.getFromLocalStorage();
    const index = notes.findIndex(n => n.id === oldId);
    if (index !== -1) {
      notes[index] = newNote;
      localStorage.setItem('notes', JSON.stringify(notes));
    }
  }

  updatePendingSyncNote(noteId, newContent) {
    const index = this.pendingSync.findIndex(n => n.id === noteId);
    if (index !== -1) {
      this.pendingSync[index].content = newContent;
      localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
    }
  }

  isTemporaryId(id) { 
    return typeof id === 'number' && id.toString().length === 13; 
  }

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

  addToPendingUpdate(note) {
    const existingIndex = this.pendingUpdates.findIndex(n => n.id === note.id);
    if (existingIndex !== -1) {
      this.pendingUpdates[existingIndex] = note;
    } else {
      this.pendingUpdates.push(note);
    }
    localStorage.setItem('pendingUpdates', JSON.stringify(this.pendingUpdates));
  }

  addToPendingDelete(noteId) {
    if (!this.pendingDeletes.includes(noteId)) {
      this.pendingDeletes.push(noteId);
      localStorage.setItem('pendingDeletes', JSON.stringify(this.pendingDeletes));
    }
  }

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

  getFromLocalStorage() { 
    return JSON.parse(localStorage.getItem('notes') || '[]'); 
  }

  fallbackToOffline() {
    this.isOnline = false;
    localStorage.setItem('storageMode', 'offline');
    this.updateIndicator('Currently using offline storage', 'offline');
  }

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

  // Debug method to check pending items
  getPendingStatus() {
    return {
      pendingSync: this.pendingSync.length,
      pendingUpdates: this.pendingUpdates.length,
      pendingDeletes: this.pendingDeletes.length,
      isOnline: this.isOnline
    };
  }
}
