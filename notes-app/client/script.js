// Load all notes on page load
fetch('http://localhost:5000/api/notes')
  .then(response => response.json())
  .then(data => {
    const list = document.getElementById('notes-list');
    data.forEach(note => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${note.title}</strong>: ${note.content}
        <button data-id="${note.id}" class="delete-btn">🗑️ Delete</button>
        <button data-id="${note.id}" data-title="${note.title}" data-content="${note.content}" class="edit-btn">✏️ Edit</button>
      `;

      // DELETE logic
      li.querySelector('.delete-btn').addEventListener('click', function () {
        const noteId = this.dataset.id;
        deleteNote(noteId, li);
      });

      // EDIT logic
      li.querySelector('.edit-btn').addEventListener('click', function () {
        const noteId = this.dataset.id;
        const title = this.dataset.title;
        const content = this.dataset.content;

        document.getElementById('title').value = title;
        document.getElementById('content').value = content;
        document.getElementById('note-form').dataset.editing = noteId; // mark as editing
      });

      list.appendChild(li);
    });
  })
  .catch(err => {
    console.error('Failed to fetch notes:', err);
  });

// Handle form submit (create OR update)
document.getElementById('note-form').addEventListener('submit', function (e) {
  e.preventDefault();

  const title = document.getElementById('title').value.trim();
  const content = document.getElementById('content').value.trim();
  const editingId = this.dataset.editing;

  if (!title || !content) return;

  const url = editingId
    ? `http://localhost:5000/api/notes/${editingId}`
    : 'http://localhost:5000/api/notes';

  const method = editingId ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, content })
  })
    .then(response => response.json())
    .then(note => {
      const list = document.getElementById('notes-list');

      // If editing, remove old <li>
      if (editingId) {
        const oldItem = document.querySelector(`[data-id="${editingId}"]`).parentElement;
        oldItem.remove();
      }

      // Create new <li>
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${note.title}</strong>: ${note.content}
        <button data-id="${note.id}" class="delete-btn">🗑️ Delete</button>
        <button data-id="${note.id}" data-title="${note.title}" data-content="${note.content}" class="edit-btn">✏️ Edit</button>
      `;

      // Add delete listener
      li.querySelector('.delete-btn').addEventListener('click', function () {
        const noteId = this.dataset.id;
        deleteNote(noteId, li);
      });

      // Add edit listener
      li.querySelector('.edit-btn').addEventListener('click', function () {
        const noteId = this.dataset.id;
        const title = this.dataset.title;
        const content = this.dataset.content;

        document.getElementById('title').value = title;
        document.getElementById('content').value = content;
        document.getElementById('note-form').dataset.editing = noteId;
      });

      list.appendChild(li);

      // Clear form
      document.getElementById('note-form').reset();
      delete this.dataset.editing; // exit edit mode
    })
    .catch(err => console.error('Error saving note:', err));
});

// Delete function
function deleteNote(id, listItem) {
  fetch(`http://localhost:5000/api/notes/${id}`, {
    method: 'DELETE'
  })
    .then(response => {
      if (!response.ok) throw new Error('Delete failed');
      return response.json();
    })
    .then(() => {
      listItem.remove();
    })
    .catch(err => {
      console.error('Error deleting note:', err);
    });
}
