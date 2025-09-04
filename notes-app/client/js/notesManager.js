import { getAuthToken, isAuthenticated } from './auth.js';

export class NotesManager {
  constructor(soundManager, storageManager) {
    this.notes = [];
    this.currentPage = 1;
    this.notesPerPage = 12;
    this.isEditMode = false;
    this.isDeleteMode = false;
    this.apiBaseUrl = 'http://localhost:5000/api/notes';
    this.soundManager = soundManager;
    this.storageManager = storageManager;
    this.maxCharacters = 35;
    this.isOffline = localStorage.getItem('offlineMode') === 'true';

    window.addEventListener('offline-mode-changed', (event) => {
      this.isOffline = event.detail.isOffline;
      this.loadNotes();
    });

    window.addEventListener('auth-changed', (event) => {
      if (event.detail.isAuthenticated) {
        this.loadNotes();
      } else {
        this.notes = [];
        this.renderNotes();
      }
    });
  }

  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    };
  }

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

  fallbackToLocalNotes() {
    this.notes = this.storageManager.getFromLocalStorage();
    this.renderNotes();
  }

  async saveNote(noteData, isUpdate = false, noteId = null) {
    if (this.isOffline) {
      const note = {
        id: isUpdate ? noteId : Date.now(),
        content: noteData.content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (isUpdate) {
        const notes = this.storageManager.getFromLocalStorage();
        const index = notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
          notes[index] = { ...notes[index], ...note };
          localStorage.setItem('notes', JSON.stringify(notes));
          return notes[index];
        }
      }

      this.storageManager.saveToLocalStorage(note);
      return note;
    }

    if (!isAuthenticated()) {
      throw new Error('Please log in to save notes online');
    }

    try {
      const options = {
        method: isUpdate ? 'PUT' : 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ content: noteData.content })
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

  async deleteNote(noteId) {
    if (this.isOffline) {
      this.storageManager.deleteFromLocalStorage(noteId);
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

  toggleEditMode() {
    this.soundManager.play('pencil', 200);
    this.isEditMode ? this.exitModes() : this.enterEditMode();
  }

  toggleDeleteMode() {
    this.soundManager.play('eraser', 200);
    this.isDeleteMode ? this.exitModes() : this.enterDeleteMode();
  }

  enterEditMode() {
    this.exitModes();
    this.isEditMode = true;
    document.getElementById('edit-mode-btn').classList.add('active');
    document.body.classList.add('edit-mode');
    this.highlightNotes('edit');
  }

  enterDeleteMode() {
    this.exitModes();
    this.isDeleteMode = true;
    document.getElementById('delete-mode-btn').classList.add('active');
    document.body.classList.add('delete-mode');
    this.highlightNotes('delete');
  }

  exitModes() {
    this.isEditMode = this.isDeleteMode = false;
    document.getElementById('edit-mode-btn').classList.remove('active');
    document.getElementById('delete-mode-btn').classList.remove('active');
    document.body.classList.remove('edit-mode', 'delete-mode');
    this.removeHighlights();
  }

  highlightNotes(mode) {
    const currentPageElement = document.getElementById(`page-${this.currentPage}`);
    if (currentPageElement) {
      currentPageElement.querySelectorAll('li').forEach(note => {
        note.classList.add(`highlight-${mode}`);
        note.style.cursor = 'pointer';
      });
    }
  }

  removeHighlights() {
    document.querySelectorAll('#notes-list li').forEach(note => {
      note.classList.remove('highlight-edit', 'highlight-delete');
      note.style.cursor = 'default';
    });
  }

  renderNotes() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    const pageDiv = document.createElement('div');
    pageDiv.className = 'notes-page active';
    pageDiv.id = `page-${this.currentPage}`;

    this.getNotesForPage(this.currentPage).forEach((note, i) => {
      const li = document.createElement('li');
      li.dataset.id = (this.currentPage - 1) * this.notesPerPage + i;
      li.dataset.page = this.currentPage;
      li.innerHTML = `<div class="note-content">${note.content}</div>`;
      pageDiv.appendChild(li);
    });

    list.appendChild(pageDiv);

    list.removeEventListener('click', this.handleNoteClick);
    this.handleNoteClick = e => {
      const li = e.target.closest('li');
      if (!li) return;
      this.selectNote(li);
    };
    list.addEventListener('click', this.handleNoteClick);

    this.updatePageInfo();
    if (this.isEditMode) this.highlightNotes('edit');
    else if (this.isDeleteMode) this.highlightNotes('delete');
  }

  getTotalPages() { 
    return Math.ceil(this.notes.length / this.notesPerPage); 
  }
  
  getNotesForPage(page) { 
    return this.notes.slice((page - 1) * this.notesPerPage, page * this.notesPerPage); 
  }

  updatePageInfo() {
    const totalPages = this.getTotalPages();
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

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

  selectNote(noteEl) {
    const idx = parseInt(noteEl.dataset.id);
    const note = this.notes[idx];
    if (!note) return;
    if (this.isEditMode) { this.editNote(idx, note.content); this.exitModes(); }
    else if (this.isDeleteMode) { this.deleteNoteById(idx); this.exitModes(); }
  }

  editNote(id, content) {
    try {
      const contentInput = document.getElementById('content');
      const form = document.getElementById('note-form');

      if (!contentInput || !form) {
        throw new Error('Required elements not found');
      }

      contentInput.value = content;
      form.setAttribute('data-editing', id.toString());
      contentInput.focus();

      const charCount = document.getElementById('char-count');
      if (charCount) {
        this.updateCharacterCount(content, charCount);
      }

      this.soundManager.play('pencil', 200);
    } catch (error) {
      console.error('Error setting up edit:', error);
      alert('Could not edit note');
    }
  }

  async deleteNoteById(index) {
    const note = this.notes[index];
    if (!note) {
      alert('Note not found');
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

  changePage(direction) {
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

  setupCharacterLimit() {
    const contentInput = document.getElementById('content');
    const charCountDisplay = this.createCharacterCountDisplay();

    contentInput.parentNode.insertBefore(charCountDisplay, contentInput.nextSibling);

    contentInput.addEventListener('input', (e) => {
      this.updateCharacterCount(e.target.value, charCountDisplay);
    });

    contentInput.addEventListener('keydown', (e) => {
      if (e.target.value.length >= this.maxCharacters &&
        !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }

  createCharacterCountDisplay() {
    const charCount = document.createElement('div');
    charCount.id = 'char-count';
    charCount.textContent = `0/${this.maxCharacters}`;
    return charCount;
  }

  updateCharacterCount(value, display) {
    const currentLength = value.length;
    display.textContent = `${currentLength}/${this.maxCharacters}`;

    if (currentLength >= this.maxCharacters) {
      display.style.color = '#d8580d';
      display.style.fontWeight = 'bold';
    } else if (currentLength >= this.maxCharacters - 5) {
      display.style.color = '#d8580d';
      display.style.fontWeight = 'normal';
    } else {
      display.style.color = '#666';
      display.style.fontWeight = 'normal';
    }
  }

  initializeCharacterLimit() {
    setTimeout(() => {
      this.setupCharacterLimit();
    }, 100);
  }

  async handleAddOrUpdate() {
    const content = document.getElementById('content').value.trim();
    const form = document.getElementById('note-form');
    const editingId = form.getAttribute('data-editing');

    if (!content) return;

    if (content.length > this.maxCharacters) {
      return;
    }

    try {
      if (editingId !== null && editingId !== undefined && editingId !== '' && editingId !== 'null') {
        const idx = parseInt(editingId);
        const note = this.notes[idx];
        if (!note) {
          throw new Error('Note not found');
        }
        const updatedNote = await this.saveNote({ content }, true, note.id);
        this.notes[idx] = updatedNote;
        form.removeAttribute('data-editing');
      } else {
        const newNote = await this.saveNote({ content });
        this.notes.push(newNote);
        this.currentPage = this.getTotalPages();
      }

      this.renderNotes();
      form.reset();

      const charCount = document.getElementById('char-count');
      if (charCount) {
        this.updateCharacterCount('', charCount);
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      alert(error.message || 'Failed to save note.');
    }
  }
}
