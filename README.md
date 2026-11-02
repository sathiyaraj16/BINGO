# BINGO - Two Player Number Challenge Game

A complete, fully functional, polished 2-player browser game built with **HTML5**, **CSS3**, and **Vanilla JavaScript** featuring both **Real-Time Online Multiplayer (WebSocket)** across separate phones/devices and **Local Pass-and-Play (Offline)**. Designed with a premium casual mobile game aesthetic inspired by 3D block-puzzle games.

![Theme](https://img.shields.io/badge/Theme-Mint%20Green%20%26%20Warm%203D%20Orange-2dd4bf?style=for-the-badge)
![Tech](https://img.shields.io/badge/Tech-Vanilla%20JS%20%7C%20Node.js%20WebSocket%20%7C%20CSS3%20%7C%20HTML5-f97316?style=for-the-badge)
![Multiplayer](https://img.shields.io/badge/Multiplayer-Real--Time%20Rooms%20(WebSockets)-10b981?style=for-the-badge)

---

## 🌐 Real-Time Online Multiplayer System

Play in real time against an opponent on separate phones or computers anywhere on Wi-Fi or the internet!

### 1. Create Room (Host)
- Click **"Create Room"** on the home screen.
- A private room is created on the authoritative WebSocket server.
- Generates a unique **6-character Room Code** (e.g. `ABC123`).
- **Copy Code** and **Share Link** buttons allow 1-tap sharing to messaging apps or SMS.
- Host waits in the interactive Match Lobby showing real-time connection status.

### 2. Join Room (Guest)
- Player 2 clicks **"Join Room"** on their own phone or opens the shared link (`?room=CODE`).
- Enters the 6-character code into the styled room input.
- Validates room existence and room capacity (strictly capped at 2 players).

### 3. Start Game
- **"Start Game"** is available in the lobby.
- It remains disabled with status `"Waiting for Player 2..."` until both players are connected.
- Once Player 2 connects, the Host can tap **"▶ Start Game"** to immediately begin the match.

### 4. Strict Physical & Network Privacy
- **Private Boards**: Player 1 and Player 2 each receive their own private 5×5 board generated independently on the server. The opponent's board is **never sent over the network** during gameplay.
- **Strict Private Calling**: When Player 1 calls a number, the server notifies Player 2 that a number was called, but **omits the called number**.
- Player 1 verbally speaks the number to Player 2.
- Player 2 must listen and manually find & click that number on their board.
- The server authoritatively validates that Player 2's tap matches the secret called number.
- Neither device ever reveals the called number via text, popup, highlight, or DOM hint.

### 4. Real-Time Synchronization & Resilient Reconnection
- Synchronizes player turns, number calling, manual marking, scores (+1 pt per mark), completed horizontal/vertical/diagonal lines, and B-I-N-G-O letters in real time.
- **Session Tokens**: Uses browser `sessionStorage` and cryptographically secure tokens (`crypto.randomUUID()`). If a player accidentally refreshes or their phone screen dims, they auto-reconnect back to their active match seamlessly.
- **Disconnect Alert Banner**: Displays a non-intrusive warning if an opponent disconnects, automatically clearing when they return.
- **Play Again & Leave Room**: Supports instant rematch with freshly shuffled 1–25 boards or clean room exit back to the main menu.

---

## 🎮 Game Overview & Rules

1. **Two Player Match**:
   - Exactly two players: **Player 1** (Royal Purple) and **Player 2** (Cool Teal).
   - Each player gets an individual **5×5 Bingo board** (25 boxes per board).

2. **Independent Shuffled 1–25 Board Numbers**:
   - Each player's 5×5 board contains exactly 25 numbers.
   - Numbers range strictly from **1 to 25**.
   - Every number from 1 to 25 appears **exactly once** on each player's board.
   - Numbers are randomly shuffled independently for Player 1 and Player 2.

3. **Turn-Based Flow & Private Card System**:
   - Player 1 and Player 2 take strictly alternating turns.
   - A player cannot make consecutive moves.
   - Boards remain strictly private: Player 1 sees only their own board, and Player 2 sees only their own board.

4. **Strict Private Verbal Number-Calling System & Clean Call Number UI**:
   - Numbers are **never automatically marked**.
   - Direct interactive tile selection and full-width centered **Call Number** 3D button.
   - When Player 1 selects an unmarked tile and presses **Call Number** (e.g. 7):
     - It marks on Player 1's board (+1 point).
     - Player 1 verbally tells Player 2 which number to mark.
     - **Complete Privacy**: Zero visual hints, notifications, popups, labels, or highlighted tiles reveal the number on Player 2's board.
     - Player 2 **must independently find and click** number 7 on their own board (+1 point).
     - Player 2 cannot call their next number until they manually mark the opponent's called number.
     - After marking 7, Player 2 selects an unmarked tile on their board, verbally tells Player 1 (e.g. 16), and presses **Call Number** (+1 point).
     - Alternating turns continue!

5. **5-Line BINGO Letter System**:
   - The rack displays `B` `I` `N` `G` `O` prominently above the board.
   - Three winning directions are recognized:
     - **Horizontal Rows** (5 rows)
     - **Vertical Columns** (5 columns)
     - **Diagonals** (Main `\` and Anti `/`)
   - Completing any direction strikes out the next letter in `B-I-N-G-O` with an animated red ❌ stamp (`scale` & `rotate` slam).
   - Each completed line smoothly dims all 5 tiles with a subtle dark overlay (40% opacity) and soft green glow, keeping numbers crisp and readable without bright connecting lines or strokes. Each line is counted strictly **once**.

6. **Winner Declaration & Separate Player Board Review System**:
   - The first player to cross all five letters (complete 5 lines) triggers the **BINGO Winner** sequence!
   - Can occur either when calling a number or when manually marking an opponent's called number.
   - Confetti particle explosion on HTML5 canvas and synthesizer victory fanfare.
   - **Separate Player Board Review**:
     - **Player 1 Review Card**: Displays Player 1's actual 5×5 board with marked tiles in green, clearly highlighted unmarked tiles in warm orange with dashed amber borders, final score, completed lines, and prominent `WINNER` or `LOSER` status tag.
     - **Player 2 Review Card**: Displays Player 2's actual 5×5 board independently with marked tiles in green, clearly highlighted unmarked tiles, final score, completed lines, and `WINNER` or `LOSER` status tag.
     - **Unmarked Numbers Display**: Identifies the exact numbers never marked on each player's board (e.g. `Unmarked Numbers: 3, 7, 12, 18`) calculated strictly from each player's own board data without mixing.
     - **Responsive Tab Filter**: Easily toggle between `Both Players`, `Player 1`, or `Player 2`.
     - **Play Again Button**: Instantly resets both boards with fresh 1–25 unique random numbers for a new rematch.

---

## 🎨 UI/UX Design Specifications

Inspired by casual mobile puzzle games:
- **Background**: Soft mint green radial gradient with floating rounded geometric watermark squiggles.
- **Game Panel**: Rounded floating white card (`border-radius: 36px`) with soft ambient drop shadows.
- **Board Background**: Deep espresso chocolate brown container with inset depth.
- **Number Tiles**: Juicy 3D orange tiles with beveled bottom edges and glossy top reflections (zero corner bleed or red artifacts).
- **Marked Tiles**: Vivid emerald green tiles with corner rivets and checkmarks.
- **Action Buttons**: Rounded 3D push-down buttons and circular pastel icon buttons.
- **Sound FX**: Built-in Web Audio API synthesizer for pops, card whooshes, chimes, and fanfares without external audio file loading.

---

## 📂 Project Structure

```
BINGO/
├── server.js         # Authoritative Node.js HTTP & WebSocket multiplayer room server
├── index.html        # Semantic HTML5, Lobby & Join modals, 3D card HUD
├── style.css         # 3D transforms, fluid typography, mobile-first responsive layout
├── script.js         # Client game engine, WebSocket client, Web Audio synth & confetti
├── package.json      # Dependencies (ws) and start script
└── README.md         # Documentation & guide
```

---

## 🚀 How to Run

### Method 1: Real-Time Online Multiplayer (Two Devices / Phones)

1. Make sure Node.js is installed.
2. In the project folder, start the multiplayer server:
   ```bash
   npm start
   # or
   node server.js
   ```
3. The server prints your local network IP (e.g. `http://192.168.1.100:3000`).
4. **Phone 1 (Host)**:
   - Open `http://<your-ip>:3000` on your phone browser.
   - Tap **"Create Room"**.
   - Note or share the 6-character room code (e.g. `K9W4T2`).
5. **Phone 2 (Player 2)**:
   - Open `http://<your-ip>:3000` on the second phone.
   - Tap **"Join Room"** and enter the code.
   - The match starts instantly!

> **Public Internet / Friends at different locations**: You can expose the server port with a free secure tunnel such as `ngrok http 3000` or `localtunnel --port 3000` and share the URL directly.

### Method 2: Pass & Play (Single Device Offline)

- Click **"Pass & Play (Local Offline)"** on the home screen.
- Play offline on one phone with the animated 3D card flipping transition between turns.

### Method 3: Supabase Cloud Database & Realtime (Optional)

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** and execute [`supabase_schema.sql`](file:///w:/BINGO/supabase_schema.sql) (creates the `bingo_rooms` table, sets up public/anon Row Level Security policies, and enables Realtime).
3. On the BINGO home screen, tap **"⚙️ Cloud & Backend Settings"**.
4. Enter your Supabase Project URL and Public Anon Key.
5. Tap **"🔍 Test Connection"** to verify connection and RLS policies live, then tap **"💾 Save Settings"**.
6. Never input or expose your `service_role` key — only the public Anon key is required.
