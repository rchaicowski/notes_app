/**
 * @fileoverview Rich text formatting manager for notes
 * Handles bold, italic, underline, and highlight formatting in contenteditable elements
 * Manages formatting toolbar UI and persistence of formatted text with XSS protection
 * @module formattingManager
 */

/**
 * Manages text formatting operations and toolbar interactions
 * Supports bold, italic, underline, and multi-color highlighting
 * Persists formatting as HTML with optional sanitization via DOMPurify
 * Implements proper event listener cleanup to prevent memory leaks
 */
export class FormattingManager {
  /**
   * Creates a new FormattingManager instance
   * @param {SoundManager} soundManager - Sound manager for audio feedback
   */
  constructor(soundManager) {
    /** @type {SoundManager} Sound manager for button click feedback */
    this.soundManager = soundManager;
    
    /** @type {boolean} Whether formatting toolbar is currently visible */
    this.isToolbarOpen = false;
    
    /** @type {string[]} Available highlight colors */
    this.highlightColors = ['yellow', 'green', 'pink', 'blue', 'orange'];
    
    /** @type {string} Currently selected highlight color */
    this.currentHighlightColor = 'yellow';
    
    /**
     * Array tracking toolbar event listeners for proper cleanup
     * Each entry: {element: HTMLElement, type: string, handler: Function}
     * @type {Array<{element: HTMLElement, type: string, handler: Function}>}
     * @private
     */
    this._toolbarListeners = [];
    
    /**
     * HTML sanitization function
     * Uses DOMPurify if available, otherwise returns HTML as-is
     * Prevents XSS attacks when rendering user-generated HTML
     * 
     * @type {Function}
     * @param {string} html - HTML string to sanitize
     * @returns {string} Sanitized HTML
     */
    this.sanitizeHtml = (html) => {
      if (typeof window !== 'undefined' && window.DOMPurify) {
        try { 
          return window.DOMPurify.sanitize(html); 
        } catch (e) { 
          return html; 
        }
      }
      return html;
    };
  }

  /**
   * Creates the formatting toolbar HTML element
   * Generates buttons for bold, italic, underline, and highlight colors
   * 
   * @returns {HTMLElement} The constructed toolbar element
   */
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'formatting-toolbar hidden';
    toolbar.id = 'formatting-toolbar';
    
