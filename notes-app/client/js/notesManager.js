import { getAuthToken, isAuthenticated } from './auth.js';
import { FormattingManager } from './formattingManager.js';

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
    this.maxTitleCharacters = 30;
    this.maxLinesPerNote = 15; 
    this.isOffline = localStorage.getItem('offlineMode') === 'true';
    this.currentView = 'index'; 
    this.currentNoteId = null;
    this.formattingManager = new FormattingManager(soundManager);

    // Add character limit to the index page input
    setTimeout(() => {
      const indexInput = document.getElementById('content');
      if (indexInput) {
        indexInput.setAttribute('maxlength', this.maxTitleCharacters);
      }
    }, 100);

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

    // Initialize keyboard support for edit/delete buttons
    this.initializeKeyboardSupport();
  }

  /**
   * Initialize keyboard support for edit/delete mode buttons
   */
  initializeKeyboardSupport() {
    const editBtn = document.getElementById('editModeBtn');
    const deleteBtn = document.getElementById('deleteModeBtn');

    // Add keyboard support to edit button
    editBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleEditMode();
      }
    });

    // Add keyboard support to delete button
    deleteBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleDeleteMode();
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

    // Close formatting toolbar and remove active state
    this.formattingManager.toggleToolbar(false);
    document.getElementById('editModeBtn').classList.remove('active');

    // Show the form and pagination when returning to index
    const form = document.getElementById('noteForm');
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
      formatting: [],
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
    const form = document.getElementById('noteForm');
    const pagination = document.querySelector('.page-navigation');
    if (form) form.style.display = 'none';
    if (pagination) pagination.style.display = 'none';

    this.isNewNote = isNew;

    const list = document.getElementById('notesList');
    list.innerHTML = '';

    const noteContainer = document.createElement('div');
    noteContainer.className = 'note-view';

    // Title as contenteditable div
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

    // Content lines as contenteditable divs
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

    // Initialize formatting toolbar
    setTimeout(() => {
      this.formattingManager.initializeToolbar();
      
      // Apply existing formatting if available
      if (note.formatting) {
        this.formattingManager.applyFormattingToNote(noteContainer, note.formatting);
      }
    }, 100);

    // Event listeners
    document.getElementById('back-to-index').addEventListener('click', () => {
      this.showIndex();
    });

    document.getElementById('save-note').addEventListener('click', () => {
      this.saveCurrentNote();
    });

    // Setup contenteditable behavior
    const contentDivs = document.querySelectorAll('.note-content-line');
    const titleDivElement = document.getElementById('note-title');

    // Character limit enforcement for content lines
    contentDivs.forEach((div, index) => {
      // Prevent exceeding character limit AND auto-move to next line when full
      div.addEventListener('input', (e) => {
        const text = div.textContent;
        if (text.length > this.maxCharacters) {
          // Truncate to max length
          const range = window.getSelection().getRangeAt(0);
          const cursorPos = range.startOffset;
          div.textContent = text.substring(0, this.maxCharacters);
          
          // Restore cursor position
          const newRange = document.createRange();
          const textNode = div.firstChild;
          if (textNode) {
            newRange.setStart(textNode, Math.min(cursorPos, this.maxCharacters));
            newRange.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        } else if (text.length === this.maxCharacters && index < contentDivs.length - 1) {
          // Auto-move to next line when this line is full
          setTimeout(() => {
            contentDivs[index + 1].focus();
          }, 10);
        }
      });

      // Handle Enter key - move to next line
      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (index < contentDivs.length - 1) {
            contentDivs[index + 1].focus();
          }
        } else if (e.key === 'Backspace') {
          const selection = window.getSelection();
          const range = selection.getRangeAt(0);
          
          // If at the start of the line and it's empty, move to previous line
          if (range.startOffset === 0 && div.textContent.length === 0 && index > 0) {
            e.preventDefault();
            const prevDiv = contentDivs[index - 1];
            prevDiv.focus();
            
            // Move cursor to end of previous line
            const newRange = document.createRange();
            newRange.selectNodeContents(prevDiv);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      });
    });

    // Title character limit
    titleDivElement.addEventListener('input', (e) => {
      const text = titleDivElement.textContent;
      if (text.length > this.maxTitleCharacters) {
        e.preventDefault();
        // Truncate to max length
        titleDivElement.textContent = text.substring(0, this.maxTitleCharacters);
        
        // Move cursor to end
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(titleDivElement);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });

    // Also prevent typing when at limit
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
        // Prevent adding more characters when at limit (unless it's a control key)
        const selection = window.getSelection();
        if (selection.isCollapsed) {
          e.preventDefault();
        }
      }
    });

    // Focus handling
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

  hasContentInLines() {
    const contentInputs = document.querySelectorAll('.note-content-line');
    return Array.from(contentInputs).some(input => input.value.trim());
  }

  async saveCurrentNote() {
    const titleDiv = document.getElementById('note-title');
    const contentDivs = document.querySelectorAll('.note-content-line');

    if (!titleDiv) return;

    const title = titleDiv.textContent.trim() || 'Untitled';
    const contentLines = Array.from(contentDivs).map(div => div.textContent);
    const content = contentLines.join('\n').replace(/\n+$/, '');
    
    // Capture formatting data (HTML)
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

  toggleEditMode() {
    // If we're in note view, toggle the formatting toolbar
    if (this.currentView === 'note') {
      this.soundManager.play('pencil', 200);
      this.formattingManager.toggleToolbar(!this.formattingManager.isToolbarOpen);
      
      // Toggle active state on edit button
      const editBtn = document.getElementById('editModeBtn');
      if (this.formattingManager.isToolbarOpen) {
        editBtn.classList.add('active');
      } else {
        editBtn.classList.remove('active');
      }
      return;
    }
    
    // If we're in index view, use original edit mode behavior
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
    
    // Update ARIA state
    const editBtn = document.getElementById('editModeBtn');
    editBtn?.setAttribute('aria-pressed', 'true');
    
    editBtn?.classList.add('active');
    document.body.classList.add('edit-mode');
    this.highlightNotes('edit');
  }

  enterDeleteMode() {
    this.exitModes();
    this.isDeleteMode = true;
    
    // Update ARIA state
    const deleteBtn = document.getElementById('deleteModeBtn');
    deleteBtn?.setAttribute('aria-pressed', 'true');
    
    deleteBtn?.classList.add('active');
    document.body.classList.add('delete-mode');
    this.highlightNotes('delete');
  }

  exitModes() {
    this.isEditMode = this.isDeleteMode = false;
    
    // Update ARIA states
    const editBtn = document.getElementById('editModeBtn');
    const deleteBtn = document.getElementById('deleteModeBtn');
    editBtn?.setAttribute('aria-pressed', 'false');
    deleteBtn?.setAttribute('aria-pressed', 'false');
    
    editBtn?.classList.remove('active');
    deleteBtn?.classList.remove('active');
    document.body.classList.remove('edit-mode', 'delete-mode');
    this.removeHighlights();
    
    // Close formatting toolbar if open
    if (this.currentView === 'note') {
      this.formattingManager.toggleToolbar(false);
    }
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
    document.querySelectorAll('#notesList li').forEach(note => {
      note.classList.remove('highlight-edit', 'highlight-delete');
      note.style.cursor = 'default';
    });
  }

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

      // Render formatted title
      const titleFormatting = note.formatting?.find(f => f.field === 'title')?.formats || [];
      const formattedTitle = this.formattingManager.renderFormattedText(note.title, titleFormatting);
      li.innerHTML = `<div class="note-content">${formattedTitle}</div>`;
      
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
