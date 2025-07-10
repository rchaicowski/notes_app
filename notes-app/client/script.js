// ==================== SOUND MANAGER ====================
class SoundManager {
  constructor() {
    this.sounds = {
      bush: new Audio('./sounds/bush_sound.wav'),
      lamp: new Audio('./sounds/lamp_sound.wav'),
      eraser: new Audio('./sounds/eraser.wav'),
      pencil: new Audio('./sounds/pencil.wav'),
      calculator: new Audio('./sounds/calculator_button.wav')
    };

    // Set volumes
    this.sounds.bush.volume = 0.5;
    this.sounds.lamp.volume = 0.5;
    this.sounds.eraser.volume = 0.4;
    this.sounds.pencil.volume = 0.4;
    this.sounds.calculator.volume = 0.2;

    this.lastPlayed = {};
    Object.keys(this.sounds).forEach(key => {
      this.lastPlayed[key] = 0;
    });
  }

  play(soundName, minInterval = 100) {
    const now = Date.now();
    if (now - this.lastPlayed[soundName] > minInterval && this.sounds[soundName]) {
      this.sounds[soundName].currentTime = 0;
      this.sounds[soundName].play().catch(e => console.log('Sound play failed:', e));
      this.lastPlayed[soundName] = now;
    }
  }
}

// ==================== CALCULATOR CLASS ====================
class Calculator {
  constructor(soundManager) {
    this.display = '';
    this.operator = '';
    this.previous = '';
    this.waitingForOperand = false;
    this.expression = '';
    this.soundManager = soundManager;
  }

  updateDisplay() {
    const displayEl = document.getElementById('calc-display');
    if (this.expression && this.operator && !this.waitingForOperand) {
      displayEl.textContent = this.expression + this.display;
    } else if (this.expression && this.waitingForOperand) {
      displayEl.textContent = this.expression;
    } else {
      displayEl.textContent = this.display || '0';
    }
  }

  inputNumber(num) {
    this.soundManager.play('calculator');
    if (this.waitingForOperand) {
      this.display = num;
      this.waitingForOperand = false;
    } else {
      this.display = this.display === '0' ? num : this.display + num;
    }
    this.updateDisplay();
  }

  inputDecimal() {
    this.soundManager.play('calculator');
    if (this.waitingForOperand) {
      this.display = '0.';
      this.waitingForOperand = false;
    } else if (this.display.indexOf('.') === -1) {
      this.display += '.';
    }
    this.updateDisplay();
  }

  inputOperator(nextOperator) {
    this.soundManager.play('calculator');
    const inputValue = parseFloat(this.display);

    if (this.previous === '') {
      this.previous = inputValue;
      this.expression = this.display + ' ' + nextOperator + ' ';
    } else if (this.operator) {
      const currentValue = this.previous || 0;
      const newValue = this.performCalculation(currentValue, inputValue, this.operator);
      this.display = String(newValue);
      this.previous = newValue;
      this.expression = String(newValue) + ' ' + nextOperator + ' ';
    }

    this.waitingForOperand = true;
    this.operator = nextOperator;
    this.updateDisplay();
  }

  calculate() {
    this.soundManager.play('calculator');
    const inputValue = parseFloat(this.display);

    if (this.previous !== '' && this.operator) {
      this.expression = (this.expression || this.previous + ' ' + this.operator + ' ') + this.display;
      const newValue = this.performCalculation(this.previous, inputValue, this.operator);
      this.display = String(newValue);

      const displayEl = document.getElementById('calc-display');
      displayEl.textContent = this.expression + ' = ' + this.display;

      this.previous = '';
      this.operator = '';
      this.expression = '';
      this.waitingForOperand = true;
    }
  }

  performCalculation(firstOperand, secondOperand, operator) {
    switch (operator) {
      case '+': return firstOperand + secondOperand;
      case '-': return firstOperand - secondOperand;
      case '*': return firstOperand * secondOperand;
      case '/': return secondOperand !== 0 ? firstOperand / secondOperand : 0;
      default: return secondOperand;
    }
  }

  clear() {
    this.soundManager.play('calculator');
    this.display = '';
    this.operator = '';
    this.previous = '';
    this.expression = '';
    this.waitingForOperand = false;
    this.updateDisplay();
  }

  deleteLast() {
    this.soundManager.play('calculator');
    if (this.display.length > 1) {
      this.display = this.display.slice(0, -1);
    } else {
      this.display = '0';
    }
    this.updateDisplay();
  }
}

// ==================== LAMP CONTROLLER ====================
class LampController {
  constructor(soundManager) {
    this.isOn = true;
    this.timeouts = [];
    this.soundManager = soundManager;
  }

  toggle() {
    this.soundManager.play('lamp', 500);
    const powerButton = document.getElementById('power-button');
    const lampBulb = document.getElementById('lamp-bulb');
    const tableContainer = document.getElementById('table-container');

    // Clear any previously scheduled timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts = [];

    if (!this.isOn) {
      this.turnOn(powerButton, lampBulb, tableContainer);
    } else {
      this.turnOff(powerButton, lampBulb, tableContainer);
    }
  }

