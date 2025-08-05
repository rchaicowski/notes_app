export class StorageManager {
  constructor() {
    this.isOnline = localStorage.getItem('storageMode') === 'online';
    this.apiUrl = 'http://localhost:5000/api/notes';
    this.pendingSync = JSON.parse(localStorage.getItem('pendingSync') || '[]');
    this.pendingDeletes = JSON.parse(localStorage.getItem('pendingDeletes') || '[]');

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async handleOnline() {
    if (this.isOnline) {
      await this.syncPendingNotes();
      await this.syncPendingDeletes();
    }
  }

  handleOffline() {
    if (this.isOnline) this.fallbackToOffline();
  }

  async syncPendingNotes() {
    const indicator = document.querySelector('.storage-mode-indicator');
    if (indicator && this.pendingSync.length > 0) {
      indicator.className = 'storage-mode-indicator syncing';
      indicator.innerHTML = '<div class="status-dot online"></div>Syncing notes...';
    }

    for (const note of this.pendingSync) {
      try {
        await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note)
        });
      } catch (error) {
        console.error('Failed to sync note:', error);
        return;
      }
    }
    this.pendingSync = [];
    localStorage.setItem('pendingSync', '[]');
  }

  async syncPendingDeletes() {
    for (const noteId of this.pendingDeletes) {
      try {
        await fetch(`${this.apiUrl}/${noteId}`, { method: 'DELETE' });
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
        const res = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note)
        });
        return await res.json();
      } catch (err) {
        console.error('Failed to save note online:', err);
        this.addToPendingSync(note);
        this.fallbackToOffline();
      }
    } else {
      this.saveToLocalStorage(note);
      this.addToPendingSync(note);
    }
  }

  async deleteNote(noteId) {
    if (this.isOnline) {
      try {
        const res = await fetch(`${this.apiUrl}/${noteId}`, { method: 'DELETE' });
        return await res.json();
      } catch (err) {
        console.error('Failed to delete note online:', err);
        this.addToPendingDelete(noteId);
        this.fallbackToOffline();
        throw err;
      }
    } else {
      this.deleteFromLocalStorage(noteId);
      if (!this.isTemporaryId(noteId)) this.addToPendingDelete(noteId);
    }
  }

  isTemporaryId(id) { return typeof id === 'number' && id.toString().length === 13; }

  deleteFromLocalStorage(noteId) {
    const notes = this.getFromLocalStorage().filter(n => n.id !== noteId);
    localStorage.setItem('notes', JSON.stringify(notes));
    this.pendingSync = this.pendingSync.filter(n => n.id !== noteId);
    localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
  }

  addToPendingSync(note) {
    this.pendingSync.push(note);
    localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync));
  }

  addToPendingDelete(noteId) {
    if (!this.pendingDeletes.includes(noteId)) {
      this.pendingDeletes.push(noteId);
      localStorage.setItem('pendingDeletes', JSON.stringify(this.pendingDeletes));
    }
  }

  saveToLocalStorage(note) {
    const notes = this.getFromLocalStorage();
    notes.push(note);
    localStorage.setItem('notes', JSON.stringify(notes));
  }

  getFromLocalStorage() { return JSON.parse(localStorage.getItem('notes') || '[]'); }

  fallbackToOffline() {
    this.isOnline = false;
    localStorage.setItem('storageMode', 'offline');
    this.updateIndicator('Currently using offline storage', 'offline');
  }

  setMode(isOnline) {
    this.isOnline = isOnline;
    localStorage.setItem('storageMode', isOnline ? 'online' : 'offline');
    if (isOnline) {
      this.syncPendingNotes();
      this.syncPendingDeletes();
    }
  }

  updateIndicator(message, status, resetDelay = 0) {
    const indicator = document.querySelector('.storage-mode-indicator');
    if (!indicator) return;
    indicator.className = `storage-mode-indicator ${status}`;
    indicator.innerHTML = `<div class="status-dot ${status}"></div>${message}`;
    if (resetDelay > 0) {
      setTimeout(() => {
        indicator.innerHTML = `<div class="status-dot ${status}"></div>Currently using ${status} storage`;
      }, resetDelay);
    }
  }
}
