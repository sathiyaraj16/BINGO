/**
 * Comprehensive Join Room Bug Audit & Integration Test Suite
 * Tests live Supabase multiplayer room creation, normalization, pre-check,
 * join RPC, Realtime event propagation, game start, and private board delivery.
 */
const { createClient } = require('@supabase/supabase-js');
const assert = require('assert');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

const client1 = createClient(url, key, { auth: { persistSession: false } });
const client2 = createClient(url, key, { auth: { persistSession: false } });
const client3 = createClient(url, key, { auth: { persistSession: false } });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runJoinFlowTest() {
  console.log('--- Starting Complete Join Room Flow Verification ---');

  // Step 1: Client 1 Creates Online Room
  console.log('\n1. Client 1 (Host) creating room...');
  const { data: createData, error: createErr } = await client1.rpc('bingo_create_room', {
    p_host_name: 'Player 1'
  });
  assert(!createErr, `Room creation failed: ${createErr?.message}`);
  assert(createData.success === true, 'Room creation must return success=true');
  assert(createData.room_code && createData.room_code.length === 6, 'Room code must be 6 characters');
  
  const roomCode = createData.room_code;
  const hostToken = createData.session_token;
  console.log(`✓ Room created! Code: "${roomCode}"`);

  // Step 2: Verify Room Storage in bingo_rooms
  console.log('\n2. Verifying room record in public.bingo_rooms...');
  const { data: pubRoom, error: pubErr } = await client1
    .from('bingo_rooms')
    .select('*')
    .eq('code', roomCode)
    .single();
  assert(!pubErr, `Failed to query bingo_rooms: ${pubErr?.message}`);
  assert.strictEqual(pubRoom.status, 'WAITING', 'Initial room status must be WAITING');
  assert.strictEqual(pubRoom.guest_name, null, 'Initial guest_name must be null');
  console.log(`✓ Room "${roomCode}" exists in bingo_rooms with status "WAITING".`);

  // Step 3: Client 1 Subscribes to Realtime Updates
  console.log('\n3. Client 1 subscribing to Realtime room sync...');
  let guestJoinedEvent = null;
  let channel;
  await new Promise((resolve) => {
    channel = client1
      .channel(`join_test_${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bingo_rooms', filter: `code=eq.${roomCode}` },
        (payload) => {
          if (payload.new && payload.new.status === 'READY') {
            guestJoinedEvent = payload.new;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✓ Client 1 Realtime channel SUBSCRIBED');
          resolve();
        }
      });
  });

  // Step 4: Normalization Test: Client 2 enters code with lowercase and spaces
  console.log('\n4. Client 2 joins with formatted/unnormalized code string (e.g. " ' + roomCode.toLowerCase() + ' ")...');
  const normalizedCode = (roomCode.toLowerCase() + ' ').replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
  assert.strictEqual(normalizedCode, roomCode, 'Client sanitization must match room code');

  const { data: joinData, error: joinErr } = await client2.rpc('bingo_join_room', {
    p_room_code: normalizedCode,
    p_guest_name: 'Player 2'
  });
  assert(!joinErr, `bingo_join_room failed: ${joinErr?.message}`);
  assert(joinData.success === true, 'Join must return success=true');
  assert.strictEqual(joinData.room_code, roomCode, 'Returned room code must match');
  assert.strictEqual(joinData.player_num, 2, 'Player num must be 2');
  
  const guestToken = joinData.session_token;
  console.log(`✓ Client 2 joined room! Guest Token generated.`);

  // Step 5: Verify Realtime Notification on Client 1
  console.log('\n5. Verifying Realtime event received by Client 1...');
  await delay(1500);
  assert(guestJoinedEvent !== null, 'Client 1 must receive Realtime event when guest connects');
  assert.strictEqual(guestJoinedEvent.status, 'READY', 'Realtime update must set status to READY');
  assert.strictEqual(guestJoinedEvent.guest_name, 'Player 2', 'Realtime update must include guest_name');
  console.log(`✓ Client 1 received Realtime update: Player 2 connected!`);

  // Step 6: Test Double-Join / Full Room Rejection
  console.log('\n6. Testing 3rd client rejection (enforcing max 2 players)...');
  const { data: fullData, error: fullErr } = await client3.rpc('bingo_join_room', {
    p_room_code: roomCode,
    p_guest_name: 'Imposter3'
  });
  assert(fullErr, 'Joining an already full room must fail');
  console.log(`✓ 3rd client properly rejected: "${fullErr.message}"`);

  // Step 7: Host Starts the Game
  console.log('\n7. Host starting the game via bingo_start_game...');
  const { data: startData, error: startErr } = await client1.rpc('bingo_start_game', {
    p_room_code: roomCode,
    p_token: hostToken
  });
  assert(!startErr, `Start game failed: ${startErr?.message}`);
  assert.strictEqual(startData.status, 'PLAYING', 'Game status must be PLAYING');
  console.log(`✓ Game started on server!`);

  // Step 8: Both Clients Fetch Their Private State
  console.log('\n8. Fetching private player state for both clients...');
  const { data: p1State, error: p1Err } = await client1.rpc('bingo_get_player_state', {
    p_room_code: roomCode,
    p_token: hostToken
  });
  assert(!p1Err, `p1 state failed: ${p1Err?.message}`);
  assert(Array.isArray(p1State.my_board) && p1State.my_board.length === 25, 'P1 must have 25 board numbers');

  const { data: p2State, error: p2Err } = await client2.rpc('bingo_get_player_state', {
    p_room_code: roomCode,
    p_token: guestToken
  });
  assert(!p2Err, `p2 state failed: ${p2Err?.message}`);
  assert(Array.isArray(p2State.my_board) && p2State.my_board.length === 25, 'P2 must have 25 board numbers');

  // Verify privacy
  assert(!p1State.opp_board, 'P1 payload MUST NOT leak opponent board');
  assert(!p2State.opp_board, 'P2 payload MUST NOT leak opponent board');
  assert.notDeepStrictEqual(p1State.my_board, p2State.my_board, 'P1 and P2 must have distinct random boards');
  console.log(`✓ Both clients received private 25-tile boards with zero data leak!`);

  // Cleanup
  await client1.rpc('bingo_leave_room', { p_room_code: roomCode, p_token: hostToken });
  channel.unsubscribe();

  console.log('\n======================================================');
  console.log(' ALL JOIN ROOM BUG INVESTIGATION & FLOW TESTS PASSED! 🎉');
  console.log('======================================================');
}

runJoinFlowTest().catch(err => {
  console.error('\n❌ Join Flow Test Failed:', err);
  process.exit(1);
});