  turnOn(powerButton, lampBulb, tableContainer) {
    this.isOn = true;
    powerButton.className = 'lamp-power-button on';
    lampBulb.className = 'lamp-bulb on';
    tableContainer.classList.remove('dimmed');
  }

  turnOff(powerButton, lampBulb, tableContainer) {
    this.isOn = false;
    powerButton.className = 'lamp-power-button off';
    lampBulb.className = 'lamp-bulb warm-orange';
    tableContainer.classList.add('dimmed');

    this.timeouts.push(setTimeout(() => {
      if (!this.isOn) lampBulb.className = 'lamp-bulb transitioning-off';
    }, 1500));

    this.timeouts.push(setTimeout(() => {
      if (!this.isOn) lampBulb.className = 'lamp-bulb dim-orange';
    }, 3000));

    this.timeouts.push(setTimeout(() => {
      if (!this.isOn) lampBulb.className = 'lamp-bulb';
    }, 4500));
  }
}

// ==================== NOTES MANAGER ====================
class NotesManager {
  constructor(soundManager) {
    this.notes = [];
    this.currentPage = 1;
    this.notesPerPage = 12;
    this.isEditMode = false;
    this.isDeleteMode = false;
    this.apiBaseUrl = 'http://localhost:5000/api/notes';
    this.soundManager = soundManager;
  }

