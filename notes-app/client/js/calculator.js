/**
 * @fileoverview Calculator functionality with basic arithmetic operations
 * Supports addition, subtraction, multiplication, division, and decimal input
 * Features dynamic display sizing and sound feedback
 * @module calculator
 */

/**
 * Calculator class implementing basic arithmetic operations
 * Maintains calculation state and handles user input through button clicks
 */
export class Calculator {
  /**
   * Creates a new Calculator instance
   * @param {SoundManager} soundManager - Sound manager for audio feedback
   */
  constructor(soundManager) {
    /** @type {string} Current display value */
    this.display = '';
    
    /** @type {string} Current operator (+, -, *, /) */
    this.operator = '';
    
    /** @type {string} Previous operand value */
    this.previous = '';
    
    /** @type {boolean} Whether calculator is waiting for next operand */
    this.waitingForOperand = false;
    
    /** @type {string} Current expression being built (e.g., "5 + ") */
    this.expression = '';
    
    /** @type {SoundManager} Sound manager for button click feedback */
    this.soundManager = soundManager;
    
    /** @type {Function} Bound event handler reference for cleanup */
    this.boundHandleClick = null;
  }

  /**
   * Initializes calculator and attaches event listeners to buttons
   * Sets up click handlers for all calculator buttons and updates display
   * Stores bound function reference for proper cleanup
   */
  init() {
    const calcButtons = document.querySelectorAll('.calc-btn');
    
    // Store bound reference for later removal
    this.boundHandleClick = (e) => this.handleButtonClick(e.target);
    
    calcButtons.forEach(button => {
      button.addEventListener('click', this.boundHandleClick);
    });

    this.updateDisplay();
  }

  /**
   * Handles calculator button clicks and routes to appropriate action
   * Determines action based on button class and text content
   * 
   * @param {HTMLElement} button - The clicked button element
   */
  handleButtonClick(button) {
    const text = button.textContent.trim();
    
    if (button.classList.contains('clear')) {
      this.clear();
    } else if (button.classList.contains('equals')) {
      this.calculate();
    } else if (button.classList.contains('operator')) {
      if (text === '⌫') {
        this.deleteLast();
      } else if (text === '×') {
        this.inputOperator('*');
      } else {
        this.inputOperator(text);
      }
    } else if (text === '.') {
      this.inputDecimal();
    } else {
      this.inputNumber(text);
    }
  }

  /**
   * Updates the calculator display with current expression or value
   * Dynamically adjusts font size based on display text length
   * 
   * Size classes:
   * - size-1: 0-6 chars (largest font)
   * - size-2: 7-8 chars
   * - size-3: 9-10 chars
   * - size-4: 11-12 chars
   * - size-5: 13-14 chars
   * - size-6: 15+ chars (smallest font)
   */
  updateDisplay() {
    const displayEl = document.getElementById('calcDisplay');
    let displayText = '';

    // Build display text based on calculation state
    if (this.expression && this.operator && !this.waitingForOperand) {
      displayText = this.expression + this.display;
    } else if (this.expression && this.waitingForOperand) {
      displayText = this.expression;
    } else {
      displayText = this.display || '0';
    }

    displayEl.textContent = displayText;

    // Remove all size classes
    displayEl.classList.remove('size-1', 'size-2', 'size-3', 'size-4', 'size-5', 'size-6');

    // Apply appropriate size class based on text length
    const length = displayText.length;

    if (length <= 6) {
      displayEl.classList.add('size-1');
    } else if (length <= 8) {
      displayEl.classList.add('size-2');
    } else if (length <= 10) {
      displayEl.classList.add('size-3');
    } else if (length <= 12) {
      displayEl.classList.add('size-4');
    } else if (length <= 14) {
      displayEl.classList.add('size-5');
    } else {
      displayEl.classList.add('size-6');
    }
  }

  /**
   * Handles number button input
   * Replaces display if waiting for operand or display is '0' or empty
   * Otherwise appends to current value
   * 
   * @param {string} num - The number to input (0-9)
   */
  inputNumber(num) {
    this.soundManager.play('calculator');
    
    if (this.waitingForOperand) {
      this.display = num;
      this.waitingForOperand = false;
    } else {
      // Replace display if it's '0' or empty, otherwise append
      this.display = (this.display === '0' || this.display === '') ? num : this.display + num;
    }
    
    this.updateDisplay();
  }

  /**
   * Handles decimal point input
   * Prevents multiple decimal points in same number
   * Starts with "0." if waiting for operand
   */
  inputDecimal() {
    this.soundManager.play('calculator');
    
    if (this.waitingForOperand) {
      this.display = '0.';
      this.waitingForOperand = false;
    } else if (!this.display.includes('.')) {
      this.display += '.';
    }
    
    this.updateDisplay();
  }

