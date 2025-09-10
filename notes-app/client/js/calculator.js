export class Calculator {
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
    let displayText = '';

    if (this.expression && this.operator && !this.waitingForOperand) {
      displayText = this.expression + this.display;
    } else if (this.expression && this.waitingForOperand) {
      displayText = this.expression;
    } else {
      displayText = this.display || '0';
    }

    displayEl.textContent = displayText;

    displayEl.classList.remove('size-1', 'size-2', 'size-3', 'size-4', 'size-5', 'size-6');

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
    } else if (!this.display.includes('.')) {
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
      const newValue = this.performCalculation(this.previous, inputValue, this.operator);
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

      this.display = this.formatNumber(newValue);
      document.getElementById('calc-display').textContent = this.expression + ' = ' + this.display;

      this.previous = '';
      this.operator = '';
      this.expression = '';
      this.waitingForOperand = true;
    }
  }

  formatNumber(num) {
    if (isNaN(num) || !isFinite(num)) {
      return '0';
    }

    const rounded = Math.round(num * 1e10) / 1e10;

    const absNum = Math.abs(rounded);
    if (absNum >= 1e12 || (absNum < 1e-6 && absNum !== 0)) {
      return rounded.toExponential(5);
    }

    const numString = rounded.toString();
    if (numString.length <= 12) {
      return numString;
    }

    if (numString.includes('.')) {
      const decimalPlaces = Math.max(0, 11 - Math.floor(Math.log10(absNum)) - 1);
      return rounded.toFixed(decimalPlaces).replace(/\.?0+$/, '');
    }

    return numString;
  }

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
    this.display = this.display.length > 1 ? this.display.slice(0, -1) : '0';
    this.updateDisplay();
  }
}
