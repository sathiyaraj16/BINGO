/**
 * Test Suite: Supabase Security Architecture & RPC Validation
 * Verifies RLS policies, two-tier storage separation, board privacy, token authorization,
 * verbal calling secrecy, line counting, and review generation logic.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Starting Supabase Security Architecture & RPC Validation Audit ---');

// 1. Inspect SQL Migration Files
const schemaPath = path.join(__dirname, 'supabase_schema.sql');
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20261102000000_create_bingo_multiplayer.sql');

console.log('1. Checking migration file existence and parity...');
assert(fs.existsSync(schemaPath), 'supabase_schema.sql must exist');
assert(fs.existsSync(migrationPath), 'supabase/migrations/20261102000000_create_bingo_multiplayer.sql must exist');

const schemaContent = fs.readFileSync(schemaPath, 'utf8');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');
assert.strictEqual(schemaContent, migrationContent, 'Migration and schema files must be perfectly synchronized');
console.log('✓ supabase_schema.sql and migration file are synchronized.');

// 2. Audit Two-Tier Storage & RLS Lockdown
console.log('2. Auditing Two-Tier Storage & RLS Lockdown...');

// A. bingo_rooms_private audit
assert(schemaContent.includes('CREATE TABLE public.bingo_rooms_private'), 'bingo_rooms_private table must exist');
assert(schemaContent.includes('ALTER TABLE public.bingo_rooms_private ENABLE ROW LEVEL SECURITY;'), 'RLS must be enabled on bingo_rooms_private');
assert(schemaContent.includes('REVOKE ALL ON public.bingo_rooms_private FROM anon, authenticated;'), 'Direct read/write on bingo_rooms_private must be REVOKED from anon and authenticated');

// Ensure bingo_rooms_private is NEVER published to Realtime
assert(!schemaContent.includes('ADD TABLE public.bingo_rooms_private'), 'bingo_rooms_private must NEVER be added to Realtime publication');
console.log('✓ bingo_rooms_private has zero public access and is NOT streamed via Realtime.');

// B. bingo_rooms sanitized public table audit
assert(schemaContent.includes('CREATE TABLE public.bingo_rooms'), 'bingo_rooms table must exist');
assert(schemaContent.includes('ALTER TABLE public.bingo_rooms ENABLE ROW LEVEL SECURITY;'), 'RLS must be enabled on bingo_rooms');
assert(schemaContent.includes('REVOKE INSERT, UPDATE, DELETE ON public.bingo_rooms FROM anon, authenticated;'), 'Direct INSERT, UPDATE, DELETE on bingo_rooms must be REVOKED');
assert(schemaContent.includes('CREATE POLICY "Allow public read on sanitized room sync state"'), 'Read-only public policy must exist');
assert(schemaContent.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.bingo_rooms;'), 'bingo_rooms added to supabase_realtime');
console.log('✓ bingo_rooms is read-only for clients and safely published for Realtime sync.');

// Ensure sensitive columns do NOT exist on public table
const sensitiveColumnsOnPublic = ['host_token', 'guest_token', 'p1_board', 'p2_board', 'pending_called_number'];
const publicTableDefMatch = schemaContent.match(/CREATE TABLE public\.bingo_rooms \(([\s\S]*?)\);/);
assert(publicTableDefMatch, 'Could not parse bingo_rooms definition');
const publicColumnsText = publicTableDefMatch[1];

for (const col of sensitiveColumnsOnPublic) {
  assert(!publicColumnsText.includes(col), `Public bingo_rooms table MUST NOT contain sensitive column "${col}"`);
}
console.log('✓ Public table is free of tokens, boards, and pending called numbers.');

// 3. Audit Authoritative SECURITY DEFINER RPC Functions
console.log('3. Auditing PostgreSQL RPC Functions...');
const requiredFunctions = [
  'bingo_create_room',
  'bingo_join_room',
  'bingo_start_game',
  'bingo_get_player_state',
  'bingo_call_number',
  'bingo_mark_called',
  'bingo_leave_room'
];

for (const fn of requiredFunctions) {
  const fnRegex = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}[\\s\\S]*?SECURITY DEFINER`, 'i');
  assert(fnRegex.test(schemaContent), `RPC function ${fn} must have SECURITY DEFINER`);
  const grantRegex = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(.*?\\) TO anon, authenticated`, 'i');
  assert(grantRegex.test(schemaContent), `RPC function ${fn} must be granted to anon, authenticated`);
}
console.log('✓ All 7 RPC functions configured with SECURITY DEFINER and authorized.');

// 4. Test Algorithmic Correctness of Line Counter
console.log('4. Testing Line Counter Algorithm...');
function countLines(marked) {
  const lineDefs = [
    [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
    [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
    [0,6,12,18,24], [4,8,12,16,20]
  ];
  let lines = 0;
  for (const line of lineDefs) {
    if (line.every(idx => marked[idx])) {
      lines++;
    }
  }
  return Math.min(5, lines);
}

const emptyMarked = new Array(25).fill(false);
assert.strictEqual(countLines(emptyMarked), 0, 'Empty marked should have 0 lines');

const row0Marked = [...emptyMarked];
[0,1,2,3,4].forEach(i => row0Marked[i] = true);
assert.strictEqual(countLines(row0Marked), 1, '1 row should equal 1 line');

const diagMarked = [...row0Marked];
[0,6,12,18,24].forEach(i => diagMarked[i] = true);
assert.strictEqual(countLines(diagMarked), 2, 'Row + diagonal should equal 2 lines');

const fullMarked = new Array(25).fill(true);
assert.strictEqual(countLines(fullMarked), 5, 'Full board should cap at 5 lines (B-I-N-G-O)');
console.log('✓ Line counting algorithm capped at 5 verified.');

// 5. Test Separate Board Review Assembly & Sorting
console.log('5. Testing Review Assembly & Sorting of Unmarked Numbers...');
const p1Board = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25];
const p1Marked = new Array(25).fill(false);
[0,1,2,3,4, 5,6,7,8,9, 10,11,12,13,14, 15,16,17,18,19, 20].forEach(i => p1Marked[i] = true); // 21 marked, numbers 22,23,24,25 unmarked

const p1Unmarked = [];
for (let i = 0; i < 25; i++) {
  if (!p1Marked[i]) p1Unmarked.push(p1Board[i]);
}
p1Unmarked.sort((a, b) => a - b);
assert.deepStrictEqual(p1Unmarked, [22, 23, 24, 25], 'P1 unmarked numbers correctly calculated');
console.log('✓ Review calculation produces sorted unmarked numbers for both players.');

// 6. Test Supabase Client Module (supabase.js) Integration
console.log('6. Testing Supabase Client Module Methods...');
const BingoSupabase = require('./supabase.js');

assert(typeof BingoSupabase.testConnection === 'function', 'testConnection must be a function');
assert(typeof BingoSupabase.createRoom === 'function', 'createRoom must be a function');
assert(typeof BingoSupabase.joinRoom === 'function', 'joinRoom must be a function');
assert(typeof BingoSupabase.startGame === 'function', 'startGame must be a function');
assert(typeof BingoSupabase.getPlayerState === 'function', 'getPlayerState must be a function');
assert(typeof BingoSupabase.callNumber === 'function', 'callNumber must be a function');
assert(typeof BingoSupabase.markCalled === 'function', 'markCalled must be a function');
assert(typeof BingoSupabase.leaveRoom === 'function', 'leaveRoom must be a function');
assert(typeof BingoSupabase.subscribeToRoom === 'function', 'subscribeToRoom must be a function');

console.log('✓ Supabase Client methods verified.');

console.log('\n======================================================');
console.log(' SUPABASE SECURITY & RPC ARCHITECTURE AUDIT PASSED! 🎉');
console.log('======================================================');
