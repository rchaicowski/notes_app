// Calculator variables
let calcDisplay = '';
let calcOperator = '';
let calcPrevious = '';
let calcWaitingForOperand = false;
let calcExpression = ''; 

// Notes variables
let isEditMode = false;
let isDeleteMode = false;
let notes = [];
let currentPage = 1;
const notesPerPage = 12;

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api/notes'; 

// Lamp toggle function
let lampOn = true;
let lampTimeouts = [];

function toggleLamp() {
  const powerButton = document.getElementById('power-button');
  const lampBulb = document.getElementById('lamp-bulb');
  const tableContainer = document.getElementById('table-container');

  // Clear any previously scheduled timeouts
  lampTimeouts.forEach(timeout => clearTimeout(timeout));
  lampTimeouts = [];

  if (!lampOn) {
    // Turning ON - immediate bright effect
    lampOn = true;
    powerButton.className = 'lamp-power-button on';
    lampBulb.className = 'lamp-bulb on';
    tableContainer.classList.remove('dimmed');
  } else {
    // Turning OFF - multi-stage 5 second transition
    lampOn = false;
    powerButton.className = 'lamp-power-button off';
    lampBulb.className = 'lamp-bulb warm-orange';

    // Immediate dim the table
    tableContainer.classList.add('dimmed');

    lampTimeouts.push(setTimeout(() => {
      if (!lampOn) {
        lampBulb.className = 'lamp-bulb transitioning-off';
      }
    }, 1500));

    lampTimeouts.push(setTimeout(() => {
      if (!lampOn) {
        lampBulb.className = 'lamp-bulb dim-orange';
      }
    }, 3000));

    lampTimeouts.push(setTimeout(() => {
      if (!lampOn) {
        lampBulb.className = 'lamp-bulb';
      }
    }, 4500));
  }
}

window.addEventListener('DOMContentLoaded', function () {
  const powerButton = document.getElementById('power-button');
  const lampBulb = document.getElementById('lamp-bulb');

  powerButton.className = 'lamp-power-button on';
  lampBulb.className = 'lamp-bulb on';
});

// Calculator functions
function updateDisplay() {
  const display = document.getElementById('calc-display');

  if (calcExpression && calcOperator && !calcWaitingForOperand) {
    display.textContent = calcExpression + calcDisplay;
  } else if (calcExpression && calcWaitingForOperand) {
    display.textContent = calcExpression;
  } else {
    display.textContent = calcDisplay || '0';
  }
}

function inputNumber(num) {
  if (calcWaitingForOperand) {
    calcDisplay = num;
    calcWaitingForOperand = false;
  } else {
    calcDisplay = calcDisplay === '0' ? num : calcDisplay + num;
  }
  updateDisplay();
}

function inputDecimal() {
  if (calcWaitingForOperand) {
    calcDisplay = '0.';
    calcWaitingForOperand = false;
  } else if (calcDisplay.indexOf('.') === -1) {
    calcDisplay += '.';
  }
  updateDisplay();
}

function inputOperator(nextOperator) {
  const inputValue = parseFloat(calcDisplay);

  if (calcPrevious === '') {
    calcPrevious = inputValue;
    calcExpression = calcDisplay + ' ' + nextOperator + ' ';
  } else if (calcOperator) {
    const currentValue = calcPrevious || 0;
    const newValue = performCalculation(currentValue, inputValue, calcOperator);

    calcDisplay = String(newValue);
    calcPrevious = newValue;
    calcExpression = String(newValue) + ' ' + nextOperator + ' ';
  }

  calcWaitingForOperand = true;
  calcOperator = nextOperator;
  updateDisplay();
}

function calculate() {
  const inputValue = parseFloat(calcDisplay);

  if (calcPrevious !== '' && calcOperator) {
    // Complete the expression before calculating
    calcExpression = (calcExpression || calcPrevious + ' ' + calcOperator + ' ') + calcDisplay;

    const newValue = performCalculation(calcPrevious, inputValue, calcOperator);
    calcDisplay = String(newValue);

    // Show the full expression first, then after a brief moment show the result
    const display = document.getElementById('calc-display');
    display.textContent = calcExpression + ' = ' + calcDisplay;

    // Reset for next calculation
    calcPrevious = '';
    calcOperator = '';
    calcExpression = '';
    calcWaitingForOperand = true;
  }
}

function performCalculation(firstOperand, secondOperand, operator) {
  switch (operator) {
    case '+':
      return firstOperand + secondOperand;
    case '-':
      return firstOperand - secondOperand;
    case '*':
      return firstOperand * secondOperand;
    case '/':
      return secondOperand !== 0 ? firstOperand / secondOperand : 0;
    default:
      return secondOperand;
  }
}

