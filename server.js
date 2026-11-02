/**
 * BINGO - Real-Time Online Multiplayer Game Server
 * Authoritative WebSocket & HTTP Server
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// --- Line Definitions (5x5 BINGO Grid) ---
const LINE_DEFINITIONS = [
  // 5 Rows
  { id: 'row-0', indices: [0, 1, 2, 3, 4] },
  { id: 'row-1', indices: [5, 6, 7, 8, 9] },
  { id: 'row-2', indices: [10, 11, 12, 13, 14] },
  { id: 'row-3', indices: [15, 16, 17, 18, 19] },
  { id: 'row-4', indices: [20, 21, 22, 23, 24] },
  // 5 Columns
  { id: 'col-0', indices: [0, 5, 10, 15, 20] },
  { id: 'col-1', indices: [1, 6, 11, 16, 21] },
  { id: 'col-2', indices: [2, 7, 12, 17, 22] },
  { id: 'col-3', indices: [3, 8, 13, 18, 23] },
  { id: 'col-4', indices: [4, 9, 14, 19, 24] },
  // 2 Diagonals
  { id: 'diag-main', indices: [0, 6, 12, 18, 24] },
  { id: 'diag-anti', indices: [4, 8, 12, 16, 20] }
];

function generateShuffledBoard() {
  const nums = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

function checkLines(player) {
  const newlyCompleted = [];
  for (const line of LINE_DEFINITIONS) {
    if (player.completedLines.includes(line.id)) continue;
    const isComplete = line.indices.every(idx => player.marked[idx] === true);
    if (isComplete) {
      newlyCompleted.push(line);
      player.completedLines.push(line.id);
      line.indices.forEach(idx => player.lineTileIndices.add(idx));
    }
  }
  return newlyCompleted;
}

// Generate unambiguous 6-character room code (e.g. K9P2X4)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode(existingRooms) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    if (!existingRooms.has(code)) return code;
  }
  return 'BINGO' + Math.floor(100 + Math.random() * 900);
}

// In-Memory Room Store
const rooms = new Map();

class Room {
  constructor(code, hostName, hostWs, hostToken) {
    this.code = code;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.status = 'WAITING'; // 'WAITING', 'PLAYING', 'GAME_OVER'
    this.currentPlayer = 1;
    this.turnPhase = 'CALL'; // 'CALL' or 'MARK_CALLED'
    this.pendingCalledNumber = null;
    this.winner = null;

    this.players = {
      1: {
        num: 1,
        name: hostName || 'Player 1',
        token: hostToken,
        ws: hostWs,
        connected: true,
        board: [],
        marked: new Array(25).fill(false),
        score: 0,
        completedLines: [],
        lineTileIndices: new Set()
      },
      2: null
    };
  }

  touch() {
    this.lastActivity = Date.now();
  }

  sendTo(playerNum, data) {
    const p = this.players[playerNum];
    if (p && p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(data));
    }
  }

  broadcast(data) {
    this.sendTo(1, data);
    this.sendTo(2, data);
  }

  initGame() {
    this.status = 'PLAYING';
    this.currentPlayer = 1;
    this.turnPhase = 'CALL';
    this.pendingCalledNumber = null;
    this.winner = null;

    // Generate independent 1-25 boards for each player
    this.players[1].board = generateShuffledBoard();
    this.players[1].marked = new Array(25).fill(false);
    this.players[1].score = 0;
    this.players[1].completedLines = [];
    this.players[1].lineTileIndices = new Set();

    this.players[2].board = generateShuffledBoard();
    this.players[2].marked = new Array(25).fill(false);
    this.players[2].score = 0;
    this.players[2].completedLines = [];
    this.players[2].lineTileIndices = new Set();

    this.touch();

    // Send personalized game start with ONLY player's own private board!
    this.sendTo(1, {
      type: 'GAME_STARTED',
      roomCode: this.code,
      playerNum: 1,
      playerName: this.players[1].name,
      opponentName: this.players[2].name,
      myBoard: this.players[1].board,
      myMarked: this.players[1].marked,
      activePlayer: this.currentPlayer,
      turnPhase: this.turnPhase,
      p1Score: 0,
      p2Score: 0,
      p1Lines: 0,
      p2Lines: 0
    });

    this.sendTo(2, {
      type: 'GAME_STARTED',
      roomCode: this.code,
      playerNum: 2,
      playerName: this.players[2].name,
      opponentName: this.players[1].name,
      myBoard: this.players[2].board,
      myMarked: this.players[2].marked,
      activePlayer: this.currentPlayer,
      turnPhase: this.turnPhase,
      p1Score: 0,
      p2Score: 0,
      p1Lines: 0,
      p2Lines: 0
    });
  }

  getReviewData(playerNum) {
    const p = this.players[playerNum];
    if (!p) return null;
    const unmarkedNumbers = [];
    p.board.forEach((num, idx) => {
      if (!p.marked[idx]) unmarkedNumbers.push(num);
    });
    unmarkedNumbers.sort((a, b) => a - b);
    return {
      num: playerNum,
      name: p.name,
      board: p.board,
      marked: p.marked,
      score: p.score,
      lines: p.completedLines.length,
      lineTileIndices: Array.from(p.lineTileIndices),
      unmarkedNumbers
    };
  }
}

// Clean stale rooms (older than 3 hours)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > 3 * 60 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 30 * 60 * 1000);

// --- HTTP Static File Server ---
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = urlObj.pathname;

  // API: check room
  if (pathname.startsWith('/api/room/')) {
    const code = pathname.split('/')[3]?.toUpperCase();
    const room = rooms.get(code);
    res.setHeader('Content-Type', 'application/json');
    if (!room) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ exists: false, error: 'Room not found' }));
    }
    return res.end(JSON.stringify({
      exists: true,
      code: room.code,
      status: room.status,
      playerCount: room.players[2] ? 2 : 1,
      canJoin: room.status === 'WAITING' && !room.players[2]
    }));
  }

  // API: status
  if (pathname === '/api/status') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      online: true,
      activeRooms: rooms.size,
      time: new Date().toISOString()
    }));
  }

  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(__dirname, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

// --- WebSocket Server ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  ws.roomCode = null;
  ws.playerNum = null;
  ws.playerToken = null;

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw);
      handleClientMessage(ws, data);
    } catch (err) {
      console.error('WS Message parsing error:', err);
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON payload' }));
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && rooms.has(ws.roomCode)) {
      const room = rooms.get(ws.roomCode);
      const p = room.players[ws.playerNum];
      if (p && p.ws === ws) {
        p.connected = false;
        room.touch();
        const opponentNum = ws.playerNum === 1 ? 2 : 1;
        room.sendTo(opponentNum, {
          type: 'OPPONENT_DISCONNECTED',
          playerNum: ws.playerNum,
          message: `${p.name} temporarily disconnected. Waiting for reconnection...`
        });
      }
    }
  });
});

function handleClientMessage(ws, data) {
  const { type } = data;

  switch (type) {
    // 1. Create Room
    case 'CREATE_ROOM': {
      const playerName = (data.playerName || 'Player 1').trim().slice(0, 16);
      const roomCode = generateRoomCode(rooms);
      const sessionToken = crypto.randomUUID();

      const room = new Room(roomCode, playerName, ws, sessionToken);
      rooms.set(roomCode, room);

      ws.roomCode = roomCode;
      ws.playerNum = 1;
      ws.playerToken = sessionToken;

      ws.send(JSON.stringify({
        type: 'ROOM_CREATED',
        roomCode,
        playerNum: 1,
        playerName,
        sessionToken,
        message: 'Room created successfully. Waiting for Player 2 to join.'
      }));
      break;
    }

    // 2. Join Room
    case 'JOIN_ROOM': {
      const roomCode = (data.roomCode || '').trim().toUpperCase();
      const playerName = (data.playerName || 'Player 2').trim().slice(0, 16);

      if (!roomCode || !rooms.has(roomCode)) {
        return ws.send(JSON.stringify({
          type: 'ERROR',
          code: 'ROOM_NOT_FOUND',
          message: `Room code "${roomCode}" not found. Please verify the 6-character code.`
        }));
      }

      const room = rooms.get(roomCode);
      room.touch();

      // Check if this is a reconnecting player
      if (data.sessionToken) {
        if (room.players[1] && room.players[1].token === data.sessionToken) {
          return reconnectPlayer(ws, room, 1);
        }
        if (room.players[2] && room.players[2].token === data.sessionToken) {
          return reconnectPlayer(ws, room, 2);
        }
      }

      // Check if room is already full
      if (room.players[2] && room.players[2].connected) {
        return ws.send(JSON.stringify({
          type: 'ERROR',
          code: 'ROOM_FULL',
          message: `Room "${roomCode}" is full. Exactly 2 players are allowed per room.`
        }));
      }

      // Join as Player 2
      const sessionToken = crypto.randomUUID();
      room.players[2] = {
        num: 2,
        name: playerName,
        token: sessionToken,
        ws,
        connected: true,
        board: [],
        marked: new Array(25).fill(false),
        score: 0,
        completedLines: [],
        lineTileIndices: new Set()
      };

      ws.roomCode = roomCode;
      ws.playerNum = 2;
      ws.playerToken = sessionToken;

      // Notify Player 1 that Player 2 has joined
      room.sendTo(1, {
        type: 'PLAYER_JOINED',
        playerNum: 2,
        playerName,
        message: `${playerName} joined the room! Click "Start Game" to begin.`
      });

      // Notify Player 2 of successful join
      ws.send(JSON.stringify({
        type: 'ROOM_JOINED',
        roomCode,
        playerNum: 2,
        playerName,
        sessionToken,
        hostName: room.players[1].name,
        message: `Joined room "${roomCode}". Waiting for host to start the match.`
      }));

      // Allow Host to manually click "Start Game", with an auto-start fallback
      if (room.startTimer) clearTimeout(room.startTimer);
      room.startTimer = setTimeout(() => {
        if (room.status === 'WAITING' && room.players[2] && room.players[2].connected) {
          room.initGame();
        }
      }, 2500);
      break;
    }

    // 2b. Host Manually Starts Game (Must be 2 connected players)
    case 'START_GAME': {
      if (!ws.roomCode || !rooms.has(ws.roomCode)) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in an active room.' }));
      }
      const room = rooms.get(ws.roomCode);
      room.touch();

      if (ws.playerNum !== 1) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Only the host (Player 1) can start the game.' }));
      }

      if (!room.players[2] || !room.players[2].connected) {
        return ws.send(JSON.stringify({ 
          type: 'ERROR', 
          code: 'WAITING_FOR_PLAYER',
          message: 'Cannot start game until Player 2 joins the room.' 
        }));
      }

      if (room.startTimer) {
        clearTimeout(room.startTimer);
        room.startTimer = null;
      }

      room.initGame();
      break;
    }

    // 3. Reconnect Session
    case 'RECONNECT': {
      const roomCode = (data.roomCode || '').trim().toUpperCase();
      const sessionToken = data.sessionToken;

      if (!roomCode || !rooms.has(roomCode)) {
        return ws.send(JSON.stringify({
          type: 'ERROR',
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found or expired.'
        }));
      }

      const room = rooms.get(roomCode);
      let matchedPlayerNum = null;
      if (room.players[1] && room.players[1].token === sessionToken) matchedPlayerNum = 1;
      else if (room.players[2] && room.players[2].token === sessionToken) matchedPlayerNum = 2;

      if (!matchedPlayerNum) {
        return ws.send(JSON.stringify({
          type: 'ERROR',
          code: 'INVALID_TOKEN',
          message: 'Session token invalid or expired.'
        }));
      }

      reconnectPlayer(ws, room, matchedPlayerNum);
      break;
    }

    // 4. Call Number (Authoritative Turn Validation)
    case 'CALL_NUMBER': {
      if (!ws.roomCode || !rooms.has(ws.roomCode)) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in an active room.' }));
      }
      const room = rooms.get(ws.roomCode);
      room.touch();

      const callerNum = ws.playerNum;
      const number = parseInt(data.number, 10);

      // Validation 1: Room must be in PLAYING status
      if (room.status !== 'PLAYING') {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Game is not in active playing status.' }));
      }

      // Validation 2: Must be caller's turn
      if (room.currentPlayer !== callerNum) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not your turn to call a number!' }));
      }

      // Validation 3: Turn phase must be 'CALL'
      if (room.turnPhase !== 'CALL') {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'You must first mark the number called by your opponent.' }));
      }

      // Validation 4: Valid number range 1-25
      if (isNaN(number) || number < 1 || number > 25) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Number must be between 1 and 25.' }));
      }

      const player = room.players[callerNum];
      const tileIndex = player.board.indexOf(number);
      if (tileIndex === -1) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: `Number ${number} not found on your board!` }));
      }
      if (player.marked[tileIndex]) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: `Number ${number} is already marked!` }));
      }

      // Execute Authoritative Move:
      player.marked[tileIndex] = true;
      player.score += 1;

      const newlyCompleted = checkLines(player);

      // Check Winner: 5 completed lines
      if (player.completedLines.length >= 5) {
        room.status = 'GAME_OVER';
        room.winner = callerNum;
        const p1Review = room.getReviewData(1);
        const p2Review = room.getReviewData(2);

        return room.broadcast({
          type: 'GAME_OVER',
          winnerNum: callerNum,
          winnerName: player.name,
          p1Review,
          p2Review,
          message: `${player.name} completed 5 BINGO lines and won the match!`
        });
      }

      // Transition to Rule 8 MARK_CALLED phase for opponent
      room.pendingCalledNumber = number;
      room.turnPhase = 'MARK_CALLED';

      const opponentNum = callerNum === 1 ? 2 : 1;

      // Notify caller (with their updated score and marked board)
      room.sendTo(callerNum, {
        type: 'CALL_SUCCESS',
        number,
        score: player.score,
        lines: player.completedLines.length,
        newlyCompletedLines: newlyCompleted.map(l => l.id),
        activePlayer: callerNum,
        turnPhase: 'MARK_CALLED',
        message: `Number ${number} called! Tell your opponent verbally to mark it.`
      });

      // Notify opponent (DO NOT REVEAL THE NUMBER TO MAINTAIN STRICT PRIVACY!)
      room.sendTo(opponentNum, {
        type: 'OPPONENT_CALLED_NUMBER',
        callerNum,
        callerName: player.name,
        callerScore: player.score,
        callerLines: player.completedLines.length,
        activePlayer: opponentNum,
        turnPhase: 'MARK_CALLED',
        message: `${player.name} called a number verbally! Find and tap it on your board.`
      });
      break;
    }

    // 5. Mark Called Number (Rule 8 Manual Opponent Marking)
    case 'MARK_CALLED': {
      if (!ws.roomCode || !rooms.has(ws.roomCode)) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in an active room.' }));
      }
      const room = rooms.get(ws.roomCode);
      room.touch();

      const markerNum = ws.playerNum;
      const number = parseInt(data.number, 10);

      if (room.status !== 'PLAYING') {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Game is not in active playing status.' }));
      }

      if (room.turnPhase !== 'MARK_CALLED' || room.pendingCalledNumber === null) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'No called number is pending to mark.' }));
      }

      const callerNum = room.currentPlayer;
      const expectedMarker = callerNum === 1 ? 2 : 1;
      if (markerNum !== expectedMarker) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not your turn to mark the called number.' }));
      }

      // Validate that the number tapped matches the secret pending number called by opponent
      if (number !== room.pendingCalledNumber) {
        return ws.send(JSON.stringify({
          type: 'ERROR',
          code: 'INCORRECT_NUMBER',
          message: "Incorrect number! Listen carefully to your opponent's verbal call."
        }));
      }

      const player = room.players[markerNum];
      const tileIndex = player.board.indexOf(number);
      if (tileIndex === -1 || player.marked[tileIndex]) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Tile already marked or invalid.' }));
      }

      // Execute Authoritative Mark:
      player.marked[tileIndex] = true;
      player.score += 1;

      const newlyCompleted = checkLines(player);

      // Check Winner: 5 completed lines on mark
      if (player.completedLines.length >= 5) {
        room.status = 'GAME_OVER';
        room.winner = markerNum;
        const p1Review = room.getReviewData(1);
        const p2Review = room.getReviewData(2);

        return room.broadcast({
          type: 'GAME_OVER',
          winnerNum: markerNum,
          winnerName: player.name,
          p1Review,
          p2Review,
          message: `${player.name} completed 5 BINGO lines and won the match!`
        });
      }

      // Advance to CALL phase: Marker can now call their own number!
      room.pendingCalledNumber = null;
      room.turnPhase = 'CALL';
      room.currentPlayer = markerNum; // Turn flips to marker!

      room.sendTo(markerNum, {
        type: 'MARK_CALLED_SUCCESS',
        number,
        score: player.score,
        lines: player.completedLines.length,
        newlyCompletedLines: newlyCompleted.map(l => l.id),
        activePlayer: markerNum,
        turnPhase: 'CALL',
        message: `Number ${number} marked! (+1 Pt). Now tap an unmarked tile to call your number.`
      });

      room.sendTo(callerNum, {
        type: 'OPPONENT_MARKED_SUCCESS',
        markerNum,
        markerName: player.name,
        markerScore: player.score,
        markerLines: player.completedLines.length,
        activePlayer: markerNum,
        turnPhase: 'CALL',
        message: `${player.name} marked the called number! Waiting for ${player.name} to call.`
      });
      break;
    }

    // 6. Play Again Request
    case 'PLAY_AGAIN': {
      if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
      const room = rooms.get(ws.roomCode);
      room.touch();

      // Restart game with fresh 1-25 boards
      room.initGame();
      break;
    }

    // 7. Leave Room
    case 'LEAVE_ROOM': {
      if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
      const room = rooms.get(ws.roomCode);
      const opponentNum = ws.playerNum === 1 ? 2 : 1;
      room.sendTo(opponentNum, {
        type: 'OPPONENT_LEFT',
        message: 'Your opponent left the room.'
      });
      rooms.delete(ws.roomCode);
      ws.roomCode = null;
      break;
    }
  }
}

function reconnectPlayer(ws, room, playerNum) {
  const player = room.players[playerNum];
  player.ws = ws;
  player.connected = true;
  room.touch();

  ws.roomCode = room.code;
  ws.playerNum = playerNum;
  ws.playerToken = player.token;

  const opponentNum = playerNum === 1 ? 2 : 1;
  const opponent = room.players[opponentNum];

  ws.send(JSON.stringify({
    type: 'RECONNECTED',
    roomCode: room.code,
    status: room.status,
    playerNum,
    playerName: player.name,
    opponentName: opponent ? opponent.name : null,
    opponentConnected: opponent ? opponent.connected : false,
    myBoard: player.board,
    myMarked: player.marked,
    activePlayer: room.currentPlayer,
    turnPhase: room.turnPhase,
    p1Score: room.players[1].score,
    p2Score: opponent ? opponent.score : 0,
    p1Lines: room.players[1].completedLines.length,
    p2Lines: opponent ? opponent.completedLines.length : 0,
    message: 'Reconnected to game room.'
  }));

  if (opponent && opponent.connected) {
    room.sendTo(opponentNum, {
      type: 'OPPONENT_RECONNECTED',
      playerNum,
      playerName: player.name,
      message: `${player.name} has reconnected!`
    });
  }
}

// Start Server
server.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log(` BINGO Real-Time Game Server running on port ${PORT}`);
  console.log(` Local:   http://localhost:${PORT}`);

  // Display all IPv4 network addresses for local Wi-Fi phones
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(` Network: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('====================================================');
});
