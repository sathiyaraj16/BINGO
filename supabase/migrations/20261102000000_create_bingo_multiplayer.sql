-- =========================================================================
-- BINGO Multiplayer - Secured Supabase Database Schema & RLS Architecture
-- Migration: 20261102000000_create_bingo_multiplayer.sql
-- Target Project: https://qkniaufrahsoykkzwcbg.supabase.co
-- Target Key: sb_publishable_ATsDZ_DaLixPOsMK--Dwbw_p0xyR3QE
-- =========================================================================
--
-- SECURITY AUDIT FINDINGS & VULNERABILITIES FIXED:
-- 1. [CRITICAL] Overly Permissive Policies:
--    - The old policies ("Allow anon read rooms USING (true)" and "Allow anon update room USING (true)")
--      allowed any user with the anon key to SELECT all columns (including secret host_token,
--      guest_token, p1_board, p2_board, and pending_called_number) and to UPDATE game state
--      arbitrarily (tampering with scores, lines, boards, or turns).
-- 2. [CRITICAL] Realtime Data Leakage:
--    - Supabase Realtime row streaming broadcasts table columns to all subscribers.
--      Streaming a table that contains private boards or secret called numbers completely breaks
--      game privacy over WebSockets.
-- 3. [CRITICAL] Client-Side Validation Vulnerabilities:
--    - Trusting clients to compute scores, count lines, generate boards, and validate turns
--      allows malicious or modified clients to cheat.
--
-- COMPREHENSIVE SECURITY ARCHITECTURE IMPLEMENTED:
-- 1. Two-Tier Storage Isolation:
--    - public.bingo_rooms_private: Holds private boards (p1_board, p2_board), secret session
--      tokens (host_token, guest_token), and the secret pending_called_number.
--      Direct client queries are completely REVOKED (REVOKE ALL FROM anon, authenticated).
--      This table is NEVER published to Realtime.
--    - public.bingo_rooms: Holds only sanitized public synchronization metadata (active_player,
--      turn_phase, public scores, public line counts, winner_player). Safe for Realtime streaming.
-- 2. Zero-Trust Mutations:
--    - Direct INSERT, UPDATE, DELETE on public.bingo_rooms are REVOKED from anon and authenticated.
--    - Only SELECT is permitted for clients.
-- 3. Authoritative PostgreSQL RPC Functions (SECURITY DEFINER):
--    - All game actions are mediated by authoritative stored procedures that validate caller
--      session tokens, enforce turn ordering, validate number markings, compute line counts,
--      and detect win conditions authoritatively on the server.
-- 4. Strict Verbal Calling Privacy:
--    - When Player 1 calls a number, the secret number is stored strictly in bingo_rooms_private.
--    - The public Realtime event indicates turn_phase = 'MARK_CALLED', but ZERO digits are revealed.
--    - Player 2 must hear the number verbally and tap it on their own board. The server strictly
--      verifies that Player 2's tap matches the secret pending number before confirming the mark.
-- 5. Separate Board Review Isolation:
--    - Complete player boards and unmarked numbers are ONLY assembled and exposed when the game
--      reaches 'GAME_OVER'. During gameplay, each player can query only their own board via
--      bingo_get_player_state(code, token).
-- =========================================================================

-- -------------------------------------------------------------------------
-- Step 0: Clean up legacy tables & functions
-- -------------------------------------------------------------------------
DROP TABLE IF EXISTS public.bingo_rooms CASCADE;
DROP TABLE IF EXISTS public.bingo_rooms_private CASCADE;
DROP FUNCTION IF EXISTS public.bingo_create_room(text);
DROP FUNCTION IF EXISTS public.bingo_join_room(text, text);
DROP FUNCTION IF EXISTS public.bingo_join_room(text, text, uuid);
DROP FUNCTION IF EXISTS public.bingo_start_game(text, uuid);
DROP FUNCTION IF EXISTS public.bingo_get_player_state(text, uuid);
DROP FUNCTION IF EXISTS public.bingo_call_number(text, uuid, int);
DROP FUNCTION IF EXISTS public.bingo_mark_called(text, uuid, int);
DROP FUNCTION IF EXISTS public.bingo_leave_room(text, uuid);
DROP FUNCTION IF EXISTS public.bingo_count_lines(jsonb);
DROP FUNCTION IF EXISTS public.bingo_build_game_review(jsonb, jsonb, int, int, jsonb, jsonb, int, int);
DROP FUNCTION IF EXISTS public.bingo_generate_board();

