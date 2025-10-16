export class FormattingManager {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.isToolbarOpen = false;
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
    const selection = window.getSelection();
    
    if (!selection.rangeCount || selection.isCollapsed) {
      return; // No text selected
    }

    const range = selection.getRangeAt(0);
    
    // Check if we're in a contenteditable element
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }
    
    const editableDiv = container.closest('[contenteditable="true"]');
    if (!editableDiv) {
      return; // Not in an editable area
    }

    // Check if the selection is entirely within a formatting element
    const formatElement = this.findFormattingElement(container, type, color);
    
    if (formatElement) {
      // Remove formatting
      this.removeFormatting(formatElement, range);
    } else {
      // Apply formatting
      this.addFormatting(type, color, range, selection);
    }
  }

  findFormattingElement(element, type, color = null) {
    // Walk up the tree to find if we're inside a formatting element
    let current = element;
    
    while (current && current.getAttribute('contenteditable') !== 'true') {
      const tagName = current.tagName;
      
      if (type === 'bold' && tagName === 'STRONG') {
        return current;
      }
      if (type === 'italic' && tagName === 'EM') {
        return current;
      }
      if (type === 'underline' && tagName === 'U') {
        return current;
      }
      if (type === 'highlight' && tagName === 'SPAN') {
        const expectedClass = `highlight-${color || this.currentHighlightColor}`;
        if (current.className === expectedClass) {
          return current;
        }
      }
      
      current = current.parentElement;
    }
    
    return null;
  }

  removeFormatting(formatElement, range) {
    try {
      // Get the text content
      const textContent = formatElement.textContent;
      
      // Create a text node with the content
      const textNode = document.createTextNode(textContent);
      
      // Replace the formatting element with plain text
      formatElement.parentNode.replaceChild(textNode, formatElement);
      
      // Restore selection on the new text node
      const newRange = document.createRange();
      newRange.selectNodeContents(textNode);
      
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(newRange);
      
    } catch (error) {
      console.error('Error removing formatting:', error);
    }
  }

  addFormatting(type, color, range, selection) {
    // Create the formatted element
    let formattedElement;
    
    switch (type) {
      case 'bold':
        formattedElement = document.createElement('strong');
        break;
      case 'italic':
        formattedElement = document.createElement('em');
        break;
      case 'underline':
        formattedElement = document.createElement('u');
        break;
      case 'highlight':
        formattedElement = document.createElement('span');
        formattedElement.className = `highlight-${color || this.currentHighlightColor}`;
        break;
      default:
        return;
    }

    try {
      // Extract the selected content
      const contents = range.extractContents();
      
      // Wrap it in the formatting element
      formattedElement.appendChild(contents);
      
      // Insert the formatted content back
      range.insertNode(formattedElement);
      
      // Clear the selection
      selection.removeAllRanges();
      
      // Place cursor after the formatted text
      const newRange = document.createRange();
      newRange.setStartAfter(formattedElement);
      newRange.collapse(true);
      selection.addRange(newRange);
      
    } catch (error) {
      console.error('Error applying formatting:', error);
    }
  }

  checkIfFormatted(type, color = null) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;
    
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }
    
    return this.findFormattingElement(container, type, color) !== null;
  }

  getFormattingForNote(noteElement) {
    const formatting = [];
    
    // Get title with HTML
    const titleDiv = noteElement.querySelector('#note-title');
    if (titleDiv) {
      const titleHtml = titleDiv.innerHTML;
      if (titleHtml.trim()) {
        formatting.push({
          field: 'title',
          html: titleHtml,
          text: titleDiv.textContent
        });
      }
    }

    // Get content lines with HTML
    const contentDivs = noteElement.querySelectorAll('.note-content-line');
    contentDivs.forEach((div, lineIndex) => {
      const lineHtml = div.innerHTML;
      const lineText = div.textContent;
      
      if (lineHtml.trim() || lineText.trim()) {
        formatting.push({
          field: 'content',
          line: lineIndex,
          html: lineHtml,
          text: lineText
        });
      }
    });

    return formatting;
  }

  applyFormattingToNote(noteElement, formattingData) {
    if (!formattingData || formattingData.length === 0) return;

    setTimeout(() => {
      formattingData.forEach(item => {
        if (item.field === 'title' && item.html) {
          const titleDiv = noteElement.querySelector('#note-title');
          if (titleDiv) {
            titleDiv.innerHTML = item.html;
          }
        } else if (item.field === 'content' && item.html) {
          const contentDivs = noteElement.querySelectorAll('.note-content-line');
          const div = contentDivs[item.line];
          if (div) {
            div.innerHTML = item.html;
          }
        }
      });
    }, 50);
  }

  renderFormattedText(text, formatting) {
    // For displaying in the index list
    // If we have HTML formatting saved, use it
    if (formatting && formatting.length > 0) {
      const titleFormat = formatting.find(f => f.field === 'title');
      if (titleFormat && titleFormat.html) {
        return titleFormat.html;
      }
    }
    
    // Otherwise just return plain text
    return text;
  }

  extractPlainText(element) {
    if (!element) return '';
    return element.textContent || '';
  }

  clearFormatting(element) {
    if (element) {
      element.innerHTML = element.textContent;
    }
  }
}
