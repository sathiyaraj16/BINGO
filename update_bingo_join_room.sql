-- =========================================================================
-- BINGO Multiplayer: Enhanced bingo_join_room with Row Locking & Granular Diagnostics
-- Run this in Supabase SQL Editor to update bingo_join_room
-- =========================================================================

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

  -- 7. Generate independent boards for both players
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

GRANT EXECUTE ON FUNCTION public.bingo_join_room(text, text, uuid) TO anon, authenticated;