-- -------------------------------------------------------------------------
-- Step 1: Create bingo_rooms_private (Strictly Private Secrets & Boards)
-- -------------------------------------------------------------------------
CREATE TABLE public.bingo_rooms_private (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    host_token UUID NOT NULL DEFAULT gen_random_uuid(),
    guest_token UUID,
    p1_board JSONB,                     -- 25 unique numbers (1-25) private to P1
    p2_board JSONB,                     -- 25 unique numbers (1-25) private to P2
    pending_called_number INT           -- Secret number called verbally until marked
);

-- Index for instant lookup by room code
CREATE INDEX idx_bingo_rooms_private_code ON public.bingo_rooms_private(code);

-- Enable RLS and REVOKE all direct client access (Both Read and Write)
ALTER TABLE public.bingo_rooms_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bingo_rooms_private FROM anon, authenticated;

-- -------------------------------------------------------------------------
-- Step 2: Create bingo_rooms (Sanitized Public Synchronization State)
-- -------------------------------------------------------------------------
CREATE TABLE public.bingo_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'READY', 'PLAYING', 'GAME_OVER', 'ABANDONED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Public Player Info (Names only, zero tokens)
    host_name VARCHAR(50) NOT NULL,
    guest_name VARCHAR(50),
    
    -- Scores & Lines Count
    p1_score INT DEFAULT 0,
    p1_lines INT DEFAULT 0,
    p1_marked JSONB DEFAULT '[]'::jsonb, -- 25 booleans
    
    p2_score INT DEFAULT 0,
    p2_lines INT DEFAULT 0,
    p2_marked JSONB DEFAULT '[]'::jsonb, -- 25 booleans
    
    -- Active Turn & Phase (Never reveals called number)
    active_player INT DEFAULT 1,
    turn_phase VARCHAR(20) DEFAULT 'CALL', -- 'CALL', 'MARK_CALLED'
    winner_player INT,
    last_action_message TEXT,
    game_review JSONB                    -- Populated strictly when status = 'GAME_OVER'
);

CREATE INDEX idx_bingo_rooms_code ON public.bingo_rooms(code);
ALTER TABLE public.bingo_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.bingo_rooms ENABLE ROW LEVEL SECURITY;

-- Security Policies for bingo_rooms:
-- Only SELECT is permitted for clients. All INSERT, UPDATE, and DELETE mutations
-- MUST be executed via the authoritative RPC functions.
REVOKE INSERT, UPDATE, DELETE ON public.bingo_rooms FROM anon, authenticated;

CREATE POLICY "Allow public read on sanitized room sync state"
    ON public.bingo_rooms
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Enable Supabase Realtime streaming on the sanitized public table ONLY
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'bingo_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bingo_rooms;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Step 3: Helper Functions: Board Generator, Line Counter & Review Builder
-- -------------------------------------------------------------------------

-- Generates 25 numbers (1-25) shuffled independently
CREATE OR REPLACE FUNCTION public.bingo_generate_board()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT jsonb_agg(num ORDER BY random())
  INTO v_res
  FROM generate_series(1, 25) AS num;
  RETURN v_res;
END;
$$;

-- Authoritative Line Counter (Rows, Columns, Diagonals - max 5 for B-I-N-G-O)
CREATE OR REPLACE FUNCTION public.bingo_count_lines(p_marked jsonb)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_lines int := 0;
  v_line_defs int[] := ARRAY[
    -- 5 Rows
    0,1,2,3,4,
    5,6,7,8,9,
    10,11,12,13,14,
    15,16,17,18,19,
    20,21,22,23,24,
    -- 5 Columns
    0,5,10,15,20,
    1,6,11,16,21,
    2,7,12,17,22,
    3,8,13,18,23,
    4,9,14,19,24,
    -- 2 Diagonals
    0,6,12,18,24,
    4,8,12,16,20
  ];
  v_all_marked boolean;
  l int;
  c int;
  idx int;
