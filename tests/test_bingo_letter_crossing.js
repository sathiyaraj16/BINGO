/**
 * Test Suite: BINGO Letter Crossing & Line Completion System
 * Verifies that completing horizontal rows, vertical columns, and diagonals
 * immediately crosses out B, I, N, G, O letters with .struck and .strike-cross,
 * prevents duplicate line counting, and functions in both offline and online modes.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser environment
class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {},
      stop() {}
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}
    };
  }
}

class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.classList = new Set();
    this.classList.add = (...cls) => cls.forEach(c => this.classList[c] = true);
    this.classList.remove = (...cls) => cls.forEach(c => delete this.classList[c]);
    this.classList.toggle = (c, val) => {
      if (val !== undefined) {
        if (val) this.classList[c] = true;
        else delete this.classList[c];
        return val;
      }
      if (this.classList[c]) { delete this.classList[c]; return false; }
      else { this.classList[c] = true; return true; }
    };
    this.classList.contains = c => !!this.classList[c];
    this.style = {};
    this.listeners = {};
    this.children = [];
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.disabled = false;
  }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  appendChild(child) {
    this.children.push(child);
  }
  querySelectorAll(sel) {
    const results = [];
    function search(node) {
      if (sel.startsWith('.') && node.classList && node.classList.contains(sel.substring(1))) {
        results.push(node);
      }
      if (node.children) {
        node.children.forEach(search);
      }
    }
    this.children.forEach(search);
    return results;
  }
}

const htmlPath = fs.existsSync(path.join(__dirname, '..', 'index.html'))
  ? path.join(__dirname, '..', 'index.html')
  : path.join(process.cwd(), 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const idMatches = [...html.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);
const elementsById = {};
idMatches.forEach(id => {
  elementsById[id] = new MockElement(id);
});

elementsById['confettiCanvas'] = new MockElement('confettiCanvas');
elementsById['confettiCanvas'].getContext = () => ({
  clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {}
});

// Setup 5 BINGO letter boxes inside bingoRack
const rackEl = elementsById['bingoRack'];
rackEl.children = [];
const letterBoxes = [];
for (let i = 0; i < 5; i++) {
  const box = new MockElement(`letter-${i}`);
  box.classList.add('bingo-letter-box');
  const spanChar = new MockElement();
  spanChar.classList.add('letter-char');
  spanChar.textContent = 'BINGO'[i];
  const spanCross = new MockElement();
  spanCross.classList.add('strike-cross');
  spanCross.textContent = '❌';
  box.appendChild(spanChar);
  box.appendChild(spanCross);
  rackEl.appendChild(box);
  letterBoxes.push(box);
}

global.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};
global.sessionStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};
global.window = {
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext,
  location: { protocol: 'http:', host: 'localhost:3000', pathname: '/', origin: 'http://localhost:3000' },
  history: { replaceState() {} },
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  addEventListener() {}
};
global.document = {
  getElementById: (id) => elementsById[id] || new MockElement(id),
  querySelectorAll: (sel) => {
    if (sel === '.bingo-letter-box') return letterBoxes;
    if (sel === '.bingo-tile') return [];
    if (sel === '.review-tab-btn') return [];
    return [];
  },
  querySelector: (sel) => {
    if (sel === '.bingo-rack-label') return new MockElement('bingoRackLabel');
    return null;
  },
  createElement: (tag) => new MockElement('', tag),
  body: new MockElement('body'),
  addEventListener() {}
};

// Load script.js
require('../script.js');

console.log('--- Starting BINGO Letter Crossing System Tests ---');

const game = new window.BingoGame();
game.startNewGame();

// 1. Verify all 5 letter boxes start un-struck
console.log('\n1. Verifying initial state: 0 letters crossed...');
letterBoxes.forEach((box, i) => {
  assert.strictEqual(box.classList.contains('struck'), false, `Letter box ${i} should not be struck initially`);
});
console.log('✓ All 5 B-I-N-G-O letters start uncrossed.');

// 2. Test Completing Horizontal Row 0 (Tiles 0..4)
console.log('\n2. Testing Horizontal Row 0 completion (indices 0, 1, 2, 3, 4)...');
[0, 1, 2, 3].forEach(idx => game.players[1].marked[idx] = true);
assert.strictEqual(game.players[1].completedLines.length, 0, 'Should have 0 lines before 5th tile');

// Mark 5th tile in row 0
game.players[1].marked[4] = true;
const newly0 = game.checkCompletedLines(1);
assert.strictEqual(newly0.length, 1, 'Should detect exactly 1 completed line');
assert.strictEqual(newly0[0].id, 'row-0');

newly0.forEach(line => game.players[1].completedLines.push(line.id));
game.updateBingoLettersUI(1);

// Letter 'B' (index 0) must be struck
assert.strictEqual(letterBoxes[0].classList.contains('struck'), true, "Letter 'B' must be struck");
assert.strictEqual(letterBoxes[1].classList.contains('struck'), false, "Letter 'I' must NOT be struck yet");
console.log("✓ Row 0 completed -> Letter 'B' crossed out with .struck class!");

// 3. Test Duplicate Line Prevention
console.log('\n3. Testing Duplicate Line Prevention...');
const dupCheck = game.checkCompletedLines(1);
assert.strictEqual(dupCheck.length, 0, 'Already counted row-0 must not be counted again');
console.log('✓ Duplicate line detection blocked: row-0 counted strictly once.');

// 4. Test Completing Vertical Column 0 (Indices 0, 5, 10, 15, 20)
console.log('\n4. Testing Vertical Column 0 completion (indices 0, 5, 10, 15, 20)...');
[5, 10, 15, 20].forEach(idx => game.players[1].marked[idx] = true);
const newlyCol0 = game.checkCompletedLines(1);
assert.strictEqual(newlyCol0.length, 1, 'Should detect exactly 1 completed column');
assert.strictEqual(newlyCol0[0].id, 'col-0');

newlyCol0.forEach(line => game.players[1].completedLines.push(line.id));
game.updateBingoLettersUI(1);

// Letters 'B' (0) and 'I' (1) must be struck
assert.strictEqual(letterBoxes[0].classList.contains('struck'), true, "Letter 'B' struck");
assert.strictEqual(letterBoxes[1].classList.contains('struck'), true, "Letter 'I' struck");
assert.strictEqual(letterBoxes[2].classList.contains('struck'), false, "Letter 'N' not struck yet");
console.log("✓ Column 0 completed -> Letter 'I' crossed out (2/5 lines)!");

// 5. Test Completing Main Diagonal (Indices 0, 6, 12, 18, 24)
console.log('\n5. Testing Main Diagonal completion (indices 0, 6, 12, 18, 24)...');
[6, 12, 18, 24].forEach(idx => game.players[1].marked[idx] = true);
const newlyDiag = game.checkCompletedLines(1);
assert.strictEqual(newlyDiag.length, 1, 'Should detect exactly 1 completed diagonal');
assert.strictEqual(newlyDiag[0].id, 'diag-main');

newlyDiag.forEach(line => game.players[1].completedLines.push(line.id));
game.updateBingoLettersUI(1);

// Letters 'B', 'I', 'N' must be struck
assert.strictEqual(letterBoxes[0].classList.contains('struck'), true);
assert.strictEqual(letterBoxes[1].classList.contains('struck'), true);
assert.strictEqual(letterBoxes[2].classList.contains('struck'), true, "Letter 'N' struck");
assert.strictEqual(letterBoxes[3].classList.contains('struck'), false);
console.log("✓ Main Diagonal completed -> Letter 'N' crossed out (3/5 lines)!");

// 6. Test Player Independence (Player 2 must have independent BINGO letters)
console.log('\n6. Testing Independent Player Tracking...');
assert.strictEqual(game.players[2].completedLines.length, 0, 'Player 2 should still have 0 lines');
game.updateBingoLettersUI(2);
letterBoxes.forEach((box, i) => {
  assert.strictEqual(box.classList.contains('struck'), false, `Player 2 box ${i} should be uncrossed`);
});
console.log('✓ Player 2 rack verified independent: 0 letters struck while Player 1 has 3 lines.');

// 7. Test Online Multiplayer Mode Line Checking & Letter Crossing
console.log('\n7. Testing Online Multiplayer Mode (CALL_SUCCESS & MARK_CALLED_SUCCESS)...');
game.gameMode = 'online';
game.online.playerNum = 1;
game.online.myBoard = [
  1, 2, 3, 4, 5,
  6, 7, 8, 9, 10,
  11, 12, 13, 14, 15,
  16, 17, 18, 19, 20,
  21, 22, 23, 24, 25
];
game.online.myMarked = new Array(25).fill(false);
game.players[1].board = [...game.online.myBoard];
game.players[1].marked = new Array(25).fill(false);
game.players[1].completedLines = [];
game.players[1].lineTileIndices = new Set();

// Simulate marking numbers 1, 2, 3, 4
[1, 2, 3, 4].forEach(num => {
  const idx = game.online.myBoard.indexOf(num);
  game.online.myMarked[idx] = true;
  game.players[1].marked[idx] = true;
});

// Calling 5th number in row (number 5) via online CALL_SUCCESS
game.handleOnlineServerMessage({
  type: 'CALL_SUCCESS',
  number: 5,
  score: 5,
  lines: 1,
  turnPhase: 'MARK_CALLED',
  activePlayer: 2
});

assert.strictEqual(game.players[1].completedLines.length, 1, 'Online CALL_SUCCESS must detect completed line');
assert.strictEqual(game.players[1].completedLines[0], 'row-0');
assert.strictEqual(letterBoxes[0].classList.contains('struck'), true, "Online CALL_SUCCESS must cross out letter 'B'");
console.log("✓ Online CALL_SUCCESS completed row-0 -> Letter 'B' crossed out immediately!");

// Calling another line via online MARK_CALLED_SUCCESS (Col 4: numbers 5, 10, 15, 20, 25)
// Numbers 10, 15, 20 marked:
[10, 15, 20].forEach(num => {
  const idx = game.online.myBoard.indexOf(num);
  game.online.myMarked[idx] = true;
  game.players[1].marked[idx] = true;
});

// Number 25 marked via MARK_CALLED_SUCCESS
game.handleOnlineServerMessage({
  type: 'MARK_CALLED_SUCCESS',
  number: 25,
  score: 6,
  lines: 2,
  turnPhase: 'CALL',
  activePlayer: 1
});

assert.strictEqual(game.players[1].completedLines.length, 2, 'Online MARK_CALLED_SUCCESS must detect completed column');
assert.strictEqual(game.players[1].completedLines[1], 'col-4');
assert.strictEqual(letterBoxes[1].classList.contains('struck'), true, "Online MARK_CALLED_SUCCESS must cross out letter 'I'");
console.log("✓ Online MARK_CALLED_SUCCESS completed col-4 -> Letter 'I' crossed out immediately!");

console.log('\n======================================================');
console.log(' ALL BINGO LETTER CROSSING & PROGRESS TESTS PASSED! 🎉');
console.log('======================================================');
