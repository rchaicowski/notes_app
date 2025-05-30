// Global state variables
let isEditMode = false;
let isDeleteMode = false;
let notes = [];

// Load all notes on page load
function loadNotes() {
  fetch('http://localhost:5000/api/notes')
    .then(response => response.json())
    .then(data => {
      notes = data;
      renderNotes();
    })
    .catch(err => {
      console.error('Failed to fetch notes:', err);
    });
}

// Render notes in the list
function renderNotes() {
  const list = document.getElementById('notes-list');
  list.innerHTML = '';
  
  notes.forEach(note => {
    const li = document.createElement('li');
    li.dataset.id = note.id;
    li.innerHTML = `
      <div class="note-content">${note.content}</div>
    `;

    // Add click event for note selection in modes
    li.addEventListener('click', function(e) {
      if (isEditMode || isDeleteMode) {
        e.preventDefault();
        selectNote(this);
      }
    });

    list.appendChild(li);
  });
}

// Select note in edit/delete mode
function selectNote(noteElement) {
  const noteId = noteElement.dataset.id;
  const note = notes.find(n => n.id == noteId);
  
  if (isEditMode) {
    editNote(noteId, note.content);
    exitModes();
  } else if (isDeleteMode) {
    if (confirm(`Are you sure you want to delete this note: "${note.content}"?`)) {
      deleteNote(noteId, noteElement);
      exitModes();
    }
  }
}

// Edit mode toggle
document.getElementById('edit-mode-btn').addEventListener('click', function() {
  if (isEditMode) {
    exitModes();
  } else {
    enterEditMode();
  }
});

// Delete mode toggle
document.getElementById('delete-mode-btn').addEventListener('click', function() {
  if (isDeleteMode) {
    exitModes();
  } else {
    enterDeleteMode();
  }
});

// Enter edit mode
function enterEditMode() {
  exitModes(); // Exit any current mode first
  isEditMode = true;
  document.getElementById('edit-mode-btn').classList.add('active');
  document.body.classList.add('edit-mode');
  highlightNotes('edit');
}

// Enter delete mode
function enterDeleteMode() {
  exitModes(); // Exit any current mode first
  isDeleteMode = true;
  document.getElementById('delete-mode-btn').classList.add('active');
  document.body.classList.add('delete-mode');
  highlightNotes('delete');
}

// Exit all modes
function exitModes() {
  isEditMode = false;
  isDeleteMode = false;
  document.getElementById('edit-mode-btn').classList.remove('active');
  document.getElementById('delete-mode-btn').classList.remove('active');
  document.body.classList.remove('edit-mode', 'delete-mode');
  removeHighlights();
}

// Highlight notes based on mode
function highlightNotes(mode) {
  const notes = document.querySelectorAll('#notes-list li');
  notes.forEach(note => {
    note.classList.add(`highlight-${mode}`);
    note.style.cursor = 'pointer';
  });
}

// Remove highlights
function removeHighlights() {
  const notes = document.querySelectorAll('#notes-list li');
  notes.forEach(note => {
    note.classList.remove('highlight-edit', 'highlight-delete');
    note.style.cursor = 'default';
  });
}

// Edit note function
function editNote(noteId, content) {
  document.getElementById('content').value = content;
  document.getElementById('note-form').dataset.editing = noteId;
  document.getElementById('content').focus();
}

// Handle the ADD button click (adds a new note or updates existing)
document.getElementById('add-btn').addEventListener('click', function () {
  const content = document.getElementById('content').value.trim();
  const editingId = document.getElementById('note-form').dataset.editing;

  if (!content) return;

  if (editingId) {
    // UPDATE existing note
    fetch(`http://localhost:5000/api/notes/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
      .then(response => response.json())
      .then(note => {
        // Update the note in the local array
        const index = notes.findIndex(n => n.id == editingId);
        if (index !== -1) {
          notes[index] = note;
        }
        renderNotes();
        document.getElementById('note-form').reset();
        document.getElementById('note-form').removeAttribute('data-editing');
      })
      .catch(err => console.error('Error updating note:', err));
  } else {
    // ADD new note
    fetch('http://localhost:5000/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
      .then(response => response.json())
      .then(note => {
        notes.push(note);
        renderNotes();
        document.getElementById('note-form').reset();
      })
      .catch(err => console.error('Error saving note:', err));
  }
});

// Delete function
function deleteNote(id, listItem) {
  fetch(`http://localhost:5000/api/notes/${id}`, { method: 'DELETE' })
    .then(response => {
      if (!response.ok) throw new Error('Delete failed');
      return response.json();
    })
    .then(() => {
      // Remove from local array
      notes = notes.filter(note => note.id != id);
      listItem.remove();
    })
    .catch(err => {
      console.error('Error deleting note:', err);
    });
}

// Handle Enter key in input field
document.getElementById('content').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    document.getElementById('add-btn').click();
  }
});

// Handle Escape key to cancel editing or exit modes
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (document.getElementById('note-form').dataset.editing) {
      // Cancel editing
      document.getElementById('note-form').reset();
      document.getElementById('note-form').removeAttribute('data-editing');
    } else if (isEditMode || isDeleteMode) {
      // Exit modes
      exitModes();
    }
  }
});

// Initialize the app
loadNotes();
