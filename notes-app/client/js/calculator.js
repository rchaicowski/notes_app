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
      this.display = String(newValue);
      document.getElementById('calc-display').textContent = this.expression + ' = ' + this.display;

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
    this.display = this.display.length > 1 ? this.display.slice(0, -1) : '0';
    this.updateDisplay();
  }
}
