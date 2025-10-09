import { getAuthToken, isAuthenticated } from './auth.js';

export class NotesManager {
  constructor(soundManager, storageManager) {
    this.notes = [];
    this.currentPage = 1;
    this.notesPerPage = 15;
    this.isEditMode = false;
    this.isDeleteMode = false;
    this.apiBaseUrl = 'http://localhost:5000/api/notes';
    this.soundManager = soundManager;
    this.storageManager = storageManager;
    this.maxCharacters = 35; 
    this.maxTitleCharacters = 35;
    this.maxLinesPerNote = 15; 
    this.isOffline = localStorage.getItem('offlineMode') === 'true';
    this.currentView = 'index'; 
    this.currentNoteId = null;

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

  async saveNote(noteData, isUpdate = false, noteId = null) {
    if (this.isOffline) {
      const note = {
        id: isUpdate ? noteId : Date.now(),
        title: noteData.title || 'Untitled',
        content: noteData.content || '',
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
          content: noteData.content || ''
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

  showNote(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;

    this.currentView = 'note';
    this.currentNoteId = noteId;
    this.renderNoteView(note);
  }

  showIndex() {
    this.currentView = 'index';
    this.currentNoteId = null;

    // Show the form and pagination when returning to index
    const form = document.getElementById('note-form');
    const pagination = document.querySelector('.page-navigation');
    if (form) form.style.display = 'flex';
    if (pagination) pagination.style.display = 'flex';

    this.renderNotes();
  }

  createNewNote() {
    // Get any existing input value
    const contentInput = document.getElementById('content');
    const inputValue = contentInput ? contentInput.value.trim() : '';

    const newNote = {
      id: null,
      title: inputValue || '',
      content: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Clear the original input
    if (contentInput) {
      contentInput.value = '';
    }

    this.currentView = 'note';
    this.currentNoteId = null;
    this.renderNoteView(newNote, true);
  }

  renderNoteView(note, isNew = false) {
    const form = document.getElementById('note-form');
    const pagination = document.querySelector('.page-navigation');
    if (form) form.style.display = 'none';
    if (pagination) pagination.style.display = 'none';

    this.isNewNote = isNew;

    const list = document.getElementById('notes-list');

    // Create the note editing interface that looks like the notepad
    list.innerHTML = '';

    // Create container for the note
    const noteContainer = document.createElement('div');
    noteContainer.className = 'note-view';

    // Title input
    const titleLine = document.createElement('div');
    titleLine.className = 'note-line title-line';
    titleLine.innerHTML = `
      <input 
        type="text" 
        id="note-title" 
        class="note-title-input" 
        placeholder="Note Title" 
        value="${note.title}" 
        maxlength="${this.maxTitleCharacters}"
      />
    `;
    noteContainer.appendChild(titleLine);

    // Content lines (15 lines, each with 35 character limit)
    const contentContainer = document.createElement('div');
    contentContainer.className = 'note-content-container';

    const contentLines = note.content.split('\n');
    for (let i = 0; i < this.maxLinesPerNote; i++) {
      const line = document.createElement('div');
      line.className = 'note-line content-line';
      line.innerHTML = `
        <input 
          type="text" 
          class="note-content-line" 
          data-line="${i}"
          placeholder="${i === 0 ? 'Start writing...' : ''}"
          value="${contentLines[i] || ''}" 
          maxlength="${this.maxCharacters}"
        />
      `;
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

    document.getElementById('back-to-index').addEventListener('click', () => {
      this.showIndex();
    });

    document.getElementById('save-note').addEventListener('click', () => {
      this.saveCurrentNote();
    });

    const contentInputs = document.querySelectorAll('.note-content-line');
    contentInputs.forEach((input, index) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && index < contentInputs.length - 1) {
          e.preventDefault();
          contentInputs[index + 1].focus();
        }
        else if (e.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0 && index > 0) {
          e.preventDefault();
          const prevInput = contentInputs[index - 1];
          prevInput.focus();
          prevInput.setSelectionRange(prevInput.value.length, prevInput.value.length);
        }
      });

      input.addEventListener('input', (e) => {
        if (e.target.value.length >= this.maxCharacters && index < contentInputs.length - 1) {
          contentInputs[index + 1].focus();
        }
      });
    });

    document.getElementById('note-title').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstContentLine = document.querySelector('.note-content-line');
        if (firstContentLine) {
          firstContentLine.focus();
        }
      }
    });

    if (isNew) {
      document.getElementById('note-title').focus();
    } else {
      const firstEmptyLine = Array.from(contentInputs).find(input => !input.value);
      if (firstEmptyLine) {
        firstEmptyLine.focus();
      } else {
        contentInputs[0].focus();
      }
    }
  }

  hasContentInLines() {
    const contentInputs = document.querySelectorAll('.note-content-line');
    return Array.from(contentInputs).some(input => input.value.trim());
  }

  async saveCurrentNote() {
    const titleInput = document.getElementById('note-title');
    const contentInputs = document.querySelectorAll('.note-content-line');

    if (!titleInput) return;

    const title = titleInput.value.trim() || 'Untitled';
    const contentLines = Array.from(contentInputs).map(input => input.value);
    const content = contentLines.join('\n').replace(/\n+$/, '');

    try {
      let savedNote;
      if (this.isNewNote || this.currentNoteId === null) {
        savedNote = await this.saveNote({ title, content });
        this.notes.push(savedNote);
        this.currentNoteId = savedNote.id;
        this.isNewNote = false;
      } else {
        savedNote = await this.saveNote({ title, content }, true, this.currentNoteId);
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

  toggleEditMode() {
    if (this.currentView === 'note') return;
    this.soundManager.play('pencil', 200);
    this.isEditMode ? this.exitModes() : this.enterEditMode();
  }

  toggleDeleteMode() {
    if (this.currentView === 'note') return;
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
    if (this.currentView === 'note') return;

    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    const pageDiv = document.createElement('div');
    pageDiv.className = 'notes-page active';
    pageDiv.id = `page-${this.currentPage}`;

    this.getNotesForPage(this.currentPage).forEach((note, i) => {
      const li = document.createElement('li');
      li.dataset.id = (this.currentPage - 1) * this.notesPerPage + i;
      li.dataset.page = this.currentPage;
      li.dataset.noteId = note.id;

      li.innerHTML = `<div class="note-content">${note.title}</div>`;
      pageDiv.appendChild(li);
    });

    list.appendChild(pageDiv);

    list.removeEventListener('click', this.handleNoteClick);
    this.handleNoteClick = e => {
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

  // Legacy methods for backward compatibility
  setupCharacterLimit() {
  }

  initializeCharacterLimit() {
  }

  async handleAddOrUpdate() {
    this.createNewNote();
  }
}