  async loadNotes() {
    try {
      const response = await fetch(this.apiBaseUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const serverNotes = await response.json();
      this.notes = serverNotes.map(note => ({
        id: note.id,
        content: note.content
      }));
      this.renderNotes();
    } catch (error) {
      console.error('Error loading notes:', error);
      this.notes = [];
      this.renderNotes();
    }
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
      const response = await fetch(`${this.apiBaseUrl}/${noteId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  toggleEditMode() {
    this.soundManager.play('pencil', 200);
    if (this.isEditMode) {
      this.exitModes();
    } else {
      this.enterEditMode();
    }
  }

  toggleDeleteMode() {
    this.soundManager.play('eraser', 200);
    if (this.isDeleteMode) {
      this.exitModes();
    } else {
      this.enterDeleteMode();
    }
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
    this.isEditMode = false;
    this.isDeleteMode = false;
    document.getElementById('edit-mode-btn').classList.remove('active');
    document.getElementById('delete-mode-btn').classList.remove('active');
    document.body.classList.remove('edit-mode', 'delete-mode');
    this.removeHighlights();
  }

  highlightNotes(mode) {
    // Only highlight notes on the current page
    const currentPageElement = document.getElementById(`page-${this.currentPage}`);
    if (currentPageElement) {
      const noteElements = currentPageElement.querySelectorAll('li');
      noteElements.forEach(note => {
        note.classList.add(`highlight-${mode}`);
        note.style.cursor = 'pointer';
      });
    }
  }

  removeHighlights() {
    const noteElements = document.querySelectorAll('#notes-list li');
    noteElements.forEach(note => {
      note.classList.remove('highlight-edit', 'highlight-delete');
      note.style.cursor = 'default';
    });
  }

  renderNotes() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    const currentNotes = this.getNotesForPage(this.currentPage);

    const pageDiv = document.createElement('div');
    pageDiv.className = 'notes-page active';
    pageDiv.id = `page-${this.currentPage}`;

    currentNotes.forEach((note, index) => {
      const globalIndex = (this.currentPage - 1) * this.notesPerPage + index;
      const li = document.createElement('li');
      li.dataset.id = globalIndex;
      li.dataset.page = this.currentPage;
      li.innerHTML = `<div class="note-content">${note.content}</div>`;

      pageDiv.appendChild(li);
    });

    list.appendChild(pageDiv);

    // Update click events
    list.removeEventListener('click', this.handleNoteClick);
    this.handleNoteClick = (e) => {
      const li = e.target.closest('li');
      if (!li || !li.dataset.id) return;
      this.selectNote(li);
    };
    list.addEventListener('click', this.handleNoteClick);

    this.updatePageInfo();

    // Reapply highlights if necessary
    if (this.isEditMode) {
      this.highlightNotes('edit');
    } else if (this.isDeleteMode) {
      this.highlightNotes('delete');
    }
  }

  getTotalPages() {
    return Math.ceil(this.notes.length / this.notesPerPage);
  }

  getNotesForPage(page) {
    const startIndex = (page - 1) * this.notesPerPage;
    const endIndex = startIndex + this.notesPerPage;
    return this.notes.slice(startIndex, endIndex);
  }

  updatePageInfo() {
    const totalPages = this.getTotalPages();
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (totalPages === 0) {
      pageInfo.textContent = 'No pages';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    prevBtn.disabled = this.currentPage === 1;
    nextBtn.disabled = this.currentPage === totalPages;
  }

  selectNote(noteElement) {
    const globalIndex = parseInt(noteElement.dataset.id);
    const notePage = parseInt(noteElement.dataset.page);

    if (notePage !== this.currentPage) {
      console.warn('Attempted to select note from non-current page');
      return;
    }

    const note = this.notes[globalIndex];

    if (!note) {
      console.error('Note not found at index:', globalIndex);
      return;
    }

    if (this.isEditMode) {
      this.editNote(globalIndex, note.content);
      this.exitModes();
    } else if (this.isDeleteMode) {
      this.deleteNoteById(globalIndex, noteElement);
      this.exitModes();
    }
  }

  editNote(noteId, content) {
    document.getElementById('content').value = content;
    document.getElementById('note-form').dataset.editing = noteId;
    document.getElementById('content').focus();
  }

  async deleteNoteById(index, listItem) {
    const noteToDelete = this.notes[index];
    try {
      await this.deleteNote(noteToDelete.id);
      this.notes.splice(index, 1);

      // Handle page adjustment if current page becomes empty
      const totalPages = this.getTotalPages();
      if (this.currentPage > totalPages && totalPages > 0) {
        this.currentPage = totalPages;
      }

      this.renderNotes();
    } catch (error) {
      alert('Failed to delete note. Please try again.');
    }
  }

  changePage(direction) {
    const totalPages = this.getTotalPages();

    if (direction === 'next' && this.currentPage < totalPages) {
      this.currentPage++;
    } else if (direction === 'prev' && this.currentPage > 1) {
      this.currentPage--;
    } else {
      return;
    }

    const notepad = document.querySelector('.notepad');
    notepad.classList.add('page-flip-animation');

    setTimeout(() => {
      this.renderNotes();
      notepad.classList.remove('page-flip-animation');
    }, 200);
  }

  async handleAddOrUpdate() {
    const content = document.getElementById('content').value.trim();
    const noteForm = document.getElementById('note-form');
    const editingId = noteForm.dataset.editing;

    if (!content) return;

    try {
      if (editingId !== undefined && editingId !== '') {
        const noteIndex = parseInt(editingId);
        const serverNoteId = this.notes[noteIndex].id;
        const updatedNote = await this.saveNote({ content }, true, serverNoteId);
        this.notes[noteIndex] = { id: updatedNote.id, content: updatedNote.content };
        noteForm.removeAttribute('data-editing');
      } else {
        const newNote = await this.saveNote({ content });
        this.notes.push({ id: newNote.id, content: newNote.content });
      }

      this.renderNotes();
      noteForm.reset();

      if (editingId === undefined || editingId === '') {
        const totalPages = this.getTotalPages();
        if (this.currentPage !== totalPages) {
          this.currentPage = totalPages;
        }
      }
    } catch (error) {
      alert('Failed to save note. Please try again.');
    }
  }
}

// ==================== APP INITIALIZATION ====================
class NotesApp {
  constructor() {
    this.soundManager = new SoundManager();
    this.calculator = new Calculator(this.soundManager);
    this.lamp = new LampController(this.soundManager);
    this.notesManager = new NotesManager(this.soundManager);

    this.init();
  }

  init() {
    // Initialize components
    this.calculator.updateDisplay();
    this.notesManager.loadNotes();
    this.setupEventListeners();
    this.setupPlantSound();
  }

  setupPlantSound() {
    const plantGroup = document.getElementById('plantGroup');
    if (plantGroup) {
      plantGroup.addEventListener('mouseenter', () => {
        this.soundManager.play('bush', 300);
      });
    }
  }

  setupEventListeners() {
    // Calculator events
    document.getElementById('edit-mode-btn').addEventListener('click',
      () => this.notesManager.toggleEditMode());
    document.getElementById('delete-mode-btn').addEventListener('click',
      () => this.notesManager.toggleDeleteMode());
    document.getElementById('add-btn').addEventListener('click',
      () => this.notesManager.handleAddOrUpdate());
    document.getElementById('prev-page').addEventListener('click',
      () => this.notesManager.changePage('prev'));
    document.getElementById('next-page').addEventListener('click',
      () => this.notesManager.changePage('next'));

    // Input events
    document.getElementById('content').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.notesManager.handleAddOrUpdate();
      }
    });

    // Global events
    document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
  }

  handleGlobalKeydown(e) {
    if (e.key === 'Escape') {
      const noteForm = document.getElementById('note-form');
      if (noteForm.dataset.editing) {
        noteForm.reset();
        noteForm.removeAttribute('data-editing');
      } else if (this.notesManager.isEditMode || this.notesManager.isDeleteMode) {
        this.notesManager.exitModes();
      }
    } else if (e.key === 'ArrowLeft' && !e.target.matches('input')) {
      this.notesManager.changePage('prev');
    } else if (e.key === 'ArrowRight' && !e.target.matches('input')) {
      this.notesManager.changePage('next');
    }
  }
}

// ==================== GLOBAL FUNCTIONS (for HTML onclick) ====================
let app;

// Calculator functions
function inputNumber(num) { app.calculator.inputNumber(num); }
function inputOperator(op) { app.calculator.inputOperator(op); }
function inputDecimal() { app.calculator.inputDecimal(); }
function calculate() { app.calculator.calculate(); }
function clearCalculator() { app.calculator.clear(); }
function deleteLast() { app.calculator.deleteLast(); }
function toggleLamp() { app.lamp.toggle(); }

// ==================== START APP ====================
window.addEventListener('DOMContentLoaded', () => {
  app = new NotesApp();
});
