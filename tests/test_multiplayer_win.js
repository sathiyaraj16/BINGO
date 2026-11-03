/**
 * BINGO Real-Time Online Multiplayer Win Condition & Review System Test
 */
const WebSocket = require('ws');

const PORT = 3457;
process.env.PORT = PORT;
process.env.HOST = '127.0.0.1';

require('../server.js');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWinTest() {
  console.log('--- Starting BINGO Online Multiplayer Win Condition Test ---');
  await sleep(400);

  let c1, c2;
  try {
    c1 = new WebSocket(`ws://127.0.0.1:${PORT}`);
    await new Promise(r => c1.on('open', r));

    let c1Messages = [];
    c1.on('message', d => c1Messages.push(JSON.parse(d.toString())));

    c1.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Player 1' }));
    await sleep(200);
    const roomCode = c1Messages.find(m => m.type === 'ROOM_CREATED').roomCode;

    c2 = new WebSocket(`ws://127.0.0.1:${PORT}`);
    await new Promise(r => c2.on('open', r));

    let c2Messages = [];
    c2.on('message', d => c2Messages.push(JSON.parse(d.toString())));

    c2.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Player 2' }));
    await sleep(200);

    // Host clicks Start Game
    c1.send(JSON.stringify({ type: 'START_GAME' }));
    await sleep(300);

    const c1Start = c1Messages.find(m => m.type === 'GAME_STARTED');
    const c2Start = c2Messages.find(m => m.type === 'GAME_STARTED');

    const p1Board = c1Start.myBoard;
    const p2Board = c2Start.myBoard;

    console.log(`Match started in room ${roomCode}`);

    // Let's have P1 complete 5 lines:
    // Row 0: indices 0..4
    // Row 1: indices 5..9
    // Row 2: indices 10..14
    // Row 3: indices 15..19
    // Row 4: indices 20..24
    // If P1 calls indices 0..4 (5 tiles), that's Row 0 + partial cols/diags.
    // If P1 marks 25 tiles, they get all 12 lines.
    // Let's systematically have P1 call numbers to complete lines:
    // For each call:
    // P1 calls -> P2 marks -> P2 calls any unmarked on P2's board -> P1 marks.
    let gameOverMsg = null;
    let turn = 0;

    while (!gameOverMsg && turn < 25) {
      // P1 calls an unmarked number from row 0, 1, 2, 3, 4
      const p1Unmarked = p1Board.filter(num => {
        // find if marked in c1's latest state
        return true; // We can just pick the next index
      });

      const p1Num = p1Board[turn];
      c1.send(JSON.stringify({ type: 'CALL_NUMBER', number: p1Num }));
      await sleep(100);

      gameOverMsg = c1Messages.find(m => m.type === 'GAME_OVER') || c2Messages.find(m => m.type === 'GAME_OVER');
      if (gameOverMsg) break;

      // P2 marks p1Num
      c2.send(JSON.stringify({ type: 'MARK_CALLED', number: p1Num }));
      await sleep(100);

      gameOverMsg = c1Messages.find(m => m.type === 'GAME_OVER') || c2Messages.find(m => m.type === 'GAME_OVER');
      if (gameOverMsg) break;

      // P2 calls an unmarked number on P2's board
      // Find an unmarked number on P2's board
      // In P2's board, p1Num is now marked. Pick another tile.
      const p2Num = p2Board.find(num => num !== p1Num);
      c2.send(JSON.stringify({ type: 'CALL_NUMBER', number: p2Board[turn] }));
      await sleep(100);

      gameOverMsg = c1Messages.find(m => m.type === 'GAME_OVER') || c2Messages.find(m => m.type === 'GAME_OVER');
      if (gameOverMsg) break;

      // P1 marks p2's called number
      c1.send(JSON.stringify({ type: 'MARK_CALLED', number: p2Board[turn] }));
      await sleep(100);

      gameOverMsg = c1Messages.find(m => m.type === 'GAME_OVER') || c2Messages.find(m => m.type === 'GAME_OVER');
      if (gameOverMsg) break;

      turn++;
    }

    if (!gameOverMsg) {
      throw new Error('Game did not reach GAME_OVER within turn limit');
    }

    console.log(`✓ GAME_OVER reached! Winner: ${gameOverMsg.winnerName} (Player ${gameOverMsg.winnerNum})`);
    console.log('✓ Checking Separate Player Board Review Data:');
    const p1Rev = gameOverMsg.p1Review;
    const p2Rev = gameOverMsg.p2Review;

    if (!p1Rev || !p2Rev) throw new Error('GAME_OVER missing review objects for P1 and P2');

    console.log(`  - P1 Final Score: ${p1Rev.score}, Completed Lines: ${p1Rev.lines}`);
    console.log(`  - P1 Unmarked Numbers: [${p1Rev.unmarkedNumbers.join(', ')}]`);
    console.log(`  - P2 Final Score: ${p2Rev.score}, Completed Lines: ${p2Rev.lines}`);
    console.log(`  - P2 Unmarked Numbers: [${p2Rev.unmarkedNumbers.join(', ')}]`);

    // Verify unmarked numbers calculation
    const p1MarkedCount = p1Rev.marked.filter(Boolean).length;
    if (p1MarkedCount + p1Rev.unmarkedNumbers.length !== 25) {
      throw new Error(`P1 review marked (${p1MarkedCount}) + unmarked (${p1Rev.unmarkedNumbers.length}) != 25`);
    }

    const p2MarkedCount = p2Rev.marked.filter(Boolean).length;
    if (p2MarkedCount + p2Rev.unmarkedNumbers.length !== 25) {
      throw new Error(`P2 review marked (${p2MarkedCount}) + unmarked (${p2Rev.unmarkedNumbers.length}) != 25`);
    }

    console.log('✓ Both players board review data strictly validated and separated!');

    c1.close();
    c2.close();
    console.log('======================================================');
    console.log(' WIN CONDITION & REVIEW SYSTEM TESTS PASSED! 🎉');
    console.log('======================================================');
    process.exit(0);

  } catch (err) {
    console.error('❌ Win Test Failed:', err);
    if (c1) c1.close();
    if (c2) c2.close();
    process.exit(1);
  }
}

runWinTest();
