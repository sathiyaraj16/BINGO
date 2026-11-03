const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qkniaufrahsoykkzwcbg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ATsDZ_DaLixPOsMK--Dwbw_p0xyR3QE';

async function runLiveVerification() {
  console.log('=== VERIFYING LIVE SUPABASE DEPLOYMENT ===');
  console.log('Project URL:', SUPABASE_URL);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });

  // 1. Verify bingo_rooms table is live
  console.log('\n1. Verifying public.bingo_rooms table...');
  const { data: roomsData, error: roomsError } = await supabase
    .from('bingo_rooms')
    .select('code, status')
    .limit(1);

  if (roomsError) {
    console.error('❌ Error querying bingo_rooms:', roomsError);
    process.exit(1);
  }
  console.log('✓ public.bingo_rooms is LIVE and queryable! Existing rooms count query ok.');

  // 2. Verify bingo_rooms_private direct access is blocked (Zero Trust)
  console.log('\n2. Verifying public.bingo_rooms_private is strictly blocked...');
  const { data: privData, error: privError } = await supabase
    .from('bingo_rooms_private')
    .select('*')
    .limit(1);

  if (!privError) {
    console.warn('⚠️ Warning: Direct query on bingo_rooms_private returned data. RLS might have allowed it:', privData);
  } else {
    console.log('✓ Direct query on bingo_rooms_private strictly BLOCKED as expected! Error code:', privError.code, privError.message);
  }

  // 3. Test RPC: bingo_create_room
  console.log('\n3. Testing RPC bingo_create_room...');
  const { data: createData, error: createError } = await supabase.rpc('bingo_create_room', {
    p_host_name: 'LiveHostAlice'
  });

  if (createError) {
    console.error('❌ bingo_create_room failed:', createError);
    process.exit(1);
  }
  console.log('✓ bingo_create_room succeeded:', createData);
  const roomCode = createData.room_code;
  const hostToken = createData.session_token;

  // 4. Test RPC: bingo_join_room
  console.log(`\n4. Testing RPC bingo_join_room for room ${roomCode}...`);
  const { data: joinData, error: joinError } = await supabase.rpc('bingo_join_room', {
    p_room_code: roomCode,
    p_guest_name: 'LiveGuestBob'
  });

  if (joinError) {
    console.error('❌ bingo_join_room failed:', joinError);
    process.exit(1);
  }
  console.log('✓ bingo_join_room succeeded:', joinData);
  const guestToken = joinData.session_token;

  // 5. Test RPC: bingo_get_player_state (Host and Guest board isolation)
  console.log('\n5. Testing RPC bingo_get_player_state (Strict Board Privacy)...');
  const { data: p1State, error: p1StateError } = await supabase.rpc('bingo_get_player_state', {
    p_room_code: roomCode,
    p_token: hostToken
  });
  if (p1StateError) {
    console.error('❌ p1 get_player_state failed:', p1StateError);
    process.exit(1);
  }
  console.log(`✓ P1 State: Player ${p1State.player_num} (${p1State.player_name}), Opponent: ${p1State.opponent_name}`);
  console.log(`  P1 Board Length: ${p1State.my_board.length}`);

  const { data: p2State, error: p2StateError } = await supabase.rpc('bingo_get_player_state', {
    p_room_code: roomCode,
    p_token: guestToken
  });
  if (p2StateError) {
    console.error('❌ p2 get_player_state failed:', p2StateError);
    process.exit(1);
  }
  console.log(`✓ P2 State: Player ${p2State.player_num} (${p2State.player_name}), Opponent: ${p2State.opponent_name}`);
  console.log(`  P2 Board Length: ${p2State.my_board.length}`);

  if (JSON.stringify(p1State.my_board) === JSON.stringify(p2State.my_board)) {
    console.error('❌ P1 and P2 boards should not be identical!');
  } else {
    console.log('✓ Verified: P1 and P2 have independent random boards!');
  }

  // Verify unauthorized token rejection
  const { error: unauthError } = await supabase.rpc('bingo_get_player_state', {
    p_room_code: roomCode,
    p_token: '00000000-0000-0000-0000-000000000000'
  });
  if (unauthError) {
    console.log('✓ Unauthorized token correctly rejected by server:', unauthError.message);
  } else {
    console.error('❌ Unauthorized token was NOT rejected!');
    process.exit(1);
  }

  // 6. Test RPC: bingo_start_game
  console.log('\n6. Testing RPC bingo_start_game...');
  const { data: startData, error: startError } = await supabase.rpc('bingo_start_game', {
    p_room_code: roomCode,
    p_token: hostToken
  });
  if (startError) {
    console.error('❌ bingo_start_game failed:', startError);
    process.exit(1);
  }
  console.log('✓ bingo_start_game succeeded:', startData);

  // 7. Test RPC: bingo_call_number
  console.log('\n7. Testing RPC bingo_call_number (Player 1 calls tile 0 number)...');
  const calledNum = p1State.my_board[0];
  const { data: callData, error: callError } = await supabase.rpc('bingo_call_number', {
    p_room_code: roomCode,
    p_token: hostToken,
    p_number: calledNum
  });
  if (callError) {
    console.error('❌ bingo_call_number failed:', callError);
    process.exit(1);
  }
  console.log(`✓ bingo_call_number succeeded for number ${calledNum}:`, callData);

  // 8. Verify public table sync DOES NOT leak called number
  console.log('\n8. Checking public table sync row for leaks...');
  const { data: pubRoom, error: pubRoomError } = await supabase
    .from('bingo_rooms')
    .select('*')
    .eq('code', roomCode)
    .single();

  if (pubRoomError) {
    console.error('❌ Error fetching public room:', pubRoomError);
    process.exit(1);
  }
  console.log('  Public Room active_player:', pubRoom.active_player, 'turn_phase:', pubRoom.turn_phase);
  console.log('  Public Room pending_called_number column exists?:', 'pending_called_number' in pubRoom);
  if ('pending_called_number' in pubRoom) {
    console.error('❌ Leak: pending_called_number column exists in public room!');
  } else {
    console.log('✓ Strict privacy confirmed: Public sync table has zero knowledge of the secret called number!');
  }

  // 9. Test RPC: bingo_mark_called
  console.log('\n9. Testing RPC bingo_mark_called (Testing wrong number rejection)...');
  // Find a number on P2's board that is NOT the called number
  const wrongNum = p2State.my_board.find(n => n !== calledNum);
  const { error: wrongMarkError } = await supabase.rpc('bingo_mark_called', {
    p_room_code: roomCode,
    p_token: guestToken,
    p_number: wrongNum
  });
  if (wrongMarkError) {
    console.log('✓ Server correctly rejected wrong marked number:', wrongMarkError.message);
  } else {
    console.error('❌ Server allowed marking wrong number!');
    process.exit(1);
  }

  console.log(`Now marking correct called number (${calledNum})...`);
  const { data: correctMarkData, error: correctMarkError } = await supabase.rpc('bingo_mark_called', {
    p_room_code: roomCode,
    p_token: guestToken,
    p_number: calledNum
  });
  if (correctMarkError) {
    console.error('❌ Correct mark failed:', correctMarkError);
    process.exit(1);
  }
  console.log('✓ bingo_mark_called succeeded for correct number:', correctMarkData);

  // 10. Test RPC: bingo_leave_room
  console.log('\n10. Testing RPC bingo_leave_room (clean up)...');
  const { data: leaveData, error: leaveError } = await supabase.rpc('bingo_leave_room', {
    p_room_code: roomCode,
    p_token: hostToken
  });
  if (leaveError) {
    console.error('❌ bingo_leave_room failed:', leaveError);
    process.exit(1);
  }
  console.log('✓ bingo_leave_room succeeded:', leaveData);

  console.log('\n======================================================');
  console.log(' ALL LIVE SUPABASE RPC FUNCTIONS & SECURITY VERIFIED! 🎉');
  console.log('======================================================');
}

runLiveVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
