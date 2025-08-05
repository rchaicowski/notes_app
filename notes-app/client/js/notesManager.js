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
  }

  async loadNotes() {
    if (this.storageManager.isOnline) {
      try {
        const response = await fetch(this.apiBaseUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        this.notes = (await response.json()).map(note => ({ id: note.id, content: note.content }));
        this.renderNotes();
      } catch (error) {
        console.error('Error loading notes:', error);
        this.fallbackToLocalNotes();
      }
    } else this.fallbackToLocalNotes();
  }

  fallbackToLocalNotes() {
    this.notes = this.storageManager.getFromLocalStorage();
    this.renderNotes();
  }

  async saveNote(noteData, isUpdate = false, noteId = null) {
    try {
      const options = {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteData.content })
      };
      const url = isUpdate ? `${this.apiBaseUrl}/${noteId}` : this.apiBaseUrl;
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
    }
  }

  async deleteNote(noteId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${noteId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

  getTotalPages() { return Math.ceil(this.notes.length / this.notesPerPage); }
  getNotesForPage(page) { return this.notes.slice((page - 1) * this.notesPerPage, page * this.notesPerPage); }

  updatePageInfo() {
    const totalPages = this.getTotalPages();
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    if (totalPages === 0) {
      pageInfo.textContent = 'No pages';
      prevBtn.disabled = nextBtn.disabled = true;
      return;
    }
    pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    prevBtn.disabled = this.currentPage === 1;
    nextBtn.disabled = this.currentPage === totalPages;
  }

  selectNote(noteEl) {
    const idx = parseInt(noteEl.dataset.id);
    const note = this.notes[idx];
    if (!note) return;
    if (this.isEditMode) { this.editNote(idx, note.content); this.exitModes(); }
    else if (this.isDeleteMode) { this.deleteNoteById(idx); this.exitModes(); }
  }

  editNote(id, content) {
    document.getElementById('content').value = content;
    document.getElementById('note-form').dataset.editing = id;
    document.getElementById('content').focus();
  }

  async deleteNoteById(index) {
    const note = this.notes[index];
    try {
      await this.storageManager.deleteNote(note.id);
      this.notes.splice(index, 1);
      if (this.currentPage > this.getTotalPages()) this.currentPage = this.getTotalPages();
      this.renderNotes();
    } catch (error) {
      alert('Failed to delete note.');
    }
  }

  changePage(direction) {
    const total = this.getTotalPages();
    if ((direction === 'next' && this.currentPage < total) ||
        (direction === 'prev' && this.currentPage > 1)) {
      this.currentPage += (direction === 'next' ? 1 : -1);
    } else return;

    const notepad = document.querySelector('.notepad');
    notepad.classList.add('page-flip-animation');
    setTimeout(() => { this.renderNotes(); notepad.classList.remove('page-flip-animation'); }, 200);
  }

  async handleAddOrUpdate() {
    const content = document.getElementById('content').value.trim();
    const form = document.getElementById('note-form');
    const editingId = form.dataset.editing;
    if (!content) return;

    try {
      if (editingId) {
        const idx = parseInt(editingId);
        const note = this.notes[idx];
        if (this.storageManager.isOnline) {
          const updated = await this.saveNote({ content }, true, note.id);
          this.notes[idx] = { id: updated.id, content: updated.content };
        } else { note.content = content; await this.storageManager.saveNote(note); }
        form.removeAttribute('data-editing');
      } else {
        const newNote = { content };
        if (this.storageManager.isOnline) this.notes.push(await this.saveNote(newNote));
        else { newNote.id = Date.now(); await this.storageManager.saveNote(newNote); this.notes.push(newNote); }
        this.currentPage = this.getTotalPages();
      }
      this.renderNotes();
      form.reset();
    } catch { alert('Failed to save note.'); }
  }
}