  /**
   * Handles operator button input (+, -, *, /)
   * If previous operation exists, calculates it first (chain calculations)
   * 
   * @param {string} nextOperator - The operator to apply (+, -, *, /)
   */
  inputOperator(nextOperator) {
    this.soundManager.play('calculator');
    const inputValue = parseFloat(this.display);

    if (this.previous === '') {
      // First operand
      this.previous = inputValue;
      this.expression = this.display + ' ' + nextOperator + ' ';
    } else if (this.operator) {
      // Chain calculation: calculate previous operation first
      const newValue = this.performCalculation(this.previous, inputValue, this.operator);
      this.display = String(newValue);
      this.previous = newValue;
      this.expression = String(newValue) + ' ' + nextOperator + ' ';
    }

    this.waitingForOperand = true;
    this.operator = nextOperator;
    this.updateDisplay();
  }

  /**
   * Calculates the final result when equals button is pressed
   * Shows full expression with result in display
   * Resets calculator state for next operation
   */
  calculate() {
    this.soundManager.play('calculator');
    const inputValue = parseFloat(this.display);

    if (this.previous !== '' && this.operator) {
      // Build full expression
      this.expression = (this.expression || this.previous + ' ' + this.operator + ' ') + this.display;
      
      // Perform calculation
      const newValue = this.performCalculation(this.previous, inputValue, this.operator);

      // Format and display result
      this.display = this.formatNumber(newValue);
      document.getElementById('calcDisplay').textContent = this.expression + ' = ' + this.display;

      // Reset state for next calculation
      this.previous = '';
      this.operator = '';
      this.expression = '';
      this.waitingForOperand = true;
    }
  }

  /**
   * Formats numbers for display with appropriate precision
   * Handles scientific notation for very large/small numbers
   * Removes trailing zeros from decimals
   * 
   * @param {number} num - The number to format
   * @returns {string} Formatted number string
   * 
   * Scientific Notation Thresholds:
   * - Numbers >= 1 trillion (1,000,000,000,000 or 1e12) use scientific notation
   *   Example: 5000000000000 becomes "5.00000e+12"
   *   Reason: Display width limitation (12 characters max)
   * 
   * - Numbers < 0.000001 (1e-6) use scientific notation
   *   Example: 0.0000005 becomes "5.00000e-7"
   *   Reason: Too many leading zeros make number unreadable
   * 
   * Regular Display Examples:
   * - 999,999,999,999 (999 billion) displays normally
   * - 0.000001 (1 millionth) displays normally
   * - Anything between these ranges shows full decimal notation
   * 
   * Other Rules:
   * - Returns '0' for NaN or infinity
   * - Rounds to 10 decimal places to avoid floating point errors
   * - Limits display to 12 characters maximum
   * - Removes trailing zeros from decimals (5.00 becomes 5)
   */
  formatNumber(num) {
    if (isNaN(num) || !isFinite(num)) {
      return '0';
    }

    // Round to 10 decimal places to avoid floating point errors
    const rounded = Math.round(num * 1e10) / 1e10;

    const absNum = Math.abs(rounded);
    
    // Use scientific notation for very large or very small numbers
    // This prevents display overflow and maintains readability
    if (absNum >= 1e12 || (absNum < 1e-6 && absNum !== 0)) {
      return rounded.toExponential(5);
    }

    const numString = rounded.toString();
    
    // If number fits in display, return as-is
    if (numString.length <= 12) {
      return numString;
    }

    // For decimals that are too long, reduce decimal places
    if (numString.includes('.')) {
      const decimalPlaces = Math.max(0, 11 - Math.floor(Math.log10(absNum)) - 1);
      return rounded.toFixed(decimalPlaces).replace(/\.?0+$/, '');
    }

    return numString;
  }

  /**
   * Performs arithmetic calculation between two operands
   * 
   * @param {number} firstOperand - First number in operation
   * @param {number} secondOperand - Second number in operation
   * @param {string} operator - Operation to perform (+, -, *, /)
   * @returns {number} Result of calculation
   * 
   * Note: Division by zero returns 0 to prevent errors
   */
  performCalculation(firstOperand, secondOperand, operator) {
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

  /**
   * Clears calculator state and resets display
   * Returns calculator to initial state
   */
  clear() {
    this.soundManager.play('calculator');
    this.display = '';
    this.operator = '';
    this.previous = '';
    this.expression = '';
    this.waitingForOperand = false;
    this.updateDisplay();
  }

  /**
   * Deletes the last character from current display
   * Shows '0' if display becomes empty
   */
  deleteLast() {
    this.soundManager.play('calculator');
    this.display = this.display.length > 1 ? this.display.slice(0, -1) : '0';
    this.updateDisplay();
  }

  /**
   * Cleans up event listeners when calculator is destroyed
   * Should be called before removing calculator from DOM
   * Uses stored bound reference to properly remove listeners
   */
  destroy() {
    if (this.boundHandleClick) {
      const calcButtons = document.querySelectorAll('.calc-btn');
      calcButtons.forEach(button => {
        button.removeEventListener('click', this.boundHandleClick);
      });
      this.boundHandleClick = null;
    }
  }
}
