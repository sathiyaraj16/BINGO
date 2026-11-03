/**
 * Test Suite: Relative Player Labels in Pass & Play and Online Multiplayer
 * 
 * Verifies:
 * 1. Pass & Play Mode (1 Phone):
 *    - When Player 1 is active:
 *      P1 Card: "YOU (PLAYER 1)", P2 Card: "OPPONENT (PLAYER 2)"
 *    - When Player 2 is active:
 *      P1 Card: "OPPONENT (PLAYER 1)", P2 Card: "YOU (PLAYER 2)"
 *    - Dynamic updates on card flip and turn change.
 *    - Relevant BINGO progress headings and status indicators.
 * 
 * 2. Online Multiplayer Mode:
 *    - Current logged-in player is always labeled "YOU".
 *    - Other player is always labeled "OPPONENT".
 *    - Session variable myPlayerNum is strictly respected for both P1 and P2 clients.
 *    - Turn tracker correctly distinguishes YOUR TURN vs OPPONENT TURN.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock Web Audio Context
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

// Mock DOM Element
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
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }
}

// Load index.html IDs
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

// Setup BINGO letter boxes
const rackEl = elementsById['bingoRack'];
rackEl.children = [];
for (let i = 0; i < 5; i++) {
  const box = new MockElement(`letter-${i}`);
  box.classList.add('bingo-letter-box');
  rackEl.appendChild(box);
}

const mockRackLabel = new MockElement('bingoRackLabel');
mockRackLabel.classList.add('bingo-rack-label');

const sessionStore = new Map();

global.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

global.sessionStorage = {
  getItem(k) { return sessionStore.get(k) || null; },
  setItem(k, v) { sessionStore.set(k, String(v)); },
  removeItem(k) { sessionStore.delete(k); },
  clear() { sessionStore.clear(); }
};

global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

global.window = {
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext,
  addEventListener() {},
  location: { protocol: 'http:', host: 'localhost:3000', origin: 'http://localhost:3000', pathname: '/', search: '' },
  history: { replaceState() {} },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  innerWidth: 1000,
  innerHeight: 800,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {}
};

global.document = {
  getElementById: (id) => elementsById[id] || null,
  querySelector: (sel) => {
    if (sel === '.bingo-rack-label') return mockRackLabel;
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel === '.review-tab-btn') {
      return [elementsById['tabReviewBoth'], elementsById['tabReviewP1'], elementsById['tabReviewP2']].filter(Boolean);
    }
    if (sel === '.bingo-letter-box') return rackEl.children;
    if (sel === '.bingo-tile') return [];
    return [];
  },
  createElement: (tag) => new MockElement('', tag),
  body: new MockElement('body')
};

// Require script.js
const scriptPath = fs.existsSync(path.join(__dirname, '..', 'script.js'))
  ? path.join(__dirname, '..', 'script.js')
  : path.join(process.cwd(), 'script.js');
require(scriptPath);

const BingoGame = global.window.BingoGame;

console.log('--- Starting Relative Player Label System Verification ---');

// =========================================================================
// PART 1: Pass & Play (1 Phone) Mode Verification
// =========================================================================
console.log('\n[PASS & PLAY MODE]');
const game = new BingoGame();
game.startLocalGame();

console.log('1. Verifying Player 1 Active Turn in Pass & Play...');
assert.strictEqual(game.currentPlayer, 1, 'Current player must start as Player 1');
assert.strictEqual(game.p1PlayerName.textContent, 'YOU (PLAYER 1)', 'Player 1 card must be labeled "YOU (PLAYER 1)" when P1 is active');
assert.strictEqual(game.p2PlayerName.textContent, 'OPPONENT (PLAYER 2)', 'Player 2 card must be labeled "OPPONENT (PLAYER 2)" when P1 is active');
assert.strictEqual(game.turnTrackerEl.textContent, 'YOU (P1) TURN', 'Turn tracker must indicate "YOU (P1) TURN"');
assert.ok(game.turnPrompt.textContent.includes('YOU (PLAYER 1)'), 'Turn prompt must address "YOU (PLAYER 1)"');
assert.ok(mockRackLabel.textContent.includes('YOU (PLAYER 1) BINGO PROGRESS'), 'BINGO rack label must address YOU (PLAYER 1)');
console.log('✓ Player 1 active turn labels verified: P1="YOU (PLAYER 1)", P2="OPPONENT (PLAYER 2)"');

console.log('2. Verifying Player 2 Active Turn in Pass & Play...');
game.currentPlayer = 2;
game.updateTurnUI();
game.updateBingoLettersUI();

assert.strictEqual(game.p1PlayerName.textContent, 'OPPONENT (PLAYER 1)', 'Player 1 card must be labeled "OPPONENT (PLAYER 1)" when P2 is active');
assert.strictEqual(game.p2PlayerName.textContent, 'YOU (PLAYER 2)', 'Player 2 card must be labeled "YOU (PLAYER 2)" when P2 is active');
assert.strictEqual(game.turnTrackerEl.textContent, 'YOU (P2) TURN', 'Turn tracker must indicate "YOU (P2) TURN"');
assert.ok(game.turnPrompt.textContent.includes('YOU (PLAYER 2)'), 'Turn prompt must address "YOU (PLAYER 2)"');
assert.ok(mockRackLabel.textContent.includes('YOU (PLAYER 2) BINGO PROGRESS'), 'BINGO rack label must address YOU (PLAYER 2)');
console.log('✓ Player 2 active turn labels verified: P1="OPPONENT (PLAYER 1)", P2="YOU (PLAYER 2)"');

console.log('3. Verifying Dynamic Update on Flip back to Player 1...');
game.currentPlayer = 1;
game.updateTurnUI();
game.updateBingoLettersUI();
assert.strictEqual(game.p1PlayerName.textContent, 'YOU (PLAYER 1)');
assert.strictEqual(game.p2PlayerName.textContent, 'OPPONENT (PLAYER 2)');
assert.strictEqual(game.turnTrackerEl.textContent, 'YOU (P1) TURN');
console.log('✓ Dynamic update back to Player 1 verified');

// =========================================================================
// PART 2: Online Multiplayer Mode Verification (Client 1 = Host / Player 1)
// =========================================================================
console.log('\n[ONLINE MULTIPLAYER MODE - CLIENT 1 (PLAYER 1)]');
sessionStore.clear();
const onlineGameP1 = new BingoGame();

// Setup online match where myPlayerNum = 1
onlineGameP1.setupOnlineGame({
  roomCode: 'ONL101',
  playerNum: 1,
  playerName: 'Alice',
  opponentName: 'Bob',
  myBoard: Array.from({ length: 25 }, (_, i) => i + 1),
  activePlayer: 1,
  turnPhase: 'CALL'
});

assert.strictEqual(onlineGameP1.myPlayerNum, 1, 'myPlayerNum must be 1 for Client 1');
assert.strictEqual(onlineGameP1.p1PlayerName.textContent, 'YOU', 'Client 1 must see Player 1 card as "YOU"');
assert.strictEqual(onlineGameP1.p2PlayerName.textContent, 'OPPONENT', 'Client 1 must see Player 2 card as "OPPONENT"');
assert.strictEqual(onlineGameP1.turnTrackerEl.textContent, 'YOUR TURN', 'When Player 1 is active, Client 1 must see "YOUR TURN"');
assert.ok(mockRackLabel.textContent.includes('YOUR BINGO PROGRESS'), 'Client 1 must see "YOUR BINGO PROGRESS"');
console.log('✓ Client 1 (Player 1) correctly labeled "YOU", opponent labeled "OPPONENT"');

console.log('Verifying Client 1 view when Player 2 takes turn...');
onlineGameP1.currentPlayer = 2;
onlineGameP1.updateOnlineTurnUI();
// Labels MUST stay "YOU" and "OPPONENT" in Online Multiplayer regardless of active player!
assert.strictEqual(onlineGameP1.p1PlayerName.textContent, 'YOU', 'Player 1 card must ALWAYS be "YOU" for Client 1');
assert.strictEqual(onlineGameP1.p2PlayerName.textContent, 'OPPONENT', 'Player 2 card must ALWAYS be "OPPONENT" for Client 1');
assert.strictEqual(onlineGameP1.turnTrackerEl.textContent, 'OPPONENT TURN', 'When Player 2 is active, Client 1 must see "OPPONENT TURN"');
console.log('✓ Client 1 relative labels remain consistent during opponent turn');

// =========================================================================
// PART 3: Online Multiplayer Mode Verification (Client 2 = Guest / Player 2)
// =========================================================================
console.log('\n[ONLINE MULTIPLAYER MODE - CLIENT 2 (PLAYER 2)]');
sessionStore.clear();
const onlineGameP2 = new BingoGame();

// Setup online match where myPlayerNum = 2
onlineGameP2.setupOnlineGame({
  roomCode: 'ONL102',
  playerNum: 2,
  playerName: 'Bob',
  opponentName: 'Alice',
  myBoard: Array.from({ length: 25 }, (_, i) => i + 1),
  activePlayer: 1,
  turnPhase: 'CALL'
});

assert.strictEqual(onlineGameP2.myPlayerNum, 2, 'myPlayerNum must be 2 for Client 2');
assert.strictEqual(onlineGameP2.p1PlayerName.textContent, 'OPPONENT', 'Client 2 must see Player 1 card as "OPPONENT"');
assert.strictEqual(onlineGameP2.p2PlayerName.textContent, 'YOU', 'Client 2 must see Player 2 card as "YOU"');
assert.strictEqual(onlineGameP2.turnTrackerEl.textContent, 'OPPONENT TURN', 'When Player 1 is active, Client 2 must see "OPPONENT TURN"');
assert.ok(mockRackLabel.textContent.includes('YOUR BINGO PROGRESS'), 'Client 2 must see "YOUR BINGO PROGRESS"');
console.log('✓ Client 2 (Player 2) correctly labeled "YOU", opponent labeled "OPPONENT"');

console.log('Verifying Client 2 view when Player 2 takes turn...');
onlineGameP2.currentPlayer = 2;
onlineGameP2.updateOnlineTurnUI();
assert.strictEqual(onlineGameP2.p1PlayerName.textContent, 'OPPONENT', 'Player 1 card must ALWAYS be "OPPONENT" for Client 2');
assert.strictEqual(onlineGameP2.p2PlayerName.textContent, 'YOU', 'Player 2 card must ALWAYS be "YOU" for Client 2');
assert.strictEqual(onlineGameP2.turnTrackerEl.textContent, 'YOUR TURN', 'When Player 2 is active, Client 2 must see "YOUR TURN"');
console.log('✓ Client 2 relative labels remain consistent during own turn');

// =========================================================================
// PART 4: Winner & Game Over Relative Labels
// =========================================================================
console.log('\n[WINNER & REVIEW LABELS VERIFICATION]');

// Online Client 1 Win
onlineGameP1.handleOnlineGameOver({
  winnerNum: 1,
  winnerPlayer: 1,
  p1Review: { score: 25, lines: 5, board: Array.from({ length: 25 }, (_, i) => i + 1), marked: new Array(25).fill(true), unmarkedNumbers: [] },
  p2Review: { score: 10, lines: 1, board: Array.from({ length: 25 }, (_, i) => i + 1), marked: new Array(25).fill(false), unmarkedNumbers: [] }
});
assert.strictEqual(onlineGameP1.winnerTitle.textContent, 'YOU WIN!', 'Client 1 should see "YOU WIN!" when P1 wins');
assert.strictEqual(onlineGameP1.winnerP1Label.textContent, 'YOU');
assert.strictEqual(onlineGameP1.winnerP2Label.textContent, 'OPPONENT');
console.log('✓ Online Client 1 Win modal correctly shows "YOU WIN!" with "YOU" and "OPPONENT" review labels');

// Online Client 2 Loss
onlineGameP2.handleOnlineGameOver({
  winnerNum: 1,
  winnerPlayer: 1,
  p1Review: { score: 25, lines: 5, board: Array.from({ length: 25 }, (_, i) => i + 1), marked: new Array(25).fill(true), unmarkedNumbers: [] },
  p2Review: { score: 10, lines: 1, board: Array.from({ length: 25 }, (_, i) => i + 1), marked: new Array(25).fill(false), unmarkedNumbers: [] }
});
assert.strictEqual(onlineGameP2.winnerTitle.textContent, 'OPPONENT WINS!', 'Client 2 should see "OPPONENT WINS!" when P1 wins');
assert.strictEqual(onlineGameP2.winnerP1Label.textContent, 'OPPONENT');
assert.strictEqual(onlineGameP2.winnerP2Label.textContent, 'YOU');
console.log('✓ Online Client 2 Loss modal correctly shows "OPPONENT WINS!" with "YOU" and "OPPONENT" review labels');

console.log('\n======================================================');
console.log(' ALL RELATIVE PLAYER LABEL TESTS PASSED! 🎉');
console.log('======================================================');