    toolbar.innerHTML = `
      <div class="toolbar-header">
        <span class="toolbar-title">Format</span>
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

  /**
   * Shows or hides the formatting toolbar
   * Plays sound feedback when opening toolbar
   * 
   * @param {boolean} show - True to show toolbar, false to hide
   */
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

  /**
   * Initializes the formatting toolbar and attaches event listeners
   * Creates toolbar if it doesn't exist, then sets up button handlers
   * Properly tracks event listeners for cleanup to prevent memory leaks
   * Falls back to clone/replace method if listener tracking unavailable
   */
  initializeToolbar() {
    const notepad = document.querySelector('.notepad');
    if (!notepad) return;

    // Check if toolbar already exists
    let toolbar = document.getElementById('formatting-toolbar');
    if (!toolbar) {
      toolbar = this.createToolbar();
      notepad.parentElement.appendChild(toolbar);
    }

    // Clean up previous listeners
    if (this._toolbarListeners && this._toolbarListeners.length) {
      // Preferred: Remove tracked listeners cleanly
      this._toolbarListeners.forEach(({ element, type, handler }) => {
        try { 
          element.removeEventListener(type, handler); 
        } catch (e) {
          // Ignore errors from already-removed elements
        }
      });
      this._toolbarListeners = [];
    } else {
      // Fallback: Clone and replace to remove all listeners
      const newToolbar = toolbar.cloneNode(true);
      toolbar.parentNode.replaceChild(newToolbar, toolbar);
      toolbar = newToolbar;
    }

    // Format buttons (bold, italic, underline)
    const formatBtns = toolbar.querySelectorAll('.format-btn');
    formatBtns.forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const format = btn.dataset.format;
        this.applyFormatting(format);
        this.soundManager.play('pencil', 100);
      };
      btn.addEventListener('click', handler);
      this._toolbarListeners.push({ element: btn, type: 'click', handler });
    });

    // Highlight color buttons
    const highlightBtns = toolbar.querySelectorAll('.highlight-btn');
    highlightBtns.forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Update active state
        highlightBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.currentHighlightColor = btn.dataset.color;
        this.applyFormatting('highlight', this.currentHighlightColor);
        this.soundManager.play('pencil', 100);
      };
      btn.addEventListener('click', handler);
      this._toolbarListeners.push({ element: btn, type: 'click', handler });
    });
  }

  /**
   * Applies or removes formatting to the current text selection
   * Toggles formatting: applies if not present, removes if already applied
   * Only works within contenteditable elements
   * 
   * @param {string} type - Type of formatting: 'bold', 'italic', 'underline', or 'highlight'
   * @param {string|null} [color=null] - Color for highlight (only used with 'highlight' type)
   */
  applyFormatting(type, color = null) {
    const selection = window.getSelection();
    
    // Early return if no text is selected
    if (!selection.rangeCount || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Find the contenteditable container
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }
    
    const editableDiv = container.closest('[contenteditable="true"]');
    if (!editableDiv) {
      return; // Not in an editable area
    }

    // Check if selection is already formatted
    const formatElement = this.findFormattingElement(container, type, color);
    
    if (formatElement) {
      // Remove existing formatting (toggle off)
      this.removeFormatting(formatElement, range);
    } else {
      // Apply new formatting (toggle on)
      this.addFormatting(type, color, range, selection);
    }
  }

  /**
   * Searches up the DOM tree to find if element is within a formatting element
   * Used to determine if formatting should be added or removed (toggle behavior)
   * Stops searching when reaching the contenteditable boundary
   * 
   * @param {HTMLElement} element - Starting element to search from
   * @param {string} type - Type of formatting to search for
   * @param {string|null} [color=null] - Color for highlight matching
   * @returns {HTMLElement|null} The formatting element if found, null otherwise
   */
  findFormattingElement(element, type, color = null) {
    let current = element;
    
    // Walk up the DOM tree until we hit the contenteditable boundary
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

  /**
   * Removes formatting from an element by replacing it with plain text
   * Preserves text content while removing all formatting markup
   * Restores text selection after removal
   * 
   * @param {HTMLElement} formatElement - The formatting element to remove
   * @param {Range} range - Current selection range (for selection restoration)
   */
  removeFormatting(formatElement, range) {
    try {
      // Extract plain text content
      const textContent = formatElement.textContent;
      
      // Create plain text node
      const textNode = document.createTextNode(textContent);
      
      // Replace formatted element with plain text
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

  /**
   * Applies formatting to the selected text by wrapping it in appropriate HTML element
   * Inserts zero-width space after formatted text to allow cursor escape
   * 
   * @param {string} type - Type of formatting to apply
   * @param {string|null} color - Color for highlight (only used with 'highlight')
   * @param {Range} range - Current selection range
   * @param {Selection} selection - Current selection object
   * 
   * Elements created:
   * - bold: <strong>
   * - italic: <em>
   * - underline: <u>
   * - highlight: <span class="highlight-{color}">
   * 
   * Note: Zero-width space (\u200B) allows user to type outside formatting
   */
  addFormatting(type, color, range, selection) {
    let formattedElement;
    
    // Create appropriate formatting element
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
      // Extract selected content
      const contents = range.extractContents();
      
      // Wrap content in formatting element
      formattedElement.appendChild(contents);
      
      // Insert formatted content back into DOM
      range.insertNode(formattedElement);
      
      // Add zero-width space after formatted element
      // This allows cursor to escape the formatting when typing
      const spaceNode = document.createTextNode('\u200B');
      formattedElement.parentNode.insertBefore(spaceNode, formattedElement.nextSibling);
      
      // Place cursor after the formatted text (outside formatting)
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStartAfter(spaceNode);
      newRange.collapse(true);
      selection.addRange(newRange);
      
    } catch (error) {
      console.error('Error applying formatting:', error);
    }
  }

  /**
   * Checks if the current selection contains specific formatting
   * 
   * @param {string} type - Type of formatting to check for
   * @param {string|null} [color=null] - Color for highlight checking
   * @returns {boolean} True if selection is formatted, false otherwise
   */
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

  /**
   * Extracts formatting data from a note element for persistence
   * Captures HTML and text content for title and all content lines
   * 
   * @param {HTMLElement} noteElement - The note container element
   * @returns {Array<Object>} Array of formatting objects with field, line, html, and text
   * 
   * Format structure:
   * - Title: {field: 'title', html: '<strong>text</strong>', text: 'text'}
   * - Content: {field: 'content', line: 0, html: '...', text: '...'}
   */
  getFormattingForNote(noteElement) {
    const formatting = [];
    
    // Extract title formatting
    const titleDiv = noteElement.querySelector('#noteTitle');
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

    // Extract content line formatting
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

  /**
   * Applies saved formatting data to a note element
   * Restores HTML formatting to title and content lines
   * Uses requestAnimationFrame for optimal rendering timing
   * Sanitizes HTML using DOMPurify if available to prevent XSS
   * 
   * @param {HTMLElement} noteElement - The note container element
   * @param {Array<Object>} formattingData - Array of formatting objects from getFormattingForNote
   * 
   * Timing Strategy:
   * - Prefers requestAnimationFrame (syncs with browser repaint)
   * - Falls back to setTimeout(50ms) if rAF unavailable
   */
  applyFormattingToNote(noteElement, formattingData) {
    if (!formattingData || formattingData.length === 0) return;

    const apply = () => {
      formattingData.forEach(item => {
        if (item.field === 'title' && item.html) {
          const titleDiv = noteElement.querySelector('#noteTitle');
          if (titleDiv) {
            // Sanitize HTML to prevent XSS attacks
            titleDiv.innerHTML = this.sanitizeHtml(item.html);
          }
        } else if (item.field === 'content' && item.html) {
          const contentDivs = noteElement.querySelectorAll('.note-content-line');
          const div = contentDivs[item.line];
          if (div) {
            // Sanitize HTML to prevent XSS attacks
            div.innerHTML = this.sanitizeHtml(item.html);
          }
        }
      });
    };

    // Use requestAnimationFrame for optimal timing, fallback to setTimeout
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(apply);
    } else {
      setTimeout(apply, 50);
    }
  }

  /**
   * Renders formatted text for display in note list (index view)
   * Uses saved HTML formatting if available, otherwise returns plain text
   * 
   * @param {string} text - Plain text content
   * @param {Array<Object>} formatting - Formatting data array
   * @returns {string} HTML string with formatting or plain text
   */
  renderFormattedText(text, formatting) {
    // Check if we have saved HTML formatting for title
    if (formatting && formatting.length > 0) {
      const titleFormat = formatting.find(f => f.field === 'title');
      if (titleFormat && titleFormat.html) {
        return titleFormat.html;
      }
    }
    
    // Fallback to plain text
    return text;
  }

  /**
   * Extracts plain text from an element, removing all HTML formatting
   * 
   * @param {HTMLElement} element - Element to extract text from
   * @returns {string} Plain text content
   */
  extractPlainText(element) {
    if (!element) return '';
    return element.textContent || '';
  }

  /**
   * Removes all formatting from an element, leaving only plain text
   * Replaces innerHTML with textContent
   * 
   * @param {HTMLElement} element - Element to clear formatting from
   */
  clearFormatting(element) {
    if (element) {
      element.innerHTML = element.textContent;
    }
  }

  /**
   * Cleans up all tracked event listeners
   * Should be called before destroying the FormattingManager instance
   * Prevents memory leaks by properly removing all event handlers
   */
  destroy() {
    if (this._toolbarListeners && this._toolbarListeners.length) {
      this._toolbarListeners.forEach(({ element, type, handler }) => {
        try {
          element.removeEventListener(type, handler);
        } catch (e) {
          // Ignore errors from already-removed elements
        }
      });
      this._toolbarListeners = [];
    }
  }
}
