/**
 * BINGO Real-Time Online Multiplayer Integration Test
 */
const http = require('http');
const WebSocket = require('ws');

// We'll import server logic or run against a port
const PORT = 3456;
process.env.PORT = PORT;
process.env.HOST = '127.0.0.1';

// Require the server (it will start listening on PORT 3456)
require('../server.js');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- Starting BINGO Online Multiplayer System Tests ---');
  await sleep(400); // Give server a moment to bind

  let c1, c2;
  try {
    // 1. Connect Client 1
    console.log('1. Connecting Client 1 (Host)...');
    c1 = new WebSocket(`ws://127.0.0.1:${PORT}`);
    await new Promise((res, rej) => {
      c1.on('open', res);
      c1.on('error', rej);
    });

    let c1Messages = [];
    c1.on('message', data => {
      const parsed = JSON.parse(data.toString());
      c1Messages.push(parsed);
    });

    // 2. Client 1 Creates Room
    console.log('2. Client 1 creating room...');
    c1.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice (Host)' }));
    await sleep(200);

    const roomCreatedMsg = c1Messages.find(m => m.type === 'ROOM_CREATED');
    if (!roomCreatedMsg) throw new Error('Client 1 did not receive ROOM_CREATED');
    const roomCode = roomCreatedMsg.roomCode;
    const c1SessionToken = roomCreatedMsg.sessionToken;
    console.log(`✓ Room created! Code: "${roomCode}", Token: ${c1SessionToken}`);
    if (roomCode.length !== 6) throw new Error(`Invalid room code length: ${roomCode.length}`);

    // 2b. Test Host trying to START_GAME before Player 2 joins (must fail)
    console.log('2b. Testing START_GAME before Player 2 joins (must be blocked)...');
    c1Messages = [];
    c1.send(JSON.stringify({ type: 'START_GAME' }));
    await sleep(200);
    const prematureStartError = c1Messages.find(m => m.type === 'ERROR' && m.code === 'WAITING_FOR_PLAYER');
    if (!prematureStartError) throw new Error('Server did not block START_GAME before Player 2 joined!');
    console.log('✓ Server correctly rejected START_GAME when only 1 player was in the room!');

    // 3. Connect Client 2 (Guest)
    console.log('3. Connecting Client 2 (Guest)...');
    c2 = new WebSocket(`ws://127.0.0.1:${PORT}`);
    await new Promise((res, rej) => {
      c2.on('open', res);
      c2.on('error', rej);
    });

    let c2Messages = [];
    c2.on('message', data => {
      const parsed = JSON.parse(data.toString());
      c2Messages.push(parsed);
    });

    // 4. Client 2 Joins Room
    console.log(`4. Client 2 joining room "${roomCode}"...`);
    c2.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Bob (Guest)' }));
    await sleep(300);

    const roomJoinedMsg = c2Messages.find(m => m.type === 'ROOM_JOINED');
    if (!roomJoinedMsg) throw new Error('Client 2 did not receive ROOM_JOINED');
    const c2SessionToken = roomJoinedMsg.sessionToken;
    console.log(`✓ Client 2 joined room! Token: ${c2SessionToken}`);

    const playerJoinedMsg = c1Messages.find(m => m.type === 'PLAYER_JOINED');
    if (!playerJoinedMsg) throw new Error('Client 1 did not receive PLAYER_JOINED');
    console.log('✓ Client 1 received PLAYER_JOINED notification');

    // 4b. Host clicks "Start Game" button
    console.log('4b. Host clicking "Start Game" button...');
    c1.send(JSON.stringify({ type: 'START_GAME' }));

    // 5. Verify GAME_STARTED event for both players
    console.log('5. Waiting for GAME_STARTED (synchronized start)...');
    await sleep(400);

    const c1GameStarted = c1Messages.find(m => m.type === 'GAME_STARTED');
    const c2GameStarted = c2Messages.find(m => m.type === 'GAME_STARTED');

    if (!c1GameStarted) throw new Error('Client 1 did not receive GAME_STARTED');
    if (!c2GameStarted) throw new Error('Client 2 did not receive GAME_STARTED');

    console.log('✓ Both players received GAME_STARTED!');
    console.log(`  - P1 Board length: ${c1GameStarted.myBoard.length}`);
    console.log(`  - P2 Board length: ${c2GameStarted.myBoard.length}`);

    // Verify 1..25 range & privacy
    const p1Sorted = [...c1GameStarted.myBoard].sort((a,b)=>a-b);
    const p2Sorted = [...c2GameStarted.myBoard].sort((a,b)=>a-b);
    for (let i = 1; i <= 25; i++) {
      if (p1Sorted[i-1] !== i) throw new Error(`P1 board missing ${i}`);
      if (p2Sorted[i-1] !== i) throw new Error(`P2 board missing ${i}`);
    }
    console.log('✓ Both boards verified: exactly numbers 1 to 25 unique each!');

    // Verify STRICT PRIVACY: P1 board was NOT sent to P2!
    if (c2GameStarted.opponentBoard) throw new Error('PRIVACY VIOLATION: Opponent board was leaked to P2!');
    if (c1GameStarted.opponentBoard) throw new Error('PRIVACY VIOLATION: Opponent board was leaked to P1!');
    console.log('✓ Strict privacy verified: Neither client receives the opponent board!');

    // 6. Gameplay: P1 Calls Number
    c1Messages = [];
    c2Messages = [];
    const p1CallNum = c1GameStarted.myBoard[0];
    console.log(`6. P1 calls number ${p1CallNum}...`);
    c1.send(JSON.stringify({ type: 'CALL_NUMBER', number: p1CallNum }));
    await sleep(200);

    const callSuccess = c1Messages.find(m => m.type === 'CALL_SUCCESS');
    if (!callSuccess || callSuccess.number !== p1CallNum) throw new Error('P1 did not get CALL_SUCCESS');
    console.log(`✓ P1 CALL_SUCCESS verified (Score: ${callSuccess.score})`);

    const oppCalledMsg = c2Messages.find(m => m.type === 'OPPONENT_CALLED_NUMBER');
    if (!oppCalledMsg) throw new Error('P2 did not get OPPONENT_CALLED_NUMBER');
    // Verify privacy: called number is NOT in the message!
    if (oppCalledMsg.number !== undefined || oppCalledMsg.calledNumber !== undefined) {
      throw new Error('PRIVACY VIOLATION: called number leaked in OPPONENT_CALLED_NUMBER!');
    }
    console.log('✓ Strict privacy verified: P2 got OPPONENT_CALLED_NUMBER without the number leaked!');

    // 7. P2 marks wrong number first
    console.log('7. Testing wrong number validation for P2...');
    const wrongNum = (p1CallNum === 1) ? 2 : 1;
    c2Messages = [];
    c2.send(JSON.stringify({ type: 'MARK_CALLED', number: wrongNum }));
    await sleep(200);

    const errorMsg = c2Messages.find(m => m.type === 'ERROR' && m.code === 'INCORRECT_NUMBER');
    if (!errorMsg) throw new Error('P2 did not get INCORRECT_NUMBER error');
    console.log('✓ Server correctly rejected wrong marked number!');

    // 8. P2 marks correct number
    console.log(`8. P2 marks correct number ${p1CallNum}...`);
    c1Messages = [];
    c2Messages = [];
    c2.send(JSON.stringify({ type: 'MARK_CALLED', number: p1CallNum }));
    await sleep(200);

    const markSuccess = c2Messages.find(m => m.type === 'MARK_CALLED_SUCCESS');
    if (!markSuccess || markSuccess.number !== p1CallNum) throw new Error('P2 did not get MARK_CALLED_SUCCESS');
    console.log(`✓ P2 MARK_CALLED_SUCCESS verified (Score: ${markSuccess.score}, Phase: ${markSuccess.turnPhase})`);

    const oppMarkedSuccess = c1Messages.find(m => m.type === 'OPPONENT_MARKED_SUCCESS');
    if (!oppMarkedSuccess) throw new Error('P1 did not get OPPONENT_MARKED_SUCCESS');
    console.log('✓ P1 OPPONENT_MARKED_SUCCESS verified!');

    // 9. Reconnect Test
    console.log('9. Testing reconnection with session token...');
    c2.close();
    await sleep(200);

    const oppDisconnectedMsg = c1Messages.find(m => m.type === 'OPPONENT_DISCONNECTED');
    if (!oppDisconnectedMsg) throw new Error('P1 did not get OPPONENT_DISCONNECTED');
    console.log('✓ P1 received OPPONENT_DISCONNECTED');

    // Reconnect C2
    const c2Reconnected = new WebSocket(`ws://127.0.0.1:${PORT}`);
    await new Promise((res, rej) => {
      c2Reconnected.on('open', res);
      c2Reconnected.on('error', rej);
    });

    let c2ReconMessages = [];
    c2Reconnected.on('message', data => {
      c2ReconMessages.push(JSON.parse(data.toString()));
    });

    c1Messages = [];
    c2Reconnected.send(JSON.stringify({
      type: 'RECONNECT',
      roomCode,
      sessionToken: c2SessionToken
    }));
    await sleep(200);

    const reconMsg = c2ReconMessages.find(m => m.type === 'RECONNECTED');
    if (!reconMsg) throw new Error('C2 did not receive RECONNECTED');
    console.log(`✓ Reconnection successful! PlayerNum: ${reconMsg.playerNum}, Score: ${reconMsg.p2Score}`);

    const oppReconnectedMsg = c1Messages.find(m => m.type === 'OPPONENT_RECONNECTED');
    if (!oppReconnectedMsg) throw new Error('P1 did not get OPPONENT_RECONNECTED');
    console.log('✓ P1 received OPPONENT_RECONNECTED');

    c2Reconnected.close();
    c1.close();

    console.log('\n======================================================');
    console.log(' ALL BINGO MULTIPLAYER INTEGRATION TESTS PASSED! 🎉');
    console.log('======================================================');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    if (c1) c1.close();
    if (c2) c2.close();
    process.exit(1);
  }
}

runTests();