BEGIN
  IF p_marked IS NULL OR jsonb_array_length(p_marked) < 25 THEN
    RETURN 0;
  END IF;

  FOR l IN 0..11 LOOP
    v_all_marked := true;
    FOR c IN 0..4 LOOP
      idx := v_line_defs[l * 5 + c + 1];
      IF NOT COALESCE((p_marked->>idx)::boolean, false) THEN
        v_all_marked := false;
        EXIT;
      END IF;
    END LOOP;
    IF v_all_marked THEN
      v_lines := v_lines + 1;
    END IF;
  END LOOP;

  RETURN LEAST(5, v_lines);
END;
$$;

-- Assembles final separate game review data strictly upon GAME_OVER
CREATE OR REPLACE FUNCTION public.bingo_build_game_review(
  p_p1_board jsonb,
  p_p1_marked jsonb,
  p_p1_score int,
  p_p1_lines int,
  p_p2_board jsonb,
  p_p2_marked jsonb,
  p_p2_score int,
  p_p2_lines int
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_p1_unmarked int[] := ARRAY[]::int[];
  v_p2_unmarked int[] := ARRAY[]::int[];
  v_p1_sorted int[];
  v_p2_sorted int[];
  i int;
BEGIN
  FOR i IN 0..24 LOOP
    IF NOT COALESCE((p_p1_marked->>i)::boolean, false) THEN
      v_p1_unmarked := array_append(v_p1_unmarked, (p_p1_board->>i)::int);
    END IF;
    IF NOT COALESCE((p_p2_marked->>i)::boolean, false) THEN
      v_p2_unmarked := array_append(v_p2_unmarked, (p_p2_board->>i)::int);
    END IF;
  END LOOP;

  IF array_length(v_p1_unmarked, 1) > 0 THEN
    SELECT array_agg(x ORDER BY x) INTO v_p1_sorted FROM unnest(v_p1_unmarked) x;
  ELSE
    v_p1_sorted := ARRAY[]::int[];
  END IF;

  IF array_length(v_p2_unmarked, 1) > 0 THEN
    SELECT array_agg(x ORDER BY x) INTO v_p2_sorted FROM unnest(v_p2_unmarked) x;
  ELSE
    v_p2_sorted := ARRAY[]::int[];
  END IF;

  RETURN jsonb_build_object(
    'p1', jsonb_build_object(
      'board', p_p1_board,
      'marked', p_p1_marked,
      'score', p_p1_score,
      'lines', p_p1_lines,
      'unmarked_numbers', to_jsonb(COALESCE(v_p1_sorted, ARRAY[]::int[]))
    ),
    'p2', jsonb_build_object(
      'board', p_p2_board,
      'marked', p_p2_marked,
      'score', p_p2_score,
      'lines', p_p2_lines,
      'unmarked_numbers', to_jsonb(COALESCE(v_p2_sorted, ARRAY[]::int[]))
    )
  );
END;
$$;

-- -------------------------------------------------------------------------
-- Step 4: Authoritative RPC Functions (SECURITY DEFINER)
-- -------------------------------------------------------------------------

-- A. Create Room
CREATE OR REPLACE FUNCTION public.bingo_create_room(p_host_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_host_token uuid := gen_random_uuid();
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
BEGIN
  -- Generate unique 6-character room code across both tables
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bingo_rooms WHERE code = v_code)
         AND NOT EXISTS (SELECT 1 FROM public.bingo_rooms_private WHERE code = v_code);
  END LOOP;

  -- Insert private record
  INSERT INTO public.bingo_rooms_private (code, host_token)
  VALUES (v_code, v_host_token);

  -- Insert sanitized public sync record
  INSERT INTO public.bingo_rooms (code, status, host_name, p1_marked, p2_marked)
  VALUES (
    v_code, 
    'WAITING', 
    COALESCE(NULLIF(TRIM(p_host_name), ''), 'Player 1'),
    jsonb_build_array(false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false),
    jsonb_build_array(false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false)
  );

  RETURN jsonb_build_object(
    'success', true,
    'room_code', v_code,
    'player_num', 1,
    'player_name', COALESCE(NULLIF(TRIM(p_host_name), ''), 'Player 1'),
    'session_token', v_host_token
  );
END;
$$;

-- B. Join Room (Enforces max 2 players, row locking, and generates private boards)
CREATE OR REPLACE FUNCTION public.bingo_join_room(
  p_room_code text, 
  p_guest_name text,
  p_session_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := UPPER(REGEXP_REPLACE(TRIM(COALESCE(p_room_code, '')), '[^A-Z0-9]', '', 'g'));
  v_guest_token uuid := gen_random_uuid();
  v_pub public.bingo_rooms%ROWTYPE;
  v_priv public.bingo_rooms_private%ROWTYPE;
  v_p1_board jsonb;
  v_p2_board jsonb;
BEGIN
  IF length(v_code) != 6 THEN
    RAISE EXCEPTION 'Room code must be exactly 6 characters (received "%")', p_room_code;
  END IF;

  -- 1. Lock public room record to serialize concurrent joins
  SELECT * INTO v_pub
  FROM public.bingo_rooms
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room "%" does not exist. Please check the 6-character code and try again.', v_code;
  END IF;

  -- 2. Lock private room record
  SELECT * INTO v_priv
  FROM public.bingo_rooms_private
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room "%" private record is missing or corrupted.', v_code;
  END IF;

  -- 3. Check for expired room (> 4 hours)
  IF v_pub.created_at < NOW() - INTERVAL '4 hours' THEN
    RAISE EXCEPTION 'Room "%" has expired (older than 4 hours). Please ask the host to create a new room.', v_code;
  END IF;

  -- 4. Reconnect check: If guest already joined and holds a valid guest session token
  IF p_session_token IS NOT NULL AND v_priv.guest_token IS NOT NULL AND p_session_token = v_priv.guest_token THEN
    RETURN jsonb_build_object(
      'success', true,
      'room_code', v_code,
      'player_num', 2,
      'player_name', COALESCE(NULLIF(TRIM(v_pub.guest_name), ''), 'Player 2'),
      'host_name', v_pub.host_name,
      'session_token', v_priv.guest_token,
      'reconnected', true
    );
  END IF;

  -- 5. Granular room status diagnostics
  IF v_pub.status = 'ABANDONED' THEN
    RAISE EXCEPTION 'Room "%" was closed or abandoned by the host.', v_code;
  ELSIF v_pub.status = 'GAME_OVER' THEN
    RAISE EXCEPTION 'The match in room "%" has already finished.', v_code;
  ELSIF v_pub.status = 'PLAYING' THEN
    RAISE EXCEPTION 'Room "%" is already in an active match with 2 players.', v_code;
  ELSIF v_pub.status = 'READY' THEN
    RAISE EXCEPTION 'Room "%" already has 2 players waiting to start.', v_code;
  ELSIF v_pub.status != 'WAITING' THEN
    RAISE EXCEPTION 'Room "%" is not available to join (status: %).', v_code, v_pub.status;
  END IF;

  -- 6. Verify guest slot availability
  IF v_priv.guest_token IS NOT NULL OR v_pub.guest_name IS NOT NULL THEN
    RAISE EXCEPTION 'Room "%" guest slot is already occupied.', v_code;
  END IF;

  -- 7. Generate independent boards for each player
  v_p1_board := public.bingo_generate_board();
  v_p2_board := public.bingo_generate_board();

  -- 8. Assign guest token and private boards
  UPDATE public.bingo_rooms_private
  SET guest_token = v_guest_token,
      p1_board = v_p1_board,
      p2_board = v_p2_board
  WHERE code = v_code;

  -- 9. Update public sync state to READY
  UPDATE public.bingo_rooms
  SET guest_name = COALESCE(NULLIF(TRIM(p_guest_name), ''), 'Player 2'),
      status = 'READY',
      updated_at = NOW()
  WHERE code = v_code;

  RETURN jsonb_build_object(
    'success', true,
    'room_code', v_code,
    'player_num', 2,
    'player_name', COALESCE(NULLIF(TRIM(p_guest_name), ''), 'Player 2'),
    'host_name', v_pub.host_name,
    'session_token', v_guest_token,
    'reconnected', false
  );
END;
$$;

-- C. Host Starts Game (Must be 2 players connected; only host token authorized)
CREATE OR REPLACE FUNCTION public.bingo_start_game(p_room_code text, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text := UPPER(TRIM(p_room_code));
  v_priv public.bingo_rooms_private%ROWTYPE;
BEGIN
  SELECT * INTO v_priv FROM public.bingo_rooms_private WHERE code = v_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room % not found', v_code;
  END IF;

  IF p_token != v_priv.host_token THEN
    RAISE EXCEPTION 'Only the host (Player 1) can start the game';
  END IF;

  IF v_priv.guest_token IS NULL THEN
    RAISE EXCEPTION 'Cannot start game until Player 2 joins the room';
  END IF;

  UPDATE public.bingo_rooms
  SET status = 'PLAYING',
      active_player = 1,
      turn_phase = 'CALL',
      last_action_message = 'Game started! Player 1 turn to call.',
      updated_at = NOW()
  WHERE code = v_code;

  RETURN jsonb_build_object('success', true, 'status', 'PLAYING');
END;
$$;

-- D. Get Player Private State (Strictly isolates boards & secrets)
CREATE OR REPLACE FUNCTION public.bingo_get_player_state(p_room_code text, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text := UPPER(TRIM(p_room_code));
  v_priv public.bingo_rooms_private%ROWTYPE;
  v_pub public.bingo_rooms%ROWTYPE;
  v_is_p1 boolean;
  v_my_board jsonb;
  v_my_marked jsonb;
  v_my_score int;
  v_my_lines int;
  v_opp_score int;
  v_opp_lines int;
  v_opp_name text;
  v_result jsonb;
BEGIN
  SELECT * INTO v_priv FROM public.bingo_rooms_private WHERE code = v_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room % not found', v_code;
  END IF;

  SELECT * INTO v_pub FROM public.bingo_rooms WHERE code = v_code;

  IF p_token = v_priv.host_token THEN
    v_is_p1 := true;
  ELSIF p_token = v_priv.guest_token THEN
    v_is_p1 := false;
  ELSE
    RAISE EXCEPTION 'Unauthorized session token';
  END IF;

  -- CRITICAL PRIVACY: Only return caller's own board! Opponent board is NEVER returned!
  IF v_is_p1 THEN
    v_my_board := v_priv.p1_board;
    v_my_marked := v_pub.p1_marked;
    v_my_score := v_pub.p1_score;
    v_my_lines := v_pub.p1_lines;
    v_opp_score := v_pub.p2_score;
    v_opp_lines := v_pub.p2_lines;
    v_opp_name := v_pub.guest_name;
  ELSE
    v_my_board := v_priv.p2_board;
    v_my_marked := v_pub.p2_marked;
    v_my_score := v_pub.p2_score;
    v_my_lines := v_pub.p2_lines;
    v_opp_score := v_pub.p1_score;
    v_opp_lines := v_pub.p1_lines;
    v_opp_name := v_pub.host_name;
  END IF;

  v_result := jsonb_build_object(
    'room_code', v_pub.code,
    'status', v_pub.status,
    'player_num', CASE WHEN v_is_p1 THEN 1 ELSE 2 END,
    'player_name', CASE WHEN v_is_p1 THEN v_pub.host_name ELSE v_pub.guest_name END,
    'opponent_name', v_opp_name,
    'my_board', v_my_board,
    'my_marked', v_my_marked,
    'my_score', v_my_score,
    'my_lines', v_my_lines,
    'opp_score', v_opp_score,
    'opp_lines', v_opp_lines,
    'active_player', v_pub.active_player,
    'turn_phase', v_pub.turn_phase,
    'winner_player', v_pub.winner_player,
    'last_action_message', v_pub.last_action_message
  );

  -- Only on GAME_OVER do we attach the review object
  IF v_pub.status = 'GAME_OVER' AND v_pub.game_review IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('review', v_pub.game_review);
  END IF;

  RETURN v_result;
END;
$$;

-- E. Call Number (Authoritative Validation & Strict Secret Storage)
CREATE OR REPLACE FUNCTION public.bingo_call_number(
  p_room_code text,
  p_token uuid,
  p_number int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text := UPPER(TRIM(p_room_code));
  v_priv public.bingo_rooms_private%ROWTYPE;
  v_pub public.bingo_rooms%ROWTYPE;
  v_caller_num int;
  v_opp_num int;
  v_board jsonb;
  v_marked jsonb;
  v_tile_idx int := -1;
  v_new_marked jsonb;
  v_new_lines int;
  v_new_score int;
  v_review jsonb := null;
  i int;
BEGIN
  IF p_number < 1 OR p_number > 25 THEN
    RAISE EXCEPTION 'Number must be between 1 and 25';
  END IF;

  SELECT * INTO v_priv FROM public.bingo_rooms_private WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room % not found', v_code;
  END IF;

  SELECT * INTO v_pub FROM public.bingo_rooms WHERE code = v_code FOR UPDATE;

  IF v_pub.status != 'PLAYING' THEN
    RAISE EXCEPTION 'Game is not in active playing status';
  END IF;

  IF p_token = v_priv.host_token THEN
    v_caller_num := 1;
    v_opp_num := 2;
    v_board := v_priv.p1_board;
    v_marked := v_pub.p1_marked;
    v_new_score := v_pub.p1_score + 1;
  ELSIF p_token = v_priv.guest_token THEN
    v_caller_num := 2;
    v_opp_num := 1;
    v_board := v_priv.p2_board;
    v_marked := v_pub.p2_marked;
    v_new_score := v_pub.p2_score + 1;
  ELSE
    RAISE EXCEPTION 'Unauthorized session token';
  END IF;

  IF v_pub.active_player != v_caller_num THEN
    RAISE EXCEPTION 'Not your turn to call a number';
  END IF;

  IF v_pub.turn_phase != 'CALL' THEN
    RAISE EXCEPTION 'Must mark opponent called number first';
  END IF;

  FOR i IN 0..24 LOOP
    IF (v_board->>i)::int = p_number THEN
      v_tile_idx := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_tile_idx = -1 THEN
    RAISE EXCEPTION 'Number % not found on your board', p_number;
  END IF;

  IF (v_marked->>v_tile_idx)::boolean = true THEN
    RAISE EXCEPTION 'Number % is already marked', p_number;
  END IF;

  v_new_marked := jsonb_set(v_marked, ARRAY[v_tile_idx::text], 'true'::jsonb);
  v_new_lines := public.bingo_count_lines(v_new_marked);

  -- Check winner: 5 lines completed
  IF v_new_lines >= 5 THEN
    v_review := public.bingo_build_game_review(
      v_priv.p1_board,
      CASE WHEN v_caller_num = 1 THEN v_new_marked ELSE v_pub.p1_marked END,
      CASE WHEN v_caller_num = 1 THEN v_new_score ELSE v_pub.p1_score END,
      CASE WHEN v_caller_num = 1 THEN v_new_lines ELSE v_pub.p1_lines END,
      v_priv.p2_board,
      CASE WHEN v_caller_num = 2 THEN v_new_marked ELSE v_pub.p2_marked END,
      CASE WHEN v_caller_num = 2 THEN v_new_score ELSE v_pub.p2_score END,
      CASE WHEN v_caller_num = 2 THEN v_new_lines ELSE v_pub.p2_lines END
    );

    UPDATE public.bingo_rooms
    SET status = 'GAME_OVER',
        winner_player = v_caller_num,
        p1_marked = CASE WHEN v_caller_num = 1 THEN v_new_marked ELSE p1_marked END,
        p1_score = CASE WHEN v_caller_num = 1 THEN v_new_score ELSE p1_score END,
        p1_lines = CASE WHEN v_caller_num = 1 THEN v_new_lines ELSE p1_lines END,
        p2_marked = CASE WHEN v_caller_num = 2 THEN v_new_marked ELSE p2_marked END,
        p2_score = CASE WHEN v_caller_num = 2 THEN v_new_score ELSE p2_score END,
        p2_lines = CASE WHEN v_caller_num = 2 THEN v_new_lines ELSE p2_lines END,
        game_review = v_review,
        last_action_message = 'Game Over! Player ' || v_caller_num || ' won the match!',
        updated_at = NOW()
    WHERE code = v_code;

    RETURN jsonb_build_object(
      'success', true,
      'game_over', true,
      'winner_player', v_caller_num,
      'score', v_new_score,
      'lines', v_new_lines
    );
  END IF;

  -- Store secret pending number strictly in private table
  UPDATE public.bingo_rooms_private
  SET pending_called_number = p_number
  WHERE code = v_code;

  -- Update public synchronization state without leaking the secret number
  UPDATE public.bingo_rooms
  SET active_player = v_opp_num,
      turn_phase = 'MARK_CALLED',
      p1_marked = CASE WHEN v_caller_num = 1 THEN v_new_marked ELSE p1_marked END,
      p1_score = CASE WHEN v_caller_num = 1 THEN v_new_score ELSE p1_score END,
      p1_lines = CASE WHEN v_caller_num = 1 THEN v_new_lines ELSE p1_lines END,
      p2_marked = CASE WHEN v_caller_num = 2 THEN v_new_marked ELSE p2_marked END,
      p2_score = CASE WHEN v_caller_num = 2 THEN v_new_score ELSE p2_score END,
      p2_lines = CASE WHEN v_caller_num = 2 THEN v_new_lines ELSE p2_lines END,
      last_action_message = 'Player ' || v_caller_num || ' called a number verbally.',
      updated_at = NOW()
  WHERE code = v_code;

  RETURN jsonb_build_object(
    'success', true,
    'called_number', p_number,
    'score', v_new_score,
    'lines', v_new_lines,
    'turn_phase', 'MARK_CALLED',
    'active_player', v_opp_num
  );
END;
$$;

-- F. Mark Called Number (Authoritatively validates against secret pending number)
CREATE OR REPLACE FUNCTION public.bingo_mark_called(
  p_room_code text,
  p_token uuid,
  p_number int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text := UPPER(TRIM(p_room_code));
  v_priv public.bingo_rooms_private%ROWTYPE;
  v_pub public.bingo_rooms%ROWTYPE;
  v_marker_num int;
  v_board jsonb;
  v_marked jsonb;
  v_tile_idx int := -1;
  v_new_marked jsonb;
  v_new_lines int;
  v_new_score int;
  v_review jsonb := null;
  i int;
BEGIN
  SELECT * INTO v_priv FROM public.bingo_rooms_private WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room % not found', v_code;
  END IF;

  SELECT * INTO v_pub FROM public.bingo_rooms WHERE code = v_code FOR UPDATE;

  IF v_pub.status != 'PLAYING' THEN
    RAISE EXCEPTION 'Game is not in active playing status';
  END IF;

  IF v_pub.turn_phase != 'MARK_CALLED' OR v_priv.pending_called_number IS NULL THEN
    RAISE EXCEPTION 'No pending called number to mark';
  END IF;

  IF p_token = v_priv.host_token THEN
    v_marker_num := 1;
    v_board := v_priv.p1_board;
    v_marked := v_pub.p1_marked;
    v_new_score := v_pub.p1_score + 1;
  ELSIF p_token = v_priv.guest_token THEN
    v_marker_num := 2;
    v_board := v_priv.p2_board;
    v_marked := v_pub.p2_marked;
    v_new_score := v_pub.p2_score + 1;
  ELSE
    RAISE EXCEPTION 'Unauthorized session token';
  END IF;

  IF v_pub.active_player != v_marker_num THEN
    RAISE EXCEPTION 'Not your turn to mark the called number';
  END IF;

  -- CRITICAL VALIDATION: Must strictly match the secret pending called number!
  IF p_number != v_priv.pending_called_number THEN
    RAISE EXCEPTION 'Incorrect number! Listen carefully to the called number.';
  END IF;

  FOR i IN 0..24 LOOP
    IF (v_board->>i)::int = p_number THEN
      v_tile_idx := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_tile_idx = -1 THEN
    RAISE EXCEPTION 'Number % not found on your board', p_number;
  END IF;

  IF (v_marked->>v_tile_idx)::boolean = true THEN
    RAISE EXCEPTION 'Number % is already marked', p_number;
  END IF;

  v_new_marked := jsonb_set(v_marked, ARRAY[v_tile_idx::text], 'true'::jsonb);
  v_new_lines := public.bingo_count_lines(v_new_marked);

  -- Check winner on mark: 5 lines completed
  IF v_new_lines >= 5 THEN
    v_review := public.bingo_build_game_review(
      v_priv.p1_board,
      CASE WHEN v_marker_num = 1 THEN v_new_marked ELSE v_pub.p1_marked END,
      CASE WHEN v_marker_num = 1 THEN v_new_score ELSE v_pub.p1_score END,
      CASE WHEN v_marker_num = 1 THEN v_new_lines ELSE v_pub.p1_lines END,
      v_priv.p2_board,
      CASE WHEN v_marker_num = 2 THEN v_new_marked ELSE v_pub.p2_marked END,
      CASE WHEN v_marker_num = 2 THEN v_new_score ELSE v_pub.p2_score END,
      CASE WHEN v_marker_num = 2 THEN v_new_lines ELSE v_pub.p2_lines END
    );

    UPDATE public.bingo_rooms
    SET status = 'GAME_OVER',
        winner_player = v_marker_num,
        p1_marked = CASE WHEN v_marker_num = 1 THEN v_new_marked ELSE p1_marked END,
        p1_score = CASE WHEN v_marker_num = 1 THEN v_new_score ELSE p1_score END,
        p1_lines = CASE WHEN v_marker_num = 1 THEN v_new_lines ELSE p1_lines END,
        p2_marked = CASE WHEN v_marker_num = 2 THEN v_new_marked ELSE p2_marked END,
        p2_score = CASE WHEN v_marker_num = 2 THEN v_new_score ELSE p2_score END,
        p2_lines = CASE WHEN v_marker_num = 2 THEN v_new_lines ELSE p2_lines END,
        game_review = v_review,
        last_action_message = 'Game Over! Player ' || v_marker_num || ' won on mark!',
        updated_at = NOW()
    WHERE code = v_code;

    RETURN jsonb_build_object(
      'success', true,
      'game_over', true,
      'winner_player', v_marker_num,
      'score', v_new_score,
      'lines', v_new_lines
    );
  END IF;

  -- Clear secret pending number
  UPDATE public.bingo_rooms_private
  SET pending_called_number = NULL
  WHERE code = v_code;

  -- Marker now calls their own number!
  UPDATE public.bingo_rooms
  SET active_player = v_marker_num,
      turn_phase = 'CALL',
      p1_marked = CASE WHEN v_marker_num = 1 THEN v_new_marked ELSE p1_marked END,
      p1_score = CASE WHEN v_marker_num = 1 THEN v_new_score ELSE p1_score END,
      p1_lines = CASE WHEN v_marker_num = 1 THEN v_new_lines ELSE p1_lines END,
      p2_marked = CASE WHEN v_marker_num = 2 THEN v_new_marked ELSE p2_marked END,
      p2_score = CASE WHEN v_marker_num = 2 THEN v_new_score ELSE p2_score END,
      p2_lines = CASE WHEN v_marker_num = 2 THEN v_new_lines ELSE p2_lines END,
      last_action_message = 'Player ' || v_marker_num || ' marked the number! Now calling their number.',
      updated_at = NOW()
  WHERE code = v_code;

  RETURN jsonb_build_object(
    'success', true,
    'marked_number', p_number,
    'score', v_new_score,
    'lines', v_new_lines,
    'turn_phase', 'CALL',
    'active_player', v_marker_num
  );
END;
$$;

-- G. Leave Room
CREATE OR REPLACE FUNCTION public.bingo_leave_room(p_room_code text, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text := UPPER(TRIM(p_room_code));
  v_priv public.bingo_rooms_private%ROWTYPE;
BEGIN
  SELECT * INTO v_priv FROM public.bingo_rooms_private WHERE code = v_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Room not found');
  END IF;

  IF p_token != v_priv.host_token AND (v_priv.guest_token IS NULL OR p_token != v_priv.guest_token) THEN
    RAISE EXCEPTION 'Unauthorized session token';
  END IF;

  UPDATE public.bingo_rooms
  SET status = 'ABANDONED',
      last_action_message = 'A player left the match.',
      updated_at = NOW()
  WHERE code = v_code;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- -------------------------------------------------------------------------
-- Step 5: Grant RPC execute permissions to anon and authenticated
-- -------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.bingo_create_room(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_join_room(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_start_game(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_get_player_state(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_call_number(text, uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_mark_called(text, uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_leave_room(text, uuid) TO anon, authenticated;
