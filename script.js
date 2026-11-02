/**
 * BINGO - Two Player Number Challenge Game
 * Complete Game Engine & Interactions
 */

(() => {
  'use strict';

  // --- Sound Effects System (Web Audio API Synthesizer) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.enabled = localStorage.getItem('bingo_sound_enabled') !== 'false';
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem('bingo_sound_enabled', this.enabled);
      if (this.enabled) {
        this.init();
        this.playPop(520, 0.08);
      }
      return this.enabled;
    }

    playPop(freq = 440, duration = 0.08) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }

    playTilePress() {
      this.playPop(380, 0.06);
    }

    playMarkSuccess() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [440, 660].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);

        gain.gain.setValueAtTime(0.2, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.12);
      });
    }

    playFlip() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    }

    playLineComplete() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0.25, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.28);
      });
    }

    playBingoLetterStamp() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    }

    playVictory() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const chords = [
        [523.25, 659.25, 783.99],       // C
        [587.33, 739.99, 880.00],       // D
        [659.25, 830.61, 987.77],       // E
        [783.99, 987.77, 1174.66, 1567.98] // G + high C
      ];

      const now = this.ctx.currentTime;
      chords.forEach((chord, cIdx) => {
        const startTime = now + cIdx * 0.22;
        chord.forEach(freq => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          const dur = cIdx === chords.length - 1 ? 0.9 : 0.28;
          gain.gain.setValueAtTime(0.18, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + dur);
        });
      });
    }

    playError() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    }
  }

  // --- Confetti Particle System for Celebrations ---
  class ConfettiEngine {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.particles = [];
      this.animId = null;
      this.colors = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#fbbf24'];

      window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    start() {
      this.resize();
      this.particles = [];
      const particleCount = 130;
      for (let i = 0; i < particleCount; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * (this.canvas.height * 0.3) - 50,
          w: Math.random() * 10 + 6,
          h: Math.random() * 7 + 4,
          color: this.colors[Math.floor(Math.random() * this.colors.length)],
          vx: (Math.random() - 0.5) * 5,
          vy: Math.random() * 4 + 2,
          rot: Math.random() * 360,
          vrot: (Math.random() - 0.5) * 10,
          opacity: 1
        });
      }

      if (this.animId) cancelAnimationFrame(this.animId);
      this.render();
    }

    render() {
      if (!this.ctx || !this.canvas) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      let alive = false;
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y > this.canvas.height - 40) {
          p.opacity -= 0.02;
        }

        if (p.opacity > 0) {
          alive = true;
          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rot * Math.PI) / 180);
          this.ctx.globalAlpha = Math.max(0, p.opacity);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          this.ctx.restore();
        }
      }

      if (alive) {
        this.animId = requestAnimationFrame(() => this.render());
      } else {
        this.clear();
      }
    }

    clear() {
      if (this.animId) cancelAnimationFrame(this.animId);
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.particles = [];
    }
  }

  // --- Bingo Game Manager ---
  class BingoGame {
    constructor() {
      this.sound = new SoundFX();
      this.confetti = new ConfettiEngine('confettiCanvas');

      // Game State
      this.currentPlayer = 1;
      this.isFlipping = false;
      this.gameActive = false;
      this.totalTurns = 0;
      this.selectedTileNumber = null;

      // Rule 8: Manual Opponent Number Marking State
      this.pendingCalledNumber = null; // number called by opponent that active player must manually mark
      this.turnPhase = 'CALL'; // 'CALL' (call a number) or 'MARK_CALLED' (must manually mark opponent's called number)

      // Real-Time Online Multiplayer State
      this.gameMode = 'local'; // 'local' or 'online'
      this.online = {
        socket: null,
        roomCode: null,
        playerNum: null,
        sessionToken: null,
        playerName: null,
        opponentName: null,
        isHost: false,
        connected: false,
        myBoard: [],
        myMarked: new Array(25).fill(false)
      };

      // Player States
      this.players = {
        1: {
          name: 'Player 1',
          board: [],           // 25 numbers
          marked: [],          // 25 booleans
          score: 0,
          completedLines: [],  // list of line identifiers e.g. 'row-0'
          lineTileIndices: new Set()
        },
        2: {
          name: 'Player 2',
          board: [],
          marked: [],
          score: 0,
          completedLines: [],
          lineTileIndices: new Set()
        }
      };

      // 12 Line Definitions for 5x5 grid (5 rows, 5 cols, 2 diagonals)
      this.lineDefinitions = [
        // Rows
        { id: 'row-0', type: 'row', index: 0, indices: [0, 1, 2, 3, 4], x1: 5, y1: 10, x2: 95, y2: 10 },
        { id: 'row-1', type: 'row', index: 1, indices: [5, 6, 7, 8, 9], x1: 5, y1: 30, x2: 95, y2: 30 },
        { id: 'row-2', type: 'row', index: 2, indices: [10, 11, 12, 13, 14], x1: 5, y1: 50, x2: 95, y2: 50 },
        { id: 'row-3', type: 'row', index: 3, indices: [15, 16, 17, 18, 19], x1: 5, y1: 70, x2: 95, y2: 70 },
        { id: 'row-4', type: 'row', index: 4, indices: [20, 21, 22, 23, 24], x1: 5, y1: 90, x2: 95, y2: 90 },

        // Columns
        { id: 'col-0', type: 'col', index: 0, indices: [0, 5, 10, 15, 20], x1: 10, y1: 5, x2: 10, y2: 95 },
        { id: 'col-1', type: 'col', index: 1, indices: [1, 6, 11, 16, 21], x1: 30, y1: 5, x2: 30, y2: 95 },
        { id: 'col-2', type: 'col', index: 2, indices: [2, 7, 12, 17, 22], x1: 50, y1: 5, x2: 50, y2: 95 },
        { id: 'col-3', type: 'col', index: 3, indices: [3, 8, 13, 18, 23], x1: 70, y1: 5, x2: 70, y2: 95 },
        { id: 'col-4', type: 'col', index: 4, indices: [4, 9, 14, 19, 24], x1: 90, y1: 5, x2: 90, y2: 95 },

        // Diagonals
        { id: 'diag-main', type: 'diag', index: 0, indices: [0, 6, 12, 18, 24], x1: 8, y1: 8, x2: 92, y2: 92 },
        { id: 'diag-anti', type: 'diag', index: 1, indices: [4, 8, 12, 16, 20], x1: 92, y1: 8, x2: 8, y2: 92 }
      ];

      this.cacheDOMElements();
      this.attachEventListeners();
      this.updateSoundToggleUI();
    }

    cacheDOMElements() {
      // Screens
      this.homeScreen = document.getElementById('homeScreen');
      this.gameScreen = document.getElementById('gameScreen');

      // Cards & Boards
      this.cardFlipper = document.getElementById('cardFlipper');
      this.gridP1 = document.getElementById('gridP1');
      this.gridP2 = document.getElementById('gridP2');
      this.overlayP1 = document.getElementById('overlayP1');
      this.overlayP2 = document.getElementById('overlayP2');
      this.flipCurtain = document.getElementById('flipCurtain');
      this.curtainText = document.getElementById('curtainText');

      // Header & Scores
      this.player1Card = document.getElementById('player1Card');
      this.player2Card = document.getElementById('player2Card');
      this.p1ScoreEl = document.getElementById('p1Score');
      this.p2ScoreEl = document.getElementById('p2Score');
      this.p1LinesCountEl = document.getElementById('p1LinesCount');
      this.p2LinesCountEl = document.getElementById('p2LinesCount');
      this.turnTrackerEl = document.getElementById('turnTracker');

      // BINGO Rack
      this.bingoRack = document.getElementById('bingoRack');
      this.activeLinesChip = document.getElementById('activeLinesChip');

      // Controls
      this.turnIndicatorPill = document.getElementById('turnIndicatorPill');
      this.turnAvatar = document.getElementById('turnAvatar');
      this.turnPrompt = document.getElementById('turnPrompt');
      this.btnSelectNumber = document.getElementById('btnSelectNumber');
      this.statusBanner = document.getElementById('statusBanner');
      this.statusIcon = document.getElementById('statusIcon');
      this.statusText = document.getElementById('statusText');

      // Top & Bottom Navigation Buttons
      this.btnPlayLocal = document.getElementById('btnPlayLocal');
      this.btnPlayGame = this.btnPlayLocal; // Alias
      this.btnHowToPlayHome = document.getElementById('btnHowToPlayHome');
      this.btnQuickHome = document.getElementById('btnQuickHome');
      this.btnHomeFromGame = document.getElementById('btnHomeFromGame');
      this.btnSoundToggle = document.getElementById('btnSoundToggle');
      this.soundIconOn = document.getElementById('soundIconOn');
      this.soundIconOff = document.getElementById('soundIconOff');
      this.btnStats = document.getElementById('btnStats');
      this.btnHelp = document.getElementById('btnHelp');
      this.btnRestart = document.getElementById('btnRestart');

      // Modals
      this.winnerModal = document.getElementById('winnerModal');
      this.winnerTitle = document.getElementById('winnerTitle');
      this.winnerModalP1Score = document.getElementById('winnerModalP1Score');
      this.winnerModalP2Score = document.getElementById('winnerModalP2Score');
      this.winnerModalP1Lines = document.getElementById('winnerModalP1Lines');
      this.winnerModalP2Lines = document.getElementById('winnerModalP2Lines');
      this.btnRestartFromModal = document.getElementById('btnRestartFromModal');
      this.btnHomeFromModal = document.getElementById('btnHomeFromModal');

      this.helpModal = document.getElementById('helpModal');
      this.btnCloseHelp = document.getElementById('btnCloseHelp');
      this.btnGotItHelp = document.getElementById('btnGotItHelp');

      this.statsModal = document.getElementById('statsModal');
      this.btnCloseStats = document.getElementById('btnCloseStats');
      this.btnCloseStatsBtn = document.getElementById('btnCloseStatsBtn');
      this.statTotalTurns = document.getElementById('statTotalTurns');
      this.statP1Marked = document.getElementById('statP1Marked');
      this.statP2Marked = document.getElementById('statP2Marked');
      this.statP1Lines = document.getElementById('statP1Lines');
      this.statP2Lines = document.getElementById('statP2Lines');

      // Separate Player Board Review Elements
      this.p1ReviewCard = document.getElementById('p1ReviewCard');
      this.p2ReviewCard = document.getElementById('p2ReviewCard');
      this.p1ReviewGrid = document.getElementById('p1ReviewGrid');
      this.p2ReviewGrid = document.getElementById('p2ReviewGrid');
      this.p1ReviewStatusTag = document.getElementById('p1ReviewStatusTag');
      this.p2ReviewStatusTag = document.getElementById('p2ReviewStatusTag');
      this.p1ReviewScore = document.getElementById('p1ReviewScore');
      this.p2ReviewScore = document.getElementById('p2ReviewScore');
      this.p1ReviewLines = document.getElementById('p1ReviewLines');
      this.p2ReviewLines = document.getElementById('p2ReviewLines');
      this.p1ReviewMarkedRatio = document.getElementById('p1ReviewMarkedRatio');
      this.p2ReviewMarkedRatio = document.getElementById('p2ReviewMarkedRatio');
      this.p1UnmarkedText = document.getElementById('p1UnmarkedText');
      this.p2UnmarkedText = document.getElementById('p2UnmarkedText');
      this.p1UnmarkedChips = document.getElementById('p1UnmarkedChips');
      this.p2UnmarkedChips = document.getElementById('p2UnmarkedChips');

      // Online Multiplayer Home Buttons
      this.btnCreateRoom = document.getElementById('btnCreateRoom');
      this.btnJoinRoom = document.getElementById('btnJoinRoom');

      // Online Multiplayer Header Elements
      this.onlineRoomPill = document.getElementById('onlineRoomPill');
      this.onlineRoomCodeDisplay = document.getElementById('onlineRoomCodeDisplay');
      this.onlineUserRoleTag = document.getElementById('onlineUserRoleTag');
      this.gameModeTag = document.getElementById('gameModeTag');
      this.disconnectAlertBanner = document.getElementById('disconnectAlertBanner');
      this.disconnectAlertText = document.getElementById('disconnectAlertText');

      // Lobby Modal Elements
      this.lobbyModal = document.getElementById('lobbyModal');
      this.lobbyRoomCode = document.getElementById('lobbyRoomCode');
      this.btnCopyRoomCode = document.getElementById('btnCopyRoomCode');
      this.btnShareRoomLink = document.getElementById('btnShareRoomLink');
      this.copyIcon = document.getElementById('copyIcon');
      this.lobbyStatusPill = document.getElementById('lobbyStatusPill');
      this.lobbyStatusText = document.getElementById('lobbyStatusText');
      this.lobbyP1Name = document.getElementById('lobbyP1Name');
      this.lobbyP2Slot = document.getElementById('lobbyP2Slot');
      this.lobbyP2Name = document.getElementById('lobbyP2Name');
      this.lobbyP2Status = document.getElementById('lobbyP2Status');
      this.btnStartGame = document.getElementById('btnStartGame');
      this.btnCancelLobby = document.getElementById('btnCancelLobby');
      this.btnCloseLobby = document.getElementById('btnCloseLobby');

      // Join Modal Elements
      this.joinModal = document.getElementById('joinModal');
      this.joinRoomCodeInput = document.getElementById('joinRoomCodeInput');
      this.joinErrorBanner = document.getElementById('joinErrorBanner');
      this.joinErrorText = document.getElementById('joinErrorText');
      this.btnSubmitJoin = document.getElementById('btnSubmitJoin');
      this.btnCancelJoin = document.getElementById('btnCancelJoin');
      this.btnCloseJoin = document.getElementById('btnCloseJoin');

      // Settings Modal Elements
      this.settingsModal = document.getElementById('settingsModal');
      this.btnCloseSettings = document.getElementById('btnCloseSettings');
      this.btnCloseSettingsBtn = document.getElementById('btnCloseSettingsBtn');
      this.backendStatusLabel = document.getElementById('backendStatusLabel');
      this.supabaseUrlInput = document.getElementById('supabaseUrlInput');
      this.supabaseKeyInput = document.getElementById('supabaseKeyInput');
      this.settingsFeedback = document.getElementById('settingsFeedback');
      this.settingsFeedbackText = document.getElementById('settingsFeedbackText');
      this.btnTestSupabase = document.getElementById('btnTestSupabase');
      this.btnSaveSupabase = document.getElementById('btnSaveSupabase');
      this.btnClearSupabase = document.getElementById('btnClearSupabase');
    }

    attachEventListeners() {
      // Home Screen Actions (Pass & Play, Create Room, Join Room, Settings, Help)
      if (this.btnPlayGame) {
        this.btnPlayGame.addEventListener('click', () => {
          this.sound.playPop(520);
          this.startLocalGame();
        });
      }

      if (this.btnPlayLocal) {
        this.btnPlayLocal.addEventListener('click', () => {
          this.sound.playPop(520);
          this.startLocalGame();
        });
      }

      if (this.btnCreateRoom) {
        this.btnCreateRoom.addEventListener('click', () => {
          this.handleCreateRoomClick();
        });
      }

      if (this.btnJoinRoom) {
        this.btnJoinRoom.addEventListener('click', () => {
          this.openJoinModal();
        });
      }

      if (this.btnHowToPlayHome) {
        this.btnHowToPlayHome.addEventListener('click', () => {
          this.sound.playPop(440);
          this.openHelpModal();
        });
      }

      // Header Controls
      if (this.btnQuickHome) {
        this.btnQuickHome.addEventListener('click', () => {
          this.sound.playPop(440);
          if (this.gameMode === 'online') {
            if (confirm('Leave online match and return to menu?')) {
              this.leaveOnlineRoom();
            }
          } else {
            this.showHomeScreen();
          }
        });
      }

      if (this.btnHomeFromGame) {
        this.btnHomeFromGame.addEventListener('click', () => {
          this.sound.playPop(440);
          if (this.gameMode === 'online') {
            if (confirm('Leave online match and return to menu?')) {
              this.leaveOnlineRoom();
            }
          } else {
            this.showHomeScreen();
          }
        });
      }

      if (this.btnSoundToggle) {
        this.btnSoundToggle.addEventListener('click', () => {
          this.sound.toggle();
          this.updateSoundToggleUI();
        });
      }

      // Bottom Control Buttons
      if (this.btnHelp) {
        this.btnHelp.addEventListener('click', () => {
          this.sound.playPop(440);
          this.openHelpModal();
        });
      }

      if (this.btnStats) {
        this.btnStats.addEventListener('click', () => {
          this.sound.playPop(440);
          this.openStatsModal();
        });
      }

      if (this.btnRestart) {
        this.btnRestart.addEventListener('click', () => {
          this.sound.playPop(400);
          if (this.gameMode === 'online') {
            if (confirm('Leave current online room and return to menu?')) {
              this.leaveOnlineRoom();
            }
          } else {
            if (confirm('Restart game? Current progress will be reset.')) {
              this.startNewGame();
            }
          }
        });
      }

      // Call Number Button
      if (this.btnSelectNumber) {
        this.btnSelectNumber.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleCallNumberClick();
        });
      }

      // Help Modal Actions
      if (this.btnCloseHelp) {
        this.btnCloseHelp.addEventListener('click', () => this.closeHelpModal());
      }
      if (this.btnGotItHelp) {
        this.btnGotItHelp.addEventListener('click', () => this.closeHelpModal());
      }

      // Stats Modal Actions
      if (this.btnCloseStats) {
        this.btnCloseStats.addEventListener('click', () => this.closeStatsModal());
      }
      if (this.btnCloseStatsBtn) {
        this.btnCloseStatsBtn.addEventListener('click', () => this.closeStatsModal());
      }

      // Winner Modal Actions
      if (this.btnRestartFromModal) {
        this.btnRestartFromModal.addEventListener('click', () => {
          this.confetti.clear();
          if (this.winnerModal) this.winnerModal.style.display = 'none';
          if (this.gameMode === 'online') {
            this.sendOnlineMessage({ type: 'PLAY_AGAIN' });
            this.setStatus('Rematch requested! Waiting for server to initialize game...', 'info');
          } else {
            this.startNewGame();
          }
        });
      }

      if (this.btnHomeFromModal) {
        this.btnHomeFromModal.addEventListener('click', () => {
          this.confetti.clear();
          if (this.winnerModal) this.winnerModal.style.display = 'none';
          if (this.gameMode === 'online') {
            this.leaveOnlineRoom();
          } else {
            this.showHomeScreen();
          }
        });
      }

      // Lobby Modal Actions
      if (this.btnCopyRoomCode) {
        this.btnCopyRoomCode.addEventListener('click', () => this.copyRoomCode());
      }
      if (this.btnShareRoomLink) {
        this.btnShareRoomLink.addEventListener('click', () => this.shareRoomLink());
      }
      if (this.btnStartGame) {
        this.btnStartGame.addEventListener('click', () => {
          this.sound.playPop(520);
          this.sendOnlineMessage({ type: 'START_GAME' });
        });
      }
      if (this.btnCancelLobby) {
        this.btnCancelLobby.addEventListener('click', () => this.leaveOnlineRoom());
      }
      if (this.btnCloseLobby) {
        this.btnCloseLobby.addEventListener('click', () => this.leaveOnlineRoom());
      }

      // Join Modal Actions
      if (this.btnSubmitJoin) {
        this.btnSubmitJoin.addEventListener('click', () => this.handleJoinRoomSubmit());
      }
      if (this.btnCancelJoin) {
        this.btnCancelJoin.addEventListener('click', () => this.closeJoinModal());
      }
      if (this.btnCloseJoin) {
        this.btnCloseJoin.addEventListener('click', () => this.closeJoinModal());
      }
      if (this.joinRoomCodeInput) {
        this.joinRoomCodeInput.addEventListener('input', (e) => {
          e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
          this.hideJoinError();
        });
        this.joinRoomCodeInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleJoinRoomSubmit();
          }
        });
      }

      // Settings Modal Actions
      if (this.btnCloseSettings) {
        this.btnCloseSettings.addEventListener('click', () => this.closeSettingsModal());
      }
      if (this.btnCloseSettingsBtn) {
        this.btnCloseSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
      }
      if (this.btnTestSupabase) {
        this.btnTestSupabase.addEventListener('click', () => this.testSupabaseConnection());
      }
      if (this.btnSaveSupabase) {
        this.btnSaveSupabase.addEventListener('click', () => this.saveSupabaseSettings());
      }
      if (this.btnClearSupabase) {
        this.btnClearSupabase.addEventListener('click', () => this.clearSupabaseSettings());
      }

      // Board Review Filter Tabs
      document.querySelectorAll('.review-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.sound.playPop(480);
          const tab = e.currentTarget.dataset.tab;
          this.switchReviewTab(tab);
        });
      });

      // Keyboard Accessibility
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeHelpModal();
          this.closeStatsModal();
          this.closeJoinModal();
          this.closeSettingsModal();
        }
      });

      // Initialize Online State from URL or previous session
      this.initOnlineURLAndSession();
    }

    updateSoundToggleUI() {
      if (this.sound.enabled) {
        this.soundIconOn.style.display = 'block';
        this.soundIconOff.style.display = 'none';
      } else {
        this.soundIconOn.style.display = 'none';
        this.soundIconOff.style.display = 'block';
      }
    }

    showHomeScreen() {
      this.gameActive = false;
      this.gameScreen.style.display = 'none';
      this.homeScreen.style.display = 'flex';
      if (this.onlineRoomPill) this.onlineRoomPill.style.display = 'none';
      if (this.disconnectAlertBanner) this.disconnectAlertBanner.style.display = 'none';
      this.confetti.clear();
    }

    startLocalGame() {
      this.gameMode = 'local';
      if (this.onlineRoomPill) this.onlineRoomPill.style.display = 'none';
      if (this.disconnectAlertBanner) this.disconnectAlertBanner.style.display = 'none';
      if (this.gameModeTag) this.gameModeTag.textContent = '2-PLAYER PASS & PLAY';
      this.showGameScreen();
    }

    showGameScreen() {
      this.homeScreen.style.display = 'none';
      this.gameScreen.style.display = 'flex';
      this.startNewGame();
    }

    /**
     * Generate exactly 25 numbers from 1 to 25, shuffled independently
     */
    generatePlayerBoard() {
      const numbers = [];
      for (let i = 1; i <= 25; i++) {
        numbers.push(i);
      }
      return this.shuffleArray(numbers);
    }

    /**
     * Start a new game:
     * - Each player's 5x5 board contains exactly 25 numbers.
     * - Numbers range from 1 to 25 only.
     * - Every number from 1 to 25 appears exactly once on each player's board.
     * - Shuffled independently for Player 1 and Player 2.
     * - Rule 8: Manual Opponent Number Marking initialized.
     */
    startNewGame() {
      this.gameActive = true;
      this.currentPlayer = 1;
      this.isFlipping = false;
      this.totalTurns = 0;
      this.selectedTileNumber = null;
      this.pendingCalledNumber = null;
      this.turnPhase = 'CALL';
      this.btnSelectNumber.textContent = 'Call Number';

      // Generate 1 to 25 unique numbers independently for Player 1 and Player 2
      const p1Numbers = this.generatePlayerBoard();
      const p2Numbers = this.generatePlayerBoard();

      this.players[1] = {
        name: 'Player 1',
        board: p1Numbers,
        marked: new Array(25).fill(false),
        score: 0,
        completedLines: [],
        lineTileIndices: new Set()
      };

      this.players[2] = {
        name: 'Player 2',
        board: p2Numbers,
        marked: new Array(25).fill(false),
        score: 0,
        completedLines: [],
        lineTileIndices: new Set()
      };

      // Reset Card Flipper position to Player 1
      this.cardFlipper.classList.remove('flipped-to-p2');

      // Clear Line Overlays
      this.overlayP1.innerHTML = '';
      this.overlayP2.innerHTML = '';

      // Render Grids
      this.renderBoard(1);
      this.renderBoard(2);

      // Update UI displays
      this.updateScoresUI();
      this.updateTurnUI();
      this.updateBingoLettersUI();
      this.updateControlsForCall();
      this.setStatus("Player 1's turn! Tap any orange tile (1–25) to call your first number.", 'info');

      this.sound.playPop(480);
    }

    shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    /**
     * Render the 5x5 board for a given player
     */
    renderBoard(playerNum) {
      const grid = playerNum === 1 ? this.gridP1 : this.gridP2;
      const player = this.players[playerNum];
      grid.innerHTML = '';

      player.board.forEach((number, index) => {
        const tile = document.createElement('div');
        tile.className = 'bingo-tile';
        tile.dataset.player = playerNum;
        tile.dataset.index = index;
        tile.dataset.number = number;

        if (player.marked[index]) {
          tile.classList.add('tile-marked');
          if (player.lineTileIndices.has(index)) {
            tile.classList.add('tile-in-winning-line');
          }
          tile.innerHTML = `
            <span class="tile-number">${number}</span>
            <span class="tile-mark-symbol">✓</span>
          `;
        } else {
          // Strict Private Calling: All unmarked tiles look identical (zero visual hint)
          tile.innerHTML = `<span class="tile-number">${number}</span>`;
        }

        // Tap on tile event
        tile.addEventListener('click', () => {
          this.handleTileClick(playerNum, index, number);
        });

        grid.appendChild(tile);
      });
    }

    /**
     * Handle user tap on a tile on the board
     * Strict Private Calling: Opponent must listen to verbal call and click that number
     */
    handleTileClick(playerNum, index, number) {
      if (this.gameMode === 'online') {
        this.handleOnlineTileClick(index, number);
        return;
      }

      // Disallow interactions during flip, inactive game, or tapping opponent's board
      if (!this.gameActive || this.isFlipping) return;
      if (playerNum !== this.currentPlayer) return;

      const player = this.players[playerNum];

      // --- PHASE 1: MUST MARK OPPONENT'S CALLED NUMBER (STRICT PRIVATE) ---
      if (this.turnPhase === 'MARK_CALLED' && this.pendingCalledNumber !== null) {
        if (player.marked[index]) {
          this.sound.playError();
          this.setStatus(`Number ${number} is already marked! Tap the number called verbally by your opponent.`, 'error');
          return;
        }

        if (number !== this.pendingCalledNumber) {
          this.sound.playError();
          this.setStatus(`Incorrect number! Listen to the number called verbally by your opponent and tap it.`, 'error');
          return;
        }

        // Valid click on the called number: Mark it manually!
        this.sound.playTilePress();
        this.markCalledNumber(number);
        return;
      }

      // --- PHASE 2: CALL A NUMBER ---
      if (player.marked[index]) {
        this.sound.playError();
        this.setStatus(`Number ${number} has already been marked! Choose an unmarked tile to call.`, 'error');
        return;
      }

      this.sound.playTilePress();

      // If already targeted, double tap confirms and calls it!
      if (this.selectedTileNumber === number) {
        this.processCallNumber(number);
        return;
      }

      // Target this tile for calling
      this.selectedTileNumber = number;
      this.highlightMatchingTileOnBoard(number);
      this.setStatus(`Selected #${number}. Tell your opponent #${number} and click "Call Number" to confirm!`, 'info');
    }

    highlightMatchingTileOnBoard(number) {
      this.clearTileTargetGlow();
      if (!number) return;

      const activeGrid = (this.gameMode === 'online' || this.currentPlayer === 1) ? this.gridP1 : this.gridP2;
      const tiles = activeGrid.querySelectorAll('.bingo-tile');
      tiles.forEach(tile => {
        if (parseInt(tile.dataset.number, 10) === number && !tile.classList.contains('tile-marked')) {
          tile.classList.add('tile-targeted');
        }
      });
    }

    clearTileTargetGlow() {
      const allTiles = document.querySelectorAll('.bingo-tile');
      allTiles.forEach(tile => tile.classList.remove('tile-targeted'));
    }

    /**
     * Strict Private System: No tile is highlighted or hinted to the opponent
     */
    highlightCalledTileOnActiveBoard() {
      // Intentionally empty - strict privacy preserved
    }

    /**
     * Shake tile to draw player attention
     */
    shakeTile(playerNum, number) {
      const activeGrid = playerNum === 1 ? this.gridP1 : this.gridP2;
      const targetTile = Array.from(activeGrid.children).find(
        t => parseInt(t.dataset.number, 10) === number
      );
      if (targetTile) {
        targetTile.classList.remove('tile-shake');
        void targetTile.offsetWidth; // force reflow
        targetTile.classList.add('tile-shake');
      }
    }

    /**
     * Handle "Call Number" button click
     */
    handleCallNumberClick() {
      if (this.gameMode === 'online') {
        this.handleOnlineCallClick();
        return;
      }

      if (!this.gameActive || this.isFlipping) return;

      // If active player must first mark opponent's called number
      if (this.turnPhase === 'MARK_CALLED' && this.pendingCalledNumber !== null) {
        this.sound.playError();
        const opponentNum = this.currentPlayer === 1 ? 2 : 1;
        this.setStatus(`Player ${this.currentPlayer}: First tap and mark the number called by Player ${opponentNum}!`, 'error');
        return;
      }

      // In CALL phase: active player must tap an unmarked tile to call
      if (!this.selectedTileNumber) {
        this.sound.playError();
        this.setStatus(`Player ${this.currentPlayer}: Please tap an unmarked tile on your board to call it!`, 'error');
        return;
      }

      this.processCallNumber(this.selectedTileNumber);
    }

    /**
     * Rule 8: Manually mark opponent's called number on active player's board
     */
    markCalledNumber(number) {
      const activePlayerNum = this.currentPlayer;
      const player = this.players[activePlayerNum];
      const tileIndex = player.board.indexOf(number);

      if (tileIndex === -1 || player.marked[tileIndex]) {
        return;
      }

      // 1. Mark on active player's board and increment score
      player.marked[tileIndex] = true;
      player.score += 1; // Score updated only after manual marking

      // 2. Visual Mark & Pop Animation
      const activeGrid = activePlayerNum === 1 ? this.gridP1 : this.gridP2;
      const tileEl = activeGrid.children[tileIndex];
      if (tileEl) {
        tileEl.classList.remove('tile-targeted', 'tile-shake');
        tileEl.classList.add('tile-marked', 'tile-pop-anim');
        tileEl.innerHTML = `
          <span class="tile-number">${number}</span>
          <span class="tile-mark-symbol">✓</span>
        `;
      }

      this.sound.playMarkSuccess();
      this.clearTileTargetGlow();
      this.selectedTileNumber = null;

      // 3. Check completed lines
      const newlyCompletedLines = this.checkCompletedLines(activePlayerNum);
      if (newlyCompletedLines.length > 0) {
        newlyCompletedLines.forEach(lineDef => {
          player.completedLines.push(lineDef.id);
          lineDef.indices.forEach(idx => player.lineTileIndices.add(idx));
        });

        // Apply smooth dimming and soft green glow
        player.lineTileIndices.forEach(idx => {
          if (activeGrid.children[idx]) {
            activeGrid.children[idx].classList.add('tile-in-winning-line');
          }
        });

        this.sound.playLineComplete();
        setTimeout(() => this.sound.playBingoLetterStamp(), 300);
      }

      // Update UI Scores & BINGO Rack immediately
      this.updateScoresUI();
      this.updateBingoLettersUI(activePlayerNum);

      // 4. Winner Check: If this mark completed 5 lines, player wins immediately!
      if (player.completedLines.length >= 5) {
        this.handleWinner(activePlayerNum);
        return;
      }

      // 5. Advance to CALL phase: Player can now call their own number!
      this.pendingCalledNumber = null;
      this.turnPhase = 'CALL';
      this.updateControlsForCall();
      if (newlyCompletedLines.length > 0) {
        const letter = 'BINGO'[player.completedLines.length - 1];
        this.setStatus(`🎉 Line Completed! Letter "${letter}" crossed out! Now choose an unmarked tile to call your number.`, 'success');
      } else {
        this.setStatus(`Number ${number} marked! (+1 Pt). Tell your opponent your chosen number and tap it to mark.`, 'success');
      }
    }

    /**
     * Active player calls a number from their own board
     */
    processCallNumber(number) {
      const activePlayerNum = this.currentPlayer;
      const player = this.players[activePlayerNum];

      // 1. Validation (Range 1-25)
      if (isNaN(number) || number < 1 || number > 25) {
        this.sound.playError();
        this.setStatus('Please choose a number between 1 and 25!', 'error');
        return;
      }

      const tileIndex = player.board.indexOf(number);
      if (tileIndex === -1) {
        this.sound.playError();
        this.setStatus(`Number ${number} is not found on Player ${activePlayerNum}'s card!`, 'error');
        return;
      }

      if (player.marked[tileIndex]) {
        this.sound.playError();
        this.setStatus(`Number ${number} has already been marked! Choose an unmarked tile.`, 'error');
        return;
      }

      // 2. Mark the number on caller's board and increment caller's score
      player.marked[tileIndex] = true;
      player.score += 1; // Caller gets +1 point for calling & marking

      // 3. Visual Mark & Pop Animation
      const activeGrid = activePlayerNum === 1 ? this.gridP1 : this.gridP2;
      const tileEl = activeGrid.children[tileIndex];
      if (tileEl) {
        tileEl.classList.remove('tile-targeted');
        tileEl.classList.add('tile-marked', 'tile-pop-anim');
        tileEl.innerHTML = `
          <span class="tile-number">${number}</span>
          <span class="tile-mark-symbol">✓</span>
        `;
      }

      this.sound.playMarkSuccess();
      this.clearTileTargetGlow();
      this.selectedTileNumber = null;
      this.totalTurns++;

      // 4. Check completed lines for caller
      const newlyCompletedLines = this.checkCompletedLines(activePlayerNum);
      if (newlyCompletedLines.length > 0) {
        newlyCompletedLines.forEach(lineDef => {
          player.completedLines.push(lineDef.id);
          lineDef.indices.forEach(idx => player.lineTileIndices.add(idx));
        });

        // Apply smooth dimming and soft green glow
        player.lineTileIndices.forEach(idx => {
          if (activeGrid.children[idx]) {
            activeGrid.children[idx].classList.add('tile-in-winning-line');
          }
        });

        this.sound.playLineComplete();
        setTimeout(() => this.sound.playBingoLetterStamp(), 300);
      }

      // Update UI Scores & BINGO Rack immediately
      this.updateScoresUI();
      this.updateBingoLettersUI(activePlayerNum);

      // 5. Winner Check: 5 lines completed
      if (player.completedLines.length >= 5) {
        this.handleWinner(activePlayerNum);
        return;
      }

      // 6. Set Rule 8 state and perform automatic 3D Card Flip to opponent (Strict Private Calling)
      this.pendingCalledNumber = number;
      this.turnPhase = 'MARK_CALLED';

      if (newlyCompletedLines.length > 0) {
        const letter = 'BINGO'[player.completedLines.length - 1];
        this.setStatus(`🎉 Line Completed! Letter "${letter}" crossed out! Passing turn to opponent...`, 'success');
        setTimeout(() => {
          this.performCardFlip();
        }, 750);
      } else {
        this.performCardFlip();
      }
    }

    /**
     * Check if any lines (rows, cols, diagonals) are newly completed
     */
    checkCompletedLines(playerNum) {
      const player = this.players[playerNum];
      const newlyCompleted = [];

      for (const lineDef of this.lineDefinitions) {
        // If this line was already counted, skip! (Each line counted only once)
        if (player.completedLines.includes(lineDef.id)) {
          continue;
        }

        // Check if all 5 tiles in this line are marked
        const isComplete = lineDef.indices.every(idx => player.marked[idx] === true);
        if (isComplete) {
          newlyCompleted.push(lineDef);
        }
      }

      return newlyCompleted;
    }

    /**
     * Completed lines visual effect:
     * Bright connecting lines, bars, and strokes removed per requirement.
     * All winning line visual effects are handled smoothly via tile dimming and soft green glow.
     */
    drawDirectionalLineOverlay(playerNum, lineDef) {
      // Connecting lines, bars, and strokes removed
    }

    /**
     * Smooth 3D Card Flip Animation between Player 1 and Player 2
     * Strict Private System: No called number is revealed on screen or curtain
     */
    performCardFlip() {
      this.isFlipping = true;
      this.btnSelectNumber.disabled = true;

      const nextPlayer = this.currentPlayer === 1 ? 2 : 1;
      this.curtainText.textContent = `Flipping to Player ${nextPlayer}...\nPass device to Player ${nextPlayer}`;
      this.flipCurtain.classList.add('curtain-show');

      this.sound.playFlip();

      // Trigger 3D rotation
      if (nextPlayer === 2) {
        this.cardFlipper.classList.add('flipped-to-p2');
      } else {
        this.cardFlipper.classList.remove('flipped-to-p2');
      }

      // Mid-flip turn switch (at 350ms)
      setTimeout(() => {
        this.currentPlayer = nextPlayer;
        this.updateScoresUI();
        this.updateTurnUI();
        this.updateBingoLettersUI();
      }, 350);

      // Finish flip transition (at 700ms)
      setTimeout(() => {
        this.flipCurtain.classList.remove('curtain-show');
        this.isFlipping = false;
        this.btnSelectNumber.disabled = false;
        this.updateControlsForMarkCalled();
        const opponentNum = this.currentPlayer === 1 ? 2 : 1;
        this.setStatus(`Player ${this.currentPlayer}: Listen to Player ${opponentNum}'s verbal call and tap that number on your board.`, 'info');
      }, 700);
    }

    /**
     * Update Controls when active player must mark opponent's called number
     * (Strict Private System: Zero visual hints or numbers revealed)
     */
    updateControlsForMarkCalled() {
      this.btnSelectNumber.textContent = 'Call Number';
      const opponentNum = this.currentPlayer === 1 ? 2 : 1;
      this.turnPrompt.textContent = `Player ${this.currentPlayer}: Mark the number called by Player ${opponentNum}`;
    }

    /**
     * Update Controls when active player is ready to call their own number
     */
    updateControlsForCall() {
      this.btnSelectNumber.textContent = 'Call Number';
      this.turnPrompt.textContent = `Player ${this.currentPlayer}: Tap an unmarked tile to call`;
    }

    /**
     * Update Turn Indicators & Badges
     */
    updateTurnUI() {
      if (this.gameMode === 'online') {
        this.updateOnlineTurnUI();
        return;
      }

      const isP1 = this.currentPlayer === 1;

      // Player cards active highlight
      this.player1Card.classList.toggle('active-turn', isP1);
      this.player2Card.classList.toggle('active-turn', !isP1);

      this.turnTrackerEl.textContent = isP1 ? 'P1 TURN' : 'P2 TURN';

      // Turn indicator below board
      this.turnAvatar.textContent = isP1 ? 'P1' : 'P2';
      this.turnAvatar.classList.toggle('p2-avatar', !isP1);

      if (this.turnPhase === 'MARK_CALLED' && this.pendingCalledNumber !== null) {
        const opponentNum = this.currentPlayer === 1 ? 2 : 1;
        this.turnPrompt.textContent = `Player ${this.currentPlayer}: Mark the number called by Player ${opponentNum}`;
      } else {
        this.turnPrompt.textContent = `Player ${this.currentPlayer}: Call a number verbally and tap it to mark`;
      }
    }

    /**
     * Update Scores and Line count displays
     */
    updateScoresUI() {
      this.p1ScoreEl.textContent = this.players[1] ? this.players[1].score : 0;
      this.p2ScoreEl.textContent = this.players[2] ? this.players[2].score : 0;

      const p1Lines = this.players[1] ? Math.min(5, this.players[1].completedLines.length) : 0;
      const p2Lines = this.players[2] ? Math.min(5, this.players[2].completedLines.length) : 0;

      this.p1LinesCountEl.textContent = `${p1Lines}/5`;
      this.p2LinesCountEl.textContent = `${p2Lines}/5`;

      const pNum = this.gameMode === 'online' ? (this.online.playerNum || 1) : this.currentPlayer;
      const activePlayer = this.players[pNum];
      if (activePlayer && this.activeLinesChip) {
        this.activeLinesChip.textContent = `${Math.min(5, activePlayer.completedLines.length)}/5`;
      }
    }

    /**
     * Update B-I-N-G-O letters rack above the board
     * Strikes out completed lines (up to 5) with red ❌
     */
    updateBingoLettersUI(targetPlayerNum) {
      const pNum = targetPlayerNum || (this.gameMode === 'online' ? (this.online.playerNum || 1) : this.currentPlayer);
      const activePlayer = this.players[pNum];
      const completedCount = activePlayer ? Math.min(5, activePlayer.completedLines.length) : 0;

      const rack = this.bingoRack || document.getElementById('bingoRack');
      if (rack) {
        const letterBoxes = rack.querySelectorAll('.bingo-letter-box');
        letterBoxes.forEach((box, index) => {
          if (index < completedCount) {
            box.classList.add('struck');
          } else {
            box.classList.remove('struck');
          }
        });

        // Update the rack label to indicate whose progress is shown
        const rackLabel = typeof document !== 'undefined' && typeof document.querySelector === 'function'
          ? document.querySelector('.bingo-rack-label')
          : null;
        if (rackLabel) {
          if (this.gameMode === 'online') {
            rackLabel.textContent = `YOUR BINGO PROGRESS (${completedCount}/5)`;
          } else {
            rackLabel.textContent = `PLAYER ${pNum} BINGO PROGRESS (${completedCount}/5)`;
          }
        }
      }

      if (this.activeLinesChip) {
        this.activeLinesChip.textContent = `${completedCount}/5`;
      }
    }

    /**
     * Status message banner helper
     * Ensures only ONE emoji is displayed at the beginning of the banner (via this.statusIcon)
     * and prevents duplicate or trailing emojis from template strings or inputs.
     */
    setStatus(msg, type = 'info') {
      this.statusBanner.className = 'status-message-banner';
      if (type === 'error') {
        this.statusBanner.classList.add('status-error');
        this.statusIcon.textContent = '⚠️';
      } else if (type === 'success') {
        this.statusBanner.classList.add('status-success');
        this.statusIcon.textContent = '🎉';
      } else {
        this.statusBanner.classList.add('status-flip');
        this.statusIcon.textContent = '💡';
      }

      // Strip any leading or trailing emojis from text so only statusIcon displays the single leading emoji
      const cleanMsg = typeof msg === 'string'
        ? msg.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/gu, '')
             .replace(/[\s\p{Extended_Pictographic}\uFE0F\u200D]+$/gu, '')
             .trim()
        : msg;

      this.statusText.textContent = cleanMsg;
    }

    /**
     * Winner Celebration System
     */
    handleWinner(winnerPlayerNum) {
      this.gameActive = false;
      this.sound.playVictory();
      this.confetti.start();

      const winner = this.players[winnerPlayerNum];
      this.winnerTitle.textContent = `${winner.name.toUpperCase()} WINS!`;

      this.winnerModalP1Score.textContent = this.players[1].score;
      this.winnerModalP2Score.textContent = this.players[2].score;
      this.winnerModalP1Lines.textContent = `${this.players[1].completedLines.length} Lines`;
      this.winnerModalP2Lines.textContent = `${this.players[2].completedLines.length} Lines`;

      this.setStatus(`${winner.name} won the BINGO match!`, 'success');

      // Populate separate player board review system
      this.renderGameReview(winnerPlayerNum);

      setTimeout(() => {
        this.winnerModal.style.display = 'flex';
      }, 500);
    }

    /**
     * Separate Player Board Review System
     * Calculates and renders both players' 5x5 boards, marked/unmarked numbers,
     * scores, and WINNER or LOSER status dynamically from live game state.
     */
    renderGameReview(winnerPlayerNum) {
      this.switchReviewTab('both');

      [1, 2].forEach(pNum => {
        const player = this.players[pNum];
        const isWinner = winnerPlayerNum === pNum;
        const isP1 = pNum === 1;

        // 1. Status Tag (WINNER or LOSER)
        const statusTag = isP1 ? this.p1ReviewStatusTag : this.p2ReviewStatusTag;
        if (statusTag) {
          statusTag.textContent = isWinner ? '🏆 WINNER' : 'LOSER';
          statusTag.className = `review-status-tag ${isWinner ? 'tag-winner' : 'tag-loser'}`;
        }

        // 2. Metrics (Score, Lines, Marked Count)
        const scoreEl = isP1 ? this.p1ReviewScore : this.p2ReviewScore;
        const linesEl = isP1 ? this.p1ReviewLines : this.p2ReviewLines;
        const markedRatioEl = isP1 ? this.p1ReviewMarkedRatio : this.p2ReviewMarkedRatio;

        const markedIndices = [];
        const unmarkedNumbers = [];

        player.board.forEach((num, idx) => {
          if (player.marked[idx]) {
            markedIndices.push(idx);
          } else {
            unmarkedNumbers.push(num);
          }
        });

        if (scoreEl) scoreEl.textContent = `${player.score} pts`;
        if (linesEl) linesEl.textContent = `${player.completedLines.length} / 5`;
        if (markedRatioEl) markedRatioEl.textContent = `${markedIndices.length} / 25`;

        // 3. Render 5x5 Review Board Grid
        const gridEl = isP1 ? this.p1ReviewGrid : this.p2ReviewGrid;
        if (gridEl) {
          gridEl.innerHTML = '';
          player.board.forEach((num, idx) => {
            const isMarked = player.marked[idx];
            const isWinningLine = player.lineTileIndices && player.lineTileIndices.has(idx);

            const tile = document.createElement('div');
            tile.className = `review-tile ${isMarked ? 'tile-marked' : 'tile-unmarked'}${isWinningLine ? ' tile-in-winning-line' : ''}`;

            const numSpan = document.createElement('span');
            numSpan.className = 'review-tile-num';
            numSpan.textContent = num;

            const symSpan = document.createElement('span');
            symSpan.className = 'review-tile-symbol';
            symSpan.textContent = isMarked ? '✓' : '—';

            tile.appendChild(numSpan);
            tile.appendChild(symSpan);
            gridEl.appendChild(tile);
          });
        }

        // 4. Unmarked Numbers Display (sorted ascending for clean presentation)
        unmarkedNumbers.sort((a, b) => a - b);

        const textEl = isP1 ? this.p1UnmarkedText : this.p2UnmarkedText;
        const chipsEl = isP1 ? this.p1UnmarkedChips : this.p2UnmarkedChips;

        if (textEl) {
          if (unmarkedNumbers.length === 0) {
            textEl.textContent = 'Unmarked Numbers: None (All 25 marked!)';
          } else {
            textEl.textContent = `Unmarked Numbers: ${unmarkedNumbers.join(', ')}`;
          }
        }

        if (chipsEl) {
          if (unmarkedNumbers.length === 0) {
            chipsEl.innerHTML = '<span class="unmarked-empty-notice">All 25 numbers marked! 🎉</span>';
          } else {
            chipsEl.innerHTML = unmarkedNumbers
              .map(num => `<span class="unmarked-num-chip">${num}</span>`)
              .join('');
          }
        }
      });
    }

    /**
     * Switch Review Tab (both / p1 / p2)
     */
    switchReviewTab(tab) {
      document.querySelectorAll('.review-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });

      if (!this.p1ReviewCard || !this.p2ReviewCard) return;

      if (tab === 'both') {
        this.p1ReviewCard.style.display = 'flex';
        this.p2ReviewCard.style.display = 'flex';
      } else if (tab === 'p1') {
        this.p1ReviewCard.style.display = 'flex';
        this.p2ReviewCard.style.display = 'none';
      } else if (tab === 'p2') {
        this.p1ReviewCard.style.display = 'none';
        this.p2ReviewCard.style.display = 'flex';
      }
    }

    // Modal Helpers
    openHelpModal() {
      this.helpModal.style.display = 'flex';
    }

    closeHelpModal() {
      this.helpModal.style.display = 'none';
    }

    openStatsModal() {
      const p1MarkedCount = this.players[1].marked.filter(Boolean).length;
      const p2MarkedCount = this.players[2].marked.filter(Boolean).length;

      this.statTotalTurns.textContent = this.totalTurns;
      this.statP1Marked.textContent = `${p1MarkedCount} / 25`;
      this.statP2Marked.textContent = `${p2MarkedCount} / 25`;
      this.statP1Lines.textContent = this.players[1].completedLines.length;
      this.statP2Lines.textContent = this.players[2].completedLines.length;

      this.statsModal.style.display = 'flex';
    }

    closeStatsModal() {
      this.statsModal.style.display = 'none';
    }

    // =========================================================================
    // REAL-TIME ONLINE MULTIPLAYER SYSTEM
    // =========================================================================

    getWebSocketUrl() {
      if (!window.location.host || window.location.protocol === 'file:') {
        return 'ws://localhost:3000';
      }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }

    connectWebSocket(callback) {
      if (this.online.socket && this.online.socket.readyState === WebSocket.OPEN) {
        if (callback) callback();
        return;
      }

      if (this.online.socket && this.online.socket.readyState === WebSocket.CONNECTING) {
        const checkConn = setInterval(() => {
          if (this.online.socket && this.online.socket.readyState === WebSocket.OPEN) {
            clearInterval(checkConn);
            if (callback) callback();
          }
        }, 50);
        return;
      }

      try {
        this.online.socket = new WebSocket(this.getWebSocketUrl());

        this.online.socket.onopen = () => {
          this.online.connected = true;
          if (callback) callback();
        };

        this.online.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleOnlineServerMessage(data);
          } catch (err) {
            console.error('Error parsing server message:', err);
          }
        };

        this.online.socket.onerror = (err) => {
          console.warn('WebSocket connection error:', err);
          const errorMsg = 'Cannot reach multiplayer server. Please ensure "node server.js" is running on port 3000, or play offline with Pass & Play!';
          if (this.joinModal && this.joinModal.style.display === 'flex') {
            this.showJoinError(errorMsg);
          } else if (this.lobbyModal && this.lobbyModal.style.display === 'flex') {
            if (this.lobbyStatusText) this.lobbyStatusText.textContent = 'Server unreachable.';
            this.setStatus(errorMsg, 'error');
          } else {
            this.setStatus(errorMsg, 'error');
          }
        };

        this.online.socket.onclose = () => {
          this.online.connected = false;
          if (this.gameMode === 'online' && this.gameActive) {
            if (this.disconnectAlertBanner) {
              this.disconnectAlertText.textContent = 'Connection lost. Please wait or check your internet connection.';
              this.disconnectAlertBanner.style.display = 'flex';
            }
          }
        };
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        const errorMsg = 'Unable to reach multiplayer network. Start server with "node server.js".';
        if (this.joinModal && this.joinModal.style.display === 'flex') {
          this.showJoinError(errorMsg);
        } else {
          this.setStatus(errorMsg, 'error');
        }
      }
    }

    isSupabaseActive() {
      return !!(window.BingoSupabase && window.BingoSupabase.isConfigured());
    }

    async handleSupabaseMessage(payload) {
      const { type } = payload;
      const sb = window.BingoSupabase;

      switch (type) {
        case 'CREATE_ROOM': {
          const res = await sb.createRoom(payload.playerName || 'Player 1');
          this.online.isSupabaseMode = true;
          this.setupSupabaseRealtime(res.roomCode);
          this.handleOnlineServerMessage({
            type: 'ROOM_CREATED',
            roomCode: res.roomCode,
            sessionToken: res.sessionToken,
            playerName: res.playerName,
            playerNum: 1
          });
          break;
        }

        case 'JOIN_ROOM': {
          const res = await sb.joinRoom(payload.roomCode, payload.playerName || 'Player 2');
          this.online.isSupabaseMode = true;
          this.setupSupabaseRealtime(res.roomCode);
          this.handleOnlineServerMessage({
            type: 'ROOM_JOINED',
            roomCode: res.roomCode,
            sessionToken: res.sessionToken,
            playerName: res.playerName,
            hostName: res.hostName,
            playerNum: 2
          });
          break;
        }

        case 'START_GAME': {
          await sb.startGame(this.online.roomCode, this.online.sessionToken);
          break;
        }

        case 'CALL_NUMBER': {
          const res = await sb.callNumber(this.online.roomCode, this.online.sessionToken, payload.number);
          if (!res.game_over) {
            this.handleOnlineServerMessage({
              type: 'CALL_SUCCESS',
              number: payload.number,
              score: res.score,
              lines: res.lines,
              turnPhase: res.turn_phase,
              activePlayer: res.active_player
            });
          }
          break;
        }

        case 'MARK_CALLED': {
          try {
            const res = await sb.markCalled(this.online.roomCode, this.online.sessionToken, payload.number);
            if (!res.game_over) {
              this.handleOnlineServerMessage({
                type: 'MARK_CALLED_SUCCESS',
                number: payload.number,
                score: res.score,
                lines: res.lines,
                turnPhase: res.turn_phase,
                activePlayer: res.active_player
              });
            }
          } catch (err) {
            this.sound.playError();
            this.setStatus(err.message || 'Incorrect number! Listen carefully.', 'error');
          }
          break;
        }

        case 'LEAVE_ROOM': {
          await sb.leaveRoom(this.online.roomCode, this.online.sessionToken);
          sb.unsubscribe();
          break;
        }

        case 'RECONNECT': {
          try {
            const state = await sb.getPlayerState(payload.roomCode, payload.sessionToken);
            this.online.isSupabaseMode = true;
            this.setupSupabaseRealtime(payload.roomCode);
            this.handleOnlineServerMessage({
              type: 'RECONNECTED',
              roomCode: state.room_code,
              playerNum: state.player_num,
              playerName: state.player_name,
              opponentName: state.opponent_name,
              status: state.status,
              myBoard: state.my_board,
              myMarked: state.my_marked,
              activePlayer: state.active_player,
              turnPhase: state.turn_phase,
              p1Score: state.my_score,
              p2Score: state.opp_score
            });
          } catch (err) {
            sessionStorage.removeItem('bingo_session');
          }
          break;
        }
      }
    }

    setupSupabaseRealtime(roomCode) {
      const sb = window.BingoSupabase;
      if (!sb) return;

      if (this.lobbyPollInterval) {
        clearInterval(this.lobbyPollInterval);
        this.lobbyPollInterval = null;
      }

      // Lightweight polling fallback while in lobby to ensure mobile connection reliability
      this.lobbyPollInterval = setInterval(async () => {
        if (this.gameActive || !this.lobbyModal || this.lobbyModal.style.display !== 'flex') {
          if (this.lobbyPollInterval) {
            clearInterval(this.lobbyPollInterval);
            this.lobbyPollInterval = null;
          }
          return;
        }

        if (sb && sb.client) {
          try {
            const { data: row } = await sb.client
              .from('bingo_rooms')
              .select('status, guest_name')
              .eq('code', roomCode)
              .maybeSingle();

            if (row && (row.status === 'READY' || row.guest_name)) {
              if (this.online.playerNum === 1 && !this.online.opponentName) {
                this.handleOnlineServerMessage({
                  type: 'PLAYER_JOINED',
                  playerName: row.guest_name || 'Player 2'
                });
              }
            }
          } catch (e) {}
        }
      }, 1500);

      sb.subscribeToRoom(roomCode, async (newRow) => {
        if (!newRow) return;

        // 1. Guest joins lobby
        if (newRow.status === 'READY' && this.online.playerNum === 1 && !this.gameActive) {
          if (this.lobbyPollInterval) {
            clearInterval(this.lobbyPollInterval);
            this.lobbyPollInterval = null;
          }
          this.handleOnlineServerMessage({
            type: 'PLAYER_JOINED',
            playerName: newRow.guest_name
          });
        }

        // 2. Game starts
        if (newRow.status === 'PLAYING' && !this.gameActive) {
          if (this.lobbyPollInterval) {
            clearInterval(this.lobbyPollInterval);
            this.lobbyPollInterval = null;
          }
          try {
            const myState = await sb.getPlayerState(this.online.roomCode, this.online.sessionToken);
            this.handleOnlineServerMessage({
              type: 'GAME_STARTED',
              roomCode: myState.room_code,
              playerNum: myState.player_num,
              playerName: myState.player_name,
              opponentName: myState.opponent_name,
              myBoard: myState.my_board,
              myMarked: myState.my_marked,
              activePlayer: myState.active_player,
              turnPhase: myState.turn_phase,
              p1Score: myState.player_num === 1 ? myState.my_score : myState.opp_score,
              p2Score: myState.player_num === 2 ? myState.my_score : myState.opp_score
            });
          } catch (err) {
            console.error('Failed to get player state on game start:', err);
          }
          return;
        }

        // 3. In-game synchronized turns
        if (newRow.status === 'PLAYING' && this.gameActive) {
          const myNum = this.online.playerNum;

          if (newRow.turn_phase === 'MARK_CALLED' && newRow.active_player === myNum) {
            this.handleOnlineServerMessage({
              type: 'OPPONENT_CALLED_NUMBER',
              callerNum: myNum === 1 ? 2 : 1,
              callerName: this.online.opponentName,
              callerScore: myNum === 1 ? newRow.p2_score : newRow.p1_score,
              callerLines: myNum === 1 ? newRow.p2_lines : newRow.p1_lines
            });
          } else if (newRow.turn_phase === 'CALL' && newRow.active_player !== myNum) {
            this.handleOnlineServerMessage({
              type: 'OPPONENT_MARKED_SUCCESS',
              markerNum: newRow.active_player,
              markerName: this.online.opponentName,
              markerScore: myNum === 1 ? newRow.p2_score : newRow.p1_score,
              markerLines: myNum === 1 ? newRow.p2_lines : newRow.p1_lines,
              activePlayer: newRow.active_player,
              turnPhase: newRow.turn_phase
            });
          }
        }

        // 4. Game Over
        if (newRow.status === 'GAME_OVER') {
          this.handleOnlineServerMessage({
            type: 'GAME_OVER',
            winnerNum: newRow.winner_player,
            winnerName: newRow.winner_player === 1 ? newRow.host_name : newRow.guest_name,
            review: newRow.game_review
          });
        }

        // 5. Opponent left
        if (newRow.status === 'ABANDONED') {
          this.handleOnlineServerMessage({
            type: 'OPPONENT_LEFT',
            message: newRow.last_action_message || 'Opponent left the match.'
          });
        }
      });
    }

    sendOnlineMessage(payload) {
      if (this.isSupabaseActive()) {
        this.handleSupabaseMessage(payload).catch(err => {
          console.error('[Supabase RPC Error]', err);
          this.handleOnlineServerMessage({
            type: 'ERROR',
            message: err.message || 'Operation failed.'
          });
        });
        return;
      }

      if (this.online.socket && this.online.socket.readyState === WebSocket.OPEN) {
        this.online.socket.send(JSON.stringify(payload));
      } else {
        this.connectWebSocket(() => {
          this.online.socket.send(JSON.stringify(payload));
        });
      }
    }

    handleCreateRoomClick() {
      this.sound.playPop(520);
      if (this.isSupabaseActive()) {
        this.sendOnlineMessage({
          type: 'CREATE_ROOM',
          playerName: 'Player 1'
        });
      } else {
        this.connectWebSocket(() => {
          this.sendOnlineMessage({
            type: 'CREATE_ROOM',
            playerName: 'Player 1'
          });
        });
      }
    }

    openJoinModal() {
      this.sound.playPop(440);
      this.hideJoinError();
      if (this.joinRoomCodeInput) {
        this.joinRoomCodeInput.value = '';
      }
      this.isJoining = false;
      if (this.btnSubmitJoin) {
        this.btnSubmitJoin.disabled = false;
        this.btnSubmitJoin.textContent = 'Connect & Play';
      }
      this.joinModal.style.display = 'flex';
      setTimeout(() => {
        if (this.joinRoomCodeInput) this.joinRoomCodeInput.focus();
      }, 100);
    }

    closeJoinModal() {
      this.joinModal.style.display = 'none';
      this.isJoining = false;
      if (this.btnSubmitJoin) {
        this.btnSubmitJoin.disabled = false;
        this.btnSubmitJoin.textContent = 'Connect & Play';
      }
      this.hideJoinError();
    }

    showJoinError(msg) {
      this.isJoining = false;
      if (this.btnSubmitJoin) {
        this.btnSubmitJoin.disabled = false;
        this.btnSubmitJoin.textContent = 'Connect & Play';
      }
      if (this.joinErrorText && this.joinErrorBanner) {
        this.joinErrorText.textContent = msg;
        this.joinErrorBanner.style.display = 'block';
      }
    }

    hideJoinError() {
      if (this.joinErrorBanner) {
        this.joinErrorBanner.style.display = 'none';
      }
    }

    handleJoinRoomSubmit() {
      if (this.isJoining) return;

      const rawVal = this.joinRoomCodeInput ? this.joinRoomCodeInput.value : '';
      const code = (rawVal || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
      if (!code || code.length !== 6) {
        this.sound.playError();
        this.showJoinError('Please enter a valid 6-character room code.');
        return;
      }

      this.isJoining = true;
      if (this.btnSubmitJoin) {
        this.btnSubmitJoin.disabled = true;
        this.btnSubmitJoin.textContent = 'Connecting...';
      }
      this.hideJoinError();

      console.log(`[Multiplayer Join] Initiating join request for room: ${code}`);

      this.sound.playPop(520);
      if (this.isSupabaseActive()) {
        this.sendOnlineMessage({
          type: 'JOIN_ROOM',
          roomCode: code,
          playerName: 'Player 2'
        });
      } else {
        this.connectWebSocket(() => {
          this.sendOnlineMessage({
            type: 'JOIN_ROOM',
            roomCode: code,
            playerName: 'Player 2'
          });
        });
      }
    }

    copyRoomCode() {
      if (!this.online.roomCode) return;
      const code = this.online.roomCode;
      
      const onSuccess = () => {
        this.sound.playPop(600);
        if (this.btnCopyRoomCode) {
          const origHtml = this.btnCopyRoomCode.innerHTML;
          this.btnCopyRoomCode.innerHTML = '<span>✅</span> Copied!';
          setTimeout(() => {
            this.btnCopyRoomCode.innerHTML = origHtml;
          }, 2000);
        }
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(onSuccess).catch(() => {
          this.copyFallback(code, onSuccess);
        });
      } else {
        this.copyFallback(code, onSuccess);
      }
    }

    copyFallback(text, onSuccess) {
      const temp = document.createElement('input');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand('copy');
        if (onSuccess) onSuccess();
      } catch (e) {
        console.error('Copy fallback failed:', e);
      }
      document.body.removeChild(temp);
    }

    shareRoomLink() {
      if (!this.online.roomCode) return;
      const joinUrl = `${window.location.origin}${window.location.pathname}?room=${this.online.roomCode}`;
      
      if (navigator.share) {
        navigator.share({
          title: 'Play BINGO 1v1 Online',
          text: `Join my BINGO match! Room Code: ${this.online.roomCode}`,
          url: joinUrl
        }).catch(() => {
          this.copyRoomCode();
        });
      } else {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(joinUrl).then(() => {
            this.sound.playPop(600);
            if (this.btnShareRoomLink) {
              const origHtml = this.btnShareRoomLink.innerHTML;
              this.btnShareRoomLink.innerHTML = '<span>🔗</span> Link Copied!';
              setTimeout(() => {
                this.btnShareRoomLink.innerHTML = origHtml;
              }, 2000);
            }
          }).catch(() => this.copyRoomCode());
        } else {
          this.copyRoomCode();
        }
      }
    }

    leaveOnlineRoom() {
      if (this.lobbyPollInterval) {
        clearInterval(this.lobbyPollInterval);
        this.lobbyPollInterval = null;
      }
      if (this.online.roomCode) {
        this.sendOnlineMessage({ type: 'LEAVE_ROOM' });
      }
      if (window.BingoSupabase) {
        window.BingoSupabase.unsubscribe();
      }
      sessionStorage.removeItem('bingo_session');
      this.online.roomCode = null;
      this.online.playerNum = null;
      this.online.sessionToken = null;
      this.online.isHost = false;
      this.online.isSupabaseMode = false;
      this.gameMode = 'local';

      if (this.lobbyModal) this.lobbyModal.style.display = 'none';
      if (this.joinModal) this.joinModal.style.display = 'none';
      if (this.winnerModal) this.winnerModal.style.display = 'none';
      if (this.onlineRoomPill) this.onlineRoomPill.style.display = 'none';
      if (this.disconnectAlertBanner) this.disconnectAlertBanner.style.display = 'none';

      this.showHomeScreen();
    }

    initOnlineURLAndSession() {
      // 1. Check URL parameters for ?room=CODE
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam && roomParam.trim().length === 6) {
        this.openJoinModal();
        if (this.joinRoomCodeInput) {
          this.joinRoomCodeInput.value = roomParam.trim().toUpperCase();
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // 2. Check stored session in sessionStorage for auto-reconnect
      const stored = sessionStorage.getItem('bingo_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.roomCode && parsed.sessionToken) {
            this.connectWebSocket(() => {
              this.sendOnlineMessage({
                type: 'RECONNECT',
                roomCode: parsed.roomCode,
                sessionToken: parsed.sessionToken
              });
            });
          }
        } catch (e) {
          sessionStorage.removeItem('bingo_session');
        }
      }
    }

    handleOnlineServerMessage(data) {
      const { type } = data;

      switch (type) {
        case 'ROOM_CREATED': {
          this.sound.playPop(520);
          this.online.roomCode = data.roomCode;
          this.online.playerNum = 1;
          this.online.sessionToken = data.sessionToken;
          this.online.playerName = data.playerName;
          this.online.isHost = true;

          sessionStorage.setItem('bingo_session', JSON.stringify({
            roomCode: data.roomCode,
            sessionToken: data.sessionToken,
            playerNum: 1
          }));

          // Update Lobby Modal UI
          this.lobbyRoomCode.textContent = data.roomCode;
          this.lobbyP1Name.textContent = `${data.playerName} (Host - You)`;
          this.lobbyP2Name.textContent = 'Player 2';
          this.lobbyP2Status.textContent = '⏳ Waiting to join...';
          this.lobbyP2Slot.classList.remove('connected');
          this.lobbyStatusPill.className = 'lobby-status-pill';
          this.lobbyStatusText.textContent = 'Waiting for Player 2 to join...';
          
          if (this.btnStartGame) {
            this.btnStartGame.style.display = 'block';
            this.btnStartGame.disabled = true;
            this.btnStartGame.innerHTML = '<span>⏳</span> Waiting for Player 2...';
          }

          this.lobbyModal.style.display = 'flex';
          break;
        }

        case 'PLAYER_JOINED': {
          this.sound.playPop(640);
          this.online.opponentName = data.playerName;
          this.lobbyP2Name.textContent = `${data.playerName}`;
          this.lobbyP2Status.textContent = '🟢 Connected!';
          this.lobbyP2Slot.classList.add('connected');
          this.lobbyStatusPill.className = 'lobby-status-pill connected';
          this.lobbyStatusText.textContent = `${data.playerName} connected! Ready to start.`;

          if (this.btnStartGame) {
            this.btnStartGame.style.display = 'block';
            this.btnStartGame.disabled = false;
            this.btnStartGame.innerHTML = '<span>▶</span> Start Game';
          }
          break;
        }

        case 'ROOM_JOINED': {
          this.sound.playPop(520);
          this.online.roomCode = data.roomCode;
          this.online.playerNum = 2;
          this.online.sessionToken = data.sessionToken;
          this.online.playerName = data.playerName;
          this.online.opponentName = data.hostName;
          this.online.isHost = false;

          sessionStorage.setItem('bingo_session', JSON.stringify({
            roomCode: data.roomCode,
            sessionToken: data.sessionToken,
            playerNum: 2
          }));

          this.closeJoinModal();

          // Show lobby briefly before game starts
          this.lobbyRoomCode.textContent = data.roomCode;
          this.lobbyP1Name.textContent = `${data.hostName} (Host)`;
          this.lobbyP2Name.textContent = `${data.playerName} (You)`;
          this.lobbyP2Status.textContent = '🟢 Connected!';
          this.lobbyP2Slot.classList.add('connected');
          this.lobbyStatusPill.className = 'lobby-status-pill connected';
          this.lobbyStatusText.textContent = 'Connected! Waiting for host to start match...';

          if (this.btnStartGame) {
            this.btnStartGame.style.display = 'none'; // Guest waits for host
          }

          this.lobbyModal.style.display = 'flex';
          break;
        }

        case 'RECONNECTED': {
          this.closeJoinModal();
          if (this.disconnectAlertBanner) this.disconnectAlertBanner.style.display = 'none';

          if (data.status === 'WAITING') {
            this.online.roomCode = data.roomCode;
            this.online.playerNum = data.playerNum;
            this.online.isHost = data.playerNum === 1;
            this.lobbyRoomCode.textContent = data.roomCode;
            this.lobbyP1Name.textContent = `${data.playerName} (Host - You)`;
            this.lobbyP2Name.textContent = 'Player 2';
            this.lobbyP2Status.textContent = '⏳ Waiting to join...';
            this.lobbyP2Slot.classList.remove('connected');
            this.lobbyStatusPill.className = 'lobby-status-pill';
            this.lobbyStatusText.textContent = 'Waiting for Player 2 to join...';

            if (this.btnStartGame) {
              this.btnStartGame.style.display = data.playerNum === 1 ? 'block' : 'none';
              this.btnStartGame.disabled = true;
              this.btnStartGame.innerHTML = '<span>⏳</span> Waiting for Player 2...';
            }

            this.lobbyModal.style.display = 'flex';
          } else {
            if (this.lobbyModal) this.lobbyModal.style.display = 'none';
            this.setupOnlineGame(data);
          }
          break;
        }

        case 'GAME_STARTED': {
          this.closeJoinModal();
          if (this.lobbyModal) this.lobbyModal.style.display = 'none';
          if (this.disconnectAlertBanner) this.disconnectAlertBanner.style.display = 'none';
          this.setupOnlineGame(data);
          break;
        }

        case 'CALL_SUCCESS': {
          const myNum = this.online.playerNum;
          this.players[myNum].score = data.score;
          const tileIndex = this.online.myBoard.indexOf(data.number);
          if (tileIndex !== -1) {
            this.online.myMarked[tileIndex] = true;
            this.players[myNum].marked[tileIndex] = true;
          }

          // Authoritatively check for completed lines on caller's board
          const newlyCompleted = this.checkCompletedLines(myNum);
          if (newlyCompleted.length > 0) {
            newlyCompleted.forEach(lineDef => {
              this.players[myNum].completedLines.push(lineDef.id);
              lineDef.indices.forEach(idx => this.players[myNum].lineTileIndices.add(idx));
            });
            this.sound.playLineComplete();
            setTimeout(() => this.sound.playBingoLetterStamp(), 300);
          } else {
            this.sound.playPop(520);
          }

          this.currentPlayer = data.activePlayer;
          this.turnPhase = data.turnPhase;
          this.selectedTileNumber = null;
          this.clearTileTargetGlow();

          this.renderOnlineBoard();
          this.updateScoresUI();
          this.updateBingoLettersUI(myNum);
          this.updateOnlineTurnUI();
          if (newlyCompleted.length > 0) {
            const letter = 'BINGO'[this.players[myNum].completedLines.length - 1];
            this.setStatus(`🎉 Line Completed! Letter "${letter}" crossed out! Number ${data.number} marked. Tell your opponent ${data.number} verbally.`, 'success');
          } else {
            this.setStatus(`🎉 Number ${data.number} marked! (+1 Pt). Tell your opponent ${data.number} verbally and wait for them to mark it.`, 'success');
          }
          break;
        }

        case 'OPPONENT_CALLED_NUMBER': {
          // Strict privacy: No called number is revealed in the payload
          this.sound.playPop(520);
          this.currentPlayer = this.online.playerNum;
          this.turnPhase = 'MARK_CALLED';
          this.selectedTileNumber = null;
          this.clearTileTargetGlow();

          const oppNum = data.callerNum;
          if (this.players[oppNum]) {
            this.players[oppNum].score = data.callerScore;
          }
          this.updateScoresUI();
          this.updateBingoLettersUI();
          this.updateOnlineTurnUI();
          this.setStatus(`${data.callerName} called a number verbally! Find and tap that number on your board to mark it.`, 'info');
          break;
        }

        case 'MARK_CALLED_SUCCESS': {
          const myNum = this.online.playerNum;
          this.players[myNum].score = data.score;
          const tileIndex = this.online.myBoard.indexOf(data.number);
          if (tileIndex !== -1) {
            this.online.myMarked[tileIndex] = true;
            this.players[myNum].marked[tileIndex] = true;
          }

          // Authoritatively check for completed lines on marker's board
          const newlyCompleted = this.checkCompletedLines(myNum);
          if (newlyCompleted.length > 0) {
            newlyCompleted.forEach(lineDef => {
              this.players[myNum].completedLines.push(lineDef.id);
              lineDef.indices.forEach(idx => this.players[myNum].lineTileIndices.add(idx));
            });
            this.sound.playLineComplete();
            setTimeout(() => this.sound.playBingoLetterStamp(), 300);
          } else {
            this.sound.playMarkSuccess();
          }

          this.currentPlayer = data.activePlayer;
          this.turnPhase = data.turnPhase; // 'CALL'
          this.selectedTileNumber = null;
          this.clearTileTargetGlow();

          this.renderOnlineBoard();
          this.updateScoresUI();
          this.updateBingoLettersUI(myNum);
          this.updateOnlineTurnUI();
          if (newlyCompleted.length > 0) {
            const letter = 'BINGO'[this.players[myNum].completedLines.length - 1];
            this.setStatus(`🎉 Line Completed! Letter "${letter}" crossed out! Now choose an unmarked tile to call your number.`, 'success');
          } else {
            this.setStatus(`🎉 Number ${data.number} marked! (+1 Pt). Now choose an unmarked tile to call your number.`, 'success');
          }
          break;
        }

        case 'OPPONENT_MARKED_SUCCESS': {
          const oppNum = data.markerNum;
          if (this.players[oppNum]) {
            this.players[oppNum].score = data.markerScore;
          }
          this.currentPlayer = data.activePlayer;
          this.turnPhase = data.turnPhase;
          this.updateScoresUI();
          this.updateBingoLettersUI();
          this.updateOnlineTurnUI();
          this.setStatus(`${data.markerName} marked the number! Waiting for ${data.markerName} to call their number.`, 'info');
          break;
        }

        case 'GAME_OVER': {
          this.handleOnlineGameOver(data);
          break;
        }

        case 'OPPONENT_DISCONNECTED': {
          if (this.disconnectAlertBanner) {
            this.disconnectAlertText.textContent = data.message || 'Opponent temporarily disconnected. Waiting for reconnection...';
            this.disconnectAlertBanner.style.display = 'flex';
          }
          break;
        }

        case 'OPPONENT_RECONNECTED': {
          if (this.disconnectAlertBanner) {
            this.disconnectAlertBanner.style.display = 'none';
          }
          this.sound.playPop(580);
          this.setStatus(data.message || 'Opponent reconnected! Game resuming.', 'info');
          break;
        }

        case 'OPPONENT_LEFT': {
          if (this.disconnectAlertBanner) {
            this.disconnectAlertText.textContent = data.message || 'Opponent left the match.';
            this.disconnectAlertBanner.style.display = 'flex';
          }
          this.setStatus('Opponent left the room.', 'error');
          break;
        }

        case 'ERROR': {
          this.sound.playError();
          if (this.joinModal && this.joinModal.style.display === 'flex') {
            this.showJoinError(data.message || 'Error occurred');
          } else {
            this.setStatus(data.message || 'An error occurred', 'error');
          }
          break;
        }
      }
    }

    setupOnlineGame(data) {
      this.gameMode = 'online';
      this.gameActive = true;
      this.online.roomCode = data.roomCode;
      this.online.playerNum = data.playerNum;
      this.online.playerName = data.playerName;
      this.online.opponentName = data.opponentName;
      this.online.myBoard = data.myBoard;
      this.online.myMarked = data.myMarked || new Array(25).fill(false);

      this.currentPlayer = data.activePlayer;
      this.turnPhase = data.turnPhase;
      this.selectedTileNumber = null;

      const myNum = data.playerNum;
      const oppNum = myNum === 1 ? 2 : 1;

      this.players[myNum] = {
        name: `${data.playerName} (You)`,
        board: data.myBoard,
        marked: [...this.online.myMarked],
        score: myNum === 1 ? (data.p1Score || 0) : (data.p2Score || 0),
        completedLines: [],
        lineTileIndices: new Set()
      };

      this.players[oppNum] = {
        name: data.opponentName || `Player ${oppNum}`,
        board: [],
        marked: new Array(25).fill(false),
        score: oppNum === 1 ? (data.p1Score || 0) : (data.p2Score || 0),
        completedLines: [],
        lineTileIndices: new Set()
      };

      this.recalculatePlayerLines(myNum);

      this.homeScreen.style.display = 'none';
      this.gameScreen.style.display = 'flex';

      if (this.onlineRoomPill) {
        this.onlineRoomPill.style.display = 'inline-flex';
        this.onlineRoomCodeDisplay.textContent = data.roomCode;
        this.onlineUserRoleTag.textContent = myNum === 1 ? 'YOU (P1)' : 'YOU (P2)';
      }
      if (this.gameModeTag) {
        this.gameModeTag.textContent = 'ONLINE MATCH';
      }

      this.cardFlipper.classList.remove('flipped-to-p2');

      this.renderOnlineBoard();
      this.updateScoresUI();
      this.updateBingoLettersUI();
      this.updateOnlineTurnUI();

      this.sound.playPop(520);
    }

    renderOnlineBoard() {
      const grid = this.gridP1;
      const myNum = this.online.playerNum;
      const player = this.players[myNum];
      grid.innerHTML = '';

      player.board.forEach((number, index) => {
        const tile = document.createElement('div');
        tile.className = 'bingo-tile';
        tile.dataset.player = myNum;
        tile.dataset.index = index;
        tile.dataset.number = number;

        if (player.marked[index]) {
          tile.classList.add('tile-marked');
          if (player.lineTileIndices && player.lineTileIndices.has(index)) {
            tile.classList.add('tile-in-winning-line');
          }
          tile.innerHTML = `
            <span class="tile-number">${number}</span>
            <span class="tile-mark-symbol">✓</span>
          `;
        } else {
          tile.innerHTML = `<span class="tile-number">${number}</span>`;
        }

        tile.addEventListener('click', () => {
          this.handleOnlineTileClick(index, number);
        });

        grid.appendChild(tile);
      });
    }

    handleOnlineTileClick(index, number) {
      if (!this.gameActive) return;

      const myNum = this.online.playerNum;
      const isMyTurn = this.currentPlayer === myNum;
      const player = this.players[myNum];

      if (this.turnPhase === 'MARK_CALLED') {
        if (!isMyTurn) {
          this.sound.playError();
          this.setStatus('Waiting for opponent to mark the called number.', 'info');
          return;
        }

        if (player.marked[index]) {
          this.sound.playError();
          this.setStatus(`Number ${number} is already marked! Tap the number called verbally by your opponent.`, 'error');
          return;
        }

        this.sound.playTilePress();
        this.sendOnlineMessage({
          type: 'MARK_CALLED',
          number: number
        });
        return;
      }

      if (!isMyTurn) {
        this.sound.playError();
        this.setStatus("It's your opponent's turn to call a number.", 'info');
        return;
      }

      if (player.marked[index]) {
        this.sound.playError();
        this.setStatus(`Number ${number} has already been marked! Choose an unmarked tile to call.`, 'error');
        return;
      }

      this.sound.playTilePress();

      if (this.selectedTileNumber === number) {
        this.handleOnlineCallClick();
        return;
      }

      this.selectedTileNumber = number;
      this.highlightMatchingTileOnBoard(number);
      this.setStatus(`Selected #${number}. Tell your opponent #${number} and click "Call Number" to confirm!`, 'info');
    }

    handleOnlineCallClick() {
      if (!this.gameActive) return;

      const myNum = this.online.playerNum;
      if (this.currentPlayer !== myNum) {
        this.sound.playError();
        this.setStatus("It's your opponent's turn to call a number.", 'error');
        return;
      }

      if (this.turnPhase !== 'CALL') {
        this.sound.playError();
        this.setStatus("You must first tap and mark the number called by your opponent!", 'error');
        return;
      }

      if (!this.selectedTileNumber) {
        this.sound.playError();
        this.setStatus("Please tap an unmarked tile on your board to select it, then click Call Number!", 'error');
        return;
      }

      const numberToCall = this.selectedTileNumber;
      this.sendOnlineMessage({
        type: 'CALL_NUMBER',
        number: numberToCall
      });
    }

    updateOnlineTurnUI() {
      const myNum = this.online.playerNum;
      const isMyTurn = this.currentPlayer === myNum;

      if (this.turnAvatar) {
        this.turnAvatar.textContent = `P${this.currentPlayer}`;
        this.turnAvatar.className = `turn-avatar ${this.currentPlayer === 2 ? 'p2-avatar' : ''}`;
      }

      if (this.turnTrackerEl) {
        this.turnTrackerEl.textContent = this.currentPlayer === 1 ? 'P1 TURN' : 'P2 TURN';
      }

      if (this.player1Card && this.player2Card) {
        this.player1Card.classList.toggle('active-turn', this.currentPlayer === 1);
        this.player2Card.classList.toggle('active-turn', this.currentPlayer === 2);
      }

      if (isMyTurn) {
        if (this.turnPhase === 'MARK_CALLED') {
          this.turnPrompt.textContent = "Your Turn: Listen to opponent's verbal call & tap that number";
          this.btnSelectNumber.disabled = true;
          this.btnSelectNumber.textContent = 'Call Number';
        } else {
          this.turnPrompt.textContent = "Your Turn: Tap an unmarked tile, then click Call Number";
          this.btnSelectNumber.disabled = false;
          this.btnSelectNumber.textContent = 'Call Number';
        }
      } else {
        if (this.turnPhase === 'MARK_CALLED') {
          this.turnPrompt.textContent = "Waiting for opponent to mark your called number...";
        } else {
          this.turnPrompt.textContent = "Waiting for opponent to verbally call a number...";
        }
        this.btnSelectNumber.disabled = true;
        this.btnSelectNumber.textContent = 'Call Number';
      }

      if (this.activeLinesChip && this.players[myNum]) {
        const lines = this.players[myNum].completedLines.length;
        this.activeLinesChip.textContent = `${Math.min(5, lines)}/5`;
      }
    }

    handleOnlineGameOver(data) {
      this.gameActive = false;
      const myNum = this.online.playerNum;
      const winnerNum = data.winnerNum || data.winnerPlayer || 1;
      const didIWin = winnerNum === myNum;

      if (didIWin) {
        this.sound.playVictory();
        this.confetti.start();
      } else {
        this.sound.playError();
      }

      const winnerName = data.winnerName || (winnerNum === 1 ? 'Player 1' : 'Player 2');
      this.winnerTitle.textContent = `${winnerName.toUpperCase()} WINS!`;

      const p1Review = data.p1Review || (data.review && {
        score: data.review.p1.score,
        lines: data.review.p1.lines,
        board: data.review.p1.board,
        marked: data.review.p1.marked,
        unmarkedNumbers: data.review.p1.unmarked_numbers
      });
      const p2Review = data.p2Review || (data.review && {
        score: data.review.p2.score,
        lines: data.review.p2.lines,
        board: data.review.p2.board,
        marked: data.review.p2.marked,
        unmarkedNumbers: data.review.p2.unmarked_numbers
      });

      if (p1Review && p2Review) {
        this.winnerModalP1Score.textContent = p1Review.score;
        this.winnerModalP2Score.textContent = p2Review.score;
        this.winnerModalP1Lines.textContent = `${p1Review.lines} Lines`;
        this.winnerModalP2Lines.textContent = `${p2Review.lines} Lines`;

        this.renderOnlineGameReview(p1Review, p2Review, winnerNum);
      }

      this.setStatus(data.message || `${winnerName} won the match!`, didIWin ? 'success' : 'info');

      setTimeout(() => {
        this.winnerModal.style.display = 'flex';
      }, 500);
    }

    renderOnlineGameReview(p1Review, p2Review, winnerNum) {
      this.switchReviewTab('both');

      [ { pNum: 1, data: p1Review }, { pNum: 2, data: p2Review } ].forEach(({ pNum, data }) => {
        const isWinner = winnerNum === pNum;
        const isP1 = pNum === 1;

        const statusTag = isP1 ? this.p1ReviewStatusTag : this.p2ReviewStatusTag;
        if (statusTag) {
          statusTag.textContent = isWinner ? '🏆 WINNER' : 'LOSER';
          statusTag.className = `review-status-tag ${isWinner ? 'tag-winner' : 'tag-loser'}`;
        }

        const scoreEl = isP1 ? this.p1ReviewScore : this.p2ReviewScore;
        const linesEl = isP1 ? this.p1ReviewLines : this.p2ReviewLines;
        const markedRatioEl = isP1 ? this.p1ReviewMarkedRatio : this.p2ReviewMarkedRatio;

        const markedCount = data.marked.filter(Boolean).length;
        if (scoreEl) scoreEl.textContent = `${data.score} pts`;
        if (linesEl) linesEl.textContent = `${data.lines} / 5`;
        if (markedRatioEl) markedRatioEl.textContent = `${markedCount} / 25`;

        const gridEl = isP1 ? this.p1ReviewGrid : this.p2ReviewGrid;
        if (gridEl) {
          gridEl.innerHTML = '';
          const lineTileIndices = new Set(data.lineTileIndices || []);

          data.board.forEach((num, idx) => {
            const isMarked = data.marked[idx];
            const isWinningLine = lineTileIndices.has(idx);

            const tile = document.createElement('div');
            tile.className = `review-tile ${isMarked ? 'tile-marked' : 'tile-unmarked'}${isWinningLine ? ' tile-in-winning-line' : ''}`;

            const numSpan = document.createElement('span');
            numSpan.className = 'review-tile-num';
            numSpan.textContent = num;

            const symSpan = document.createElement('span');
            symSpan.className = 'review-tile-symbol';
            symSpan.textContent = isMarked ? '✓' : '—';

            tile.appendChild(numSpan);
            tile.appendChild(symSpan);
            gridEl.appendChild(tile);
          });
        }

        const textEl = isP1 ? this.p1UnmarkedText : this.p2UnmarkedText;
        const chipsEl = isP1 ? this.p1UnmarkedChips : this.p2UnmarkedChips;

        if (textEl) {
          if (data.unmarkedNumbers.length === 0) {
            textEl.textContent = 'Unmarked Numbers: None (All 25 marked!)';
          } else {
            textEl.textContent = `Unmarked Numbers: ${data.unmarkedNumbers.join(', ')}`;
          }
        }

        if (chipsEl) {
          if (data.unmarkedNumbers.length === 0) {
            chipsEl.innerHTML = '<span class="unmarked-empty-notice">All 25 numbers marked! 🎉</span>';
          } else {
            chipsEl.innerHTML = data.unmarkedNumbers
              .map(num => `<span class="unmarked-num-chip">${num}</span>`)
              .join('');
          }
        }
      });
    }

    recalculatePlayerLines(playerNum) {
      const player = this.players[playerNum];
      if (!player || !player.board || player.board.length === 0) return;

      player.completedLines = [];
      player.lineTileIndices = new Set();

      for (const line of this.lineDefinitions) {
        const isComplete = line.indices.every(idx => player.marked[idx]);
        if (isComplete) {
          player.completedLines.push(line.id);
          line.indices.forEach(idx => player.lineTileIndices.add(idx));
        }
      }
    }

    // =========================================================================
    // SETTINGS MODAL & CLOUD CONFIGURATION METHODS
    // =========================================================================

    openSettingsModal() {
      this.sound.playPop(440);
      if (this.settingsFeedback) {
        this.settingsFeedback.style.display = 'none';
      }

      if (window.BingoSupabase && window.BingoSupabase.isConfigured()) {
        if (this.backendStatusLabel) {
          this.backendStatusLabel.textContent = 'Active: Supabase Cloud (PostgreSQL & Realtime)';
        }
      } else {
        if (this.backendStatusLabel) {
          this.backendStatusLabel.textContent = 'Active: Local Node.js WebSocket (server.js)';
        }
      }

      if (this.supabaseUrlInput && window.BingoSupabase) {
        this.supabaseUrlInput.value = window.BingoSupabase.url || '';
      }
      if (this.supabaseKeyInput && window.BingoSupabase) {
        this.supabaseKeyInput.value = window.BingoSupabase.anonKey || '';
      }

      if (this.settingsModal) {
        this.settingsModal.style.display = 'flex';
      }
    }

    closeSettingsModal() {
      if (this.settingsModal) {
        this.settingsModal.style.display = 'none';
      }
    }

    async testSupabaseConnection() {
      this.sound.playPop(520);
      const url = (this.supabaseUrlInput ? this.supabaseUrlInput.value : '').trim();
      const key = (this.supabaseKeyInput ? this.supabaseKeyInput.value : '').trim();

      if (!url || !key) {
        this.showSettingsFeedback('Please enter both Supabase Project URL and Anon Key.', false);
        this.sound.playError();
        return;
      }

      this.showSettingsFeedback('Testing connection to Supabase...', null);

      if (window.BingoSupabase) {
        window.BingoSupabase.setCredentials(url, key);
        const result = await window.BingoSupabase.testConnection();

        if (result.success) {
          this.sound.playVictory();
          this.showSettingsFeedback('✅ Connection successful! Database and RLS policies verified.', true);
          if (this.backendStatusLabel) {
            this.backendStatusLabel.textContent = 'Active: Supabase Cloud (PostgreSQL & Realtime)';
          }
        } else {
          this.sound.playError();
          this.showSettingsFeedback(`❌ ${result.error}`, false);
        }
      } else {
        this.showSettingsFeedback('Supabase client library not loaded. Check internet connection.', false);
      }
    }

    saveSupabaseSettings() {
      this.sound.playPop(520);
      const url = (this.supabaseUrlInput ? this.supabaseUrlInput.value : '').trim();
      const key = (this.supabaseKeyInput ? this.supabaseKeyInput.value : '').trim();

      if (url && key) {
        if (window.BingoSupabase) {
          window.BingoSupabase.setCredentials(url, key);
        }
        this.showSettingsFeedback('✅ Settings saved! BINGO is configured for Supabase cloud.', true);
        if (this.backendStatusLabel) {
          this.backendStatusLabel.textContent = 'Active: Supabase Cloud (PostgreSQL & Realtime)';
        }
      } else {
        this.showSettingsFeedback('⚠️ URL or Anon Key is empty. Defaulting to local WebSocket.', false);
      }
    }

    clearSupabaseSettings() {
      this.sound.playPop(400);
      if (window.BingoSupabase) {
        window.BingoSupabase.clearCredentials();
      }
      if (this.supabaseUrlInput) this.supabaseUrlInput.value = '';
      if (this.supabaseKeyInput) this.supabaseKeyInput.value = '';
      this.showSettingsFeedback('Cleared cloud credentials. BINGO will use local WebSocket (server.js).', true);
      if (this.backendStatusLabel) {
        this.backendStatusLabel.textContent = 'Active: Local Node.js WebSocket (server.js)';
      }
    }

    showSettingsFeedback(msg, isSuccess) {
      if (!this.settingsFeedback || !this.settingsFeedbackText) return;
      this.settingsFeedbackText.textContent = msg;
      this.settingsFeedback.className = 'settings-feedback';
      if (isSuccess === true) {
        this.settingsFeedback.classList.add('success');
      } else if (isSuccess === false) {
        this.settingsFeedback.classList.add('error');
      }
      this.settingsFeedback.style.display = 'block';
    }

  }

  // Expose BingoGame to window for testing and debugging
  if (typeof window !== 'undefined') {
    window.BingoGame = BingoGame;
  }

  // Initialize Game on DOM Load
  window.addEventListener('DOMContentLoaded', () => {
    new BingoGame();
  });
})();
