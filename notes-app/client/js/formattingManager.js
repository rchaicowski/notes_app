export class FormattingManager {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.isToolbarOpen = false;
    this.activeFormatting = new Set();
    this.highlightColors = ['yellow', 'green', 'pink', 'blue', 'orange'];
    this.currentHighlightColor = 'yellow';
  }

  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'formatting-toolbar hidden';
    toolbar.id = 'formatting-toolbar';
    
    toolbar.innerHTML = `
      <div class="toolbar-header">
        <span class="toolbar-title">Format</span>
        <button class="toolbar-close" id="toolbar-close">×</button>
      </div>
      <div class="toolbar-content">
        <div class="format-buttons-row">
          <button class="format-btn" data-format="bold" title="Bold">
            <strong>B</strong>
          </button>
          <button class="format-btn" data-format="italic" title="Italic">
            <em>I</em>
          </button>
          <button class="format-btn" data-format="underline" title="Underline">
            <u>U</u>
          </button>
        </div>
        <div class="highlight-section">
          <div class="highlight-label">Highlight:</div>
          <div class="highlight-colors">
            ${this.highlightColors.map(color => `
              <button class="highlight-btn ${color === 'yellow' ? 'active' : ''}" 
                      data-color="${color}" 
                      style="background-color: ${color};"
                      title="Highlight ${color}">
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    return toolbar;
  }

  toggleToolbar(show) {
    const toolbar = document.getElementById('formatting-toolbar');
    if (!toolbar) return;

    if (show) {
      toolbar.classList.remove('hidden');
      this.isToolbarOpen = true;
      this.soundManager.play('pencil', 150);
    } else {
      toolbar.classList.add('hidden');
      this.isToolbarOpen = false;
    }
  }

  initializeToolbar() {
    const notepad = document.querySelector('.notepad');
    if (!notepad) return;

    // Check if toolbar already exists
    let toolbar = document.getElementById('formatting-toolbar');
    if (!toolbar) {
      toolbar = this.createToolbar();
      notepad.parentElement.appendChild(toolbar);
    }

    // Close button
    const closeBtn = toolbar.querySelector('#toolbar-close');
    closeBtn.addEventListener('click', () => {
      this.toggleToolbar(false);
    });

    // Format buttons
    const formatBtns = toolbar.querySelectorAll('.format-btn');
    formatBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const format = btn.dataset.format;
        this.applyFormatting(format);
        this.soundManager.play('pencil', 100);
      });
    });

    // Highlight color buttons
    const highlightBtns = toolbar.querySelectorAll('.highlight-btn');
    highlightBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // Update active state
        highlightBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.currentHighlightColor = btn.dataset.color;
        this.applyFormatting('highlight', this.currentHighlightColor);
        this.soundManager.play('pencil', 100);
      });
    });
  }

  applyFormatting(type, color = null) {
    const activeInput = document.activeElement;
    
    // Check if we're in a note input field
    if (!activeInput || (!activeInput.classList.contains('note-content-line') && 
                         !activeInput.classList.contains('note-title-input'))) {
      return;
    }

    const start = activeInput.selectionStart;
    const end = activeInput.selectionEnd;

    // No text selected
    if (start === end) {
      return;
    }

    // Get the input's current formatting data
    if (!activeInput.formattingData) {
      activeInput.formattingData = [];
    }

    // Create new formatting entry
    const formatting = {
      start: start,
      end: end,
      type: type
    };

    if (type === 'highlight') {
      formatting.color = color || this.currentHighlightColor;
    }

    // Add to formatting data
    activeInput.formattingData.push(formatting);

    // Apply visual formatting
    this.updateInputFormatting(activeInput);
  }

  updateInputFormatting(input) {
    if (!input.formattingData || input.formattingData.length === 0) {
      return;
    }

    // Store original value and selection
    const originalValue = input.value;
    const originalStart = input.selectionStart;
    const originalEnd = input.selectionEnd;

    // Create a visual representation (this is simplified)
    // In a real implementation, you'd need a more sophisticated approach
    // possibly using contenteditable divs or a rich text editor

    // For now, we'll store the formatting in a data attribute
    input.dataset.formatting = JSON.stringify(input.formattingData);

    // Restore selection
    input.setSelectionRange(originalStart, originalEnd);
  }

  getFormattingForNote(noteElement) {
    const formatting = [];
    
    // Get title formatting
    const titleInput = noteElement.querySelector('#note-title');
    if (titleInput && titleInput.formattingData) {
      formatting.push({
        field: 'title',
        formats: titleInput.formattingData
      });
    }

    // Get content formatting
    const contentInputs = noteElement.querySelectorAll('.note-content-line');
    contentInputs.forEach((input, lineIndex) => {
      if (input.formattingData && input.formattingData.length > 0) {
        formatting.push({
          field: 'content',
          line: lineIndex,
          formats: input.formattingData
        });
      }
    });

    return formatting;
  }

  applyFormattingToNote(noteElement, formattingData) {
    if (!formattingData || formattingData.length === 0) return;

    formattingData.forEach(item => {
      if (item.field === 'title') {
        const titleInput = noteElement.querySelector('#note-title');
        if (titleInput) {
          titleInput.formattingData = item.formats;
          this.updateInputFormatting(titleInput);
        }
      } else if (item.field === 'content') {
        const contentInputs = noteElement.querySelectorAll('.note-content-line');
        const input = contentInputs[item.line];
        if (input) {
          input.formattingData = item.formats;
          this.updateInputFormatting(input);
        }
      }
    });
  }

  // Helper to render formatted text for display in index
  renderFormattedText(text, formatting) {
    if (!formatting || formatting.length === 0) {
      return text;
    }

    // Sort formatting by start position
    const sortedFormats = [...formatting].sort((a, b) => a.start - b.start);
    
    let result = '';
    let lastIndex = 0;

    sortedFormats.forEach(format => {
      // Add unformatted text before this format
      result += text.substring(lastIndex, format.start);

      // Add formatted text
      const formattedText = text.substring(format.start, format.end);
      
      switch (format.type) {
        case 'bold':
          result += `<strong>${formattedText}</strong>`;
          break;
        case 'italic':
          result += `<em>${formattedText}</em>`;
          break;
        case 'underline':
          result += `<u>${formattedText}</u>`;
          break;
        case 'highlight':
          result += `<span class="highlight-${format.color}">${formattedText}</span>`;
          break;
        default:
          result += formattedText;
      }

      lastIndex = format.end;
    });

    // Add remaining unformatted text
    result += text.substring(lastIndex);

    return result;
  }

  clearFormatting(input) {
    if (input) {
      input.formattingData = [];
      delete input.dataset.formatting;
    }
  }
}