function clearCalculator() {
  calcDisplay = '';
  calcOperator = '';
  calcPrevious = '';
  calcExpression = '';
  calcWaitingForOperand = false;
  updateDisplay();
}

function deleteLast() {
  if (calcDisplay.length > 1) {
    calcDisplay = calcDisplay.slice(0, -1);
  } else {
    calcDisplay = '0';
  }
  updateDisplay();
}

// Notes API Functions
async function loadNotes() {
  try {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const serverNotes = await response.json();

    // Map server notes to your frontend format
    notes = serverNotes.map(note => ({
      id: note.id,
      content: note.content
    }));

    renderNotes();
  } catch (error) {
    console.error('❌ Error loading notes:', error);
    // Fallback to empty array if server is unreachable
    notes = [];
    renderNotes();
  }
}

async function saveNote(noteData, isUpdate = false, noteId = null) {
  try {
    let response;

    if (isUpdate && noteId !== null) {
      // UPDATE existing note
      response = await fetch(`${API_BASE_URL}/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: noteData.content })
      });
    } else {
      // CREATE new note
      response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: noteData.content })
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const savedNote = await response.json();
    return savedNote;

  } catch (error) {
    console.error('❌ Error saving note:', error);
    throw error;
  }
}

async function deleteNoteFromServer(noteId) {
  try {
    const response = await fetch(`${API_BASE_URL}/${noteId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('❌ Error deleting note:', error);
    throw error;
  }
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  const totalPages = getTotalPages();

  // Clear existing content
  list.innerHTML = '';

  if (notes.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-page';
    emptyDiv.textContent = 'No notes yet. Add your first note!';
    list.appendChild(emptyDiv);
    updatePageInfo();
    return;
  }

  // Create pages
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'notes-page';
    pageDiv.id = `page-${pageNum}`;

    if (pageNum === currentPage) {
      pageDiv.classList.add('active');
    }

    const pageNotes = getNotesForPage(pageNum);

    pageNotes.forEach((note, index) => {
      const globalIndex = (pageNum - 1) * notesPerPage + index;
      const li = document.createElement('li');
      li.dataset.id = globalIndex;
      li.innerHTML = `<div class="note-content">${note.content}</div>`;

      li.addEventListener('click', function (e) {
        if (isEditMode || isDeleteMode) {
          e.preventDefault();
          selectNote(this);
        }
      });

      pageDiv.appendChild(li);
    });

    list.appendChild(pageDiv);
  }

  updatePageInfo();
}

function getTotalPages() {
  return Math.ceil(notes.length / notesPerPage);
}

function getNotesForPage(page) {
  const startIndex = (page - 1) * notesPerPage;
  const endIndex = startIndex + notesPerPage;
  return notes.slice(startIndex, endIndex);
}

function updatePageInfo() {
  const totalPages = getTotalPages();
  const pageInfo = document.getElementById('page-info');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  if (totalPages === 0) {
    pageInfo.textContent = 'No pages';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
}

function changePage(direction) {
  const totalPages = getTotalPages();
  const currentPageElement = document.getElementById(`page-${currentPage}`);

  if (direction === 'next' && currentPage < totalPages) {
    currentPageElement.classList.remove('active');
    currentPageElement.classList.add('previous');
    currentPage++;
  } else if (direction === 'prev' && currentPage > 1) {
    currentPageElement.classList.remove('active');
    currentPageElement.classList.add('previous');
    currentPage--;
  } else {
    return;
  }

  // Add page flip animation
  const notepad = document.querySelector('.notepad');
  notepad.classList.add('page-flip-animation');

  setTimeout(() => {
    const newPageElement = document.getElementById(`page-${currentPage}`);
    if (newPageElement) {
      newPageElement.classList.remove('previous');
      newPageElement.classList.add('active');
    }

    notepad.classList.remove('page-flip-animation');

    // Clean up previous page states
    document.querySelectorAll('.notes-page').forEach(page => {
      if (!page.classList.contains('active')) {
        page.classList.remove('previous');
      }
    });
  }, 200);

  updatePageInfo();
}

function selectNote(noteElement) {
  const noteId = noteElement.dataset.id;
  const note = notes[noteId];

  if (isEditMode) {
    editNote(noteId, note.content);
    exitModes();
  } else if (isDeleteMode) {
    deleteNote(noteId, noteElement);
    exitModes();
  }
}

// Edit mode toggle
function toggleEditMode() {
  if (isEditMode) {
    exitModes();
  } else {
    enterEditMode();
  }
}

// Delete mode toggle
function toggleDeleteMode() {
  if (isDeleteMode) {
    exitModes();
  } else {
    enterDeleteMode();
  }
}

function enterEditMode() {
  exitModes();
  isEditMode = true;
  document.getElementById('edit-mode-btn').classList.add('active');
  document.body.classList.add('edit-mode');
  highlightNotes('edit');
}

function enterDeleteMode() {
  exitModes();
  isDeleteMode = true;
  document.getElementById('delete-mode-btn').classList.add('active');
  document.body.classList.add('delete-mode');
  highlightNotes('delete');
}

function exitModes() {
  isEditMode = false;
  isDeleteMode = false;
  document.getElementById('edit-mode-btn').classList.remove('active');
  document.getElementById('delete-mode-btn').classList.remove('active');
  document.body.classList.remove('edit-mode', 'delete-mode');
  removeHighlights();
}

function highlightNotes(mode) {
  const noteElements = document.querySelectorAll('#notes-list li');
  noteElements.forEach(note => {
    note.classList.add(`highlight-${mode}`);
    note.style.cursor = 'pointer';
  });
}

function removeHighlights() {
  const noteElements = document.querySelectorAll('#notes-list li');
  noteElements.forEach(note => {
    note.classList.remove('highlight-edit', 'highlight-delete');
    note.style.cursor = 'default';
  });
}

function editNote(noteId, content) {
  document.getElementById('content').value = content;
  document.getElementById('note-form').dataset.editing = noteId;
  document.getElementById('content').focus();
}

// Centralized function to handle both add and update operations
async function handleAddOrUpdate() {
  const content = document.getElementById('content').value.trim();
  const noteForm = document.getElementById('note-form');
  const editingId = noteForm.dataset.editing;

  if (!content) return;

  try {
    if (editingId !== undefined && editingId !== '') {
      // UPDATE existing note
      const noteIndex = parseInt(editingId);
      const serverNoteId = notes[noteIndex].id;

      const updatedNote = await saveNote({ content }, true, serverNoteId);
      notes[noteIndex] = { id: updatedNote.id, content: updatedNote.content };

      // Clear the editing state
      noteForm.removeAttribute('data-editing');
    } else {
      // ADD new note
      const newNote = await saveNote({ content });
      notes.push({ id: newNote.id, content: newNote.content });
    }

    renderNotes();
    noteForm.reset();

  } catch (error) {
    alert('Failed to save note. Please try again.');
  }

  if (editingId === undefined || editingId === '') {
    // Navigate to the last page where the new note was added
    const totalPages = getTotalPages();
    if (currentPage !== totalPages) {
      currentPage = totalPages;
    }
  }
}

// Handle the ADD button click
function handleAddButtonClick() {
  handleAddOrUpdate();
}

// Delete function - WITH API INTEGRATION
async function deleteNote(index, listItem) {
  const noteToDelete = notes[index];

  try {
    await deleteNoteFromServer(noteToDelete.id);
    notes.splice(index, 1);
    renderNotes();
  } catch (error) {
    alert('Failed to delete note. Please try again.');
  }
}

// Handle Enter key in input field
function handleContentKeypress(e) {
  if (e.key === 'Enter') {
    e.preventDefault(); // Prevent any default behavior
    handleAddOrUpdate(); // Use the same function as the button click
  }
}

// Handle Escape key to cancel editing or exit modes + Arrow key navigation
function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    const noteForm = document.getElementById('note-form');
    if (noteForm.dataset.editing) {
      // Cancel editing
      noteForm.reset();
      noteForm.removeAttribute('data-editing');
    } else if (isEditMode || isDeleteMode) {
      // Exit modes
      exitModes();
    }
  }
  // Arrow key navigation (only when not typing in input)
  else if (e.key === 'ArrowLeft' && !e.target.matches('input')) {
    changePage('prev');
  } else if (e.key === 'ArrowRight' && !e.target.matches('input')) {
    changePage('next');
  }
}

// Initialize the app
loadNotes(); 
updateDisplay();

// ==================== EVENT LISTENERS ====================

// DOM Content Loaded
window.addEventListener('DOMContentLoaded', function () {
  const powerButton = document.getElementById('power-button');
  const lampBulb = document.getElementById('lamp-bulb');

  powerButton.className = 'lamp-power-button on';
  lampBulb.className = 'lamp-bulb on';
});

// Button Click Events
document.getElementById('edit-mode-btn').addEventListener('click', toggleEditMode);
document.getElementById('delete-mode-btn').addEventListener('click', toggleDeleteMode);
document.getElementById('add-btn').addEventListener('click', handleAddButtonClick);
document.getElementById('prev-page').addEventListener('click', () => changePage('prev'));
document.getElementById('next-page').addEventListener('click', () => changePage('next'));

// Input Events
document.getElementById('content').addEventListener('keypress', handleContentKeypress);

// Global Events
document.addEventListener('keydown', handleGlobalKeydown);
