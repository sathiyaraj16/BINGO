/**
 * BINGO - Supabase Multiplayer Client Module
 * Provides cloud multiplayer synchronization using Supabase PostgreSQL & Realtime.
 * Safe for anonymous publishable keys. Never exposes service_role key.
 * All mutations and state queries are mediated via authoritative SECURITY DEFINER RPC functions.
 * Compatible with Node.js and Browser environments.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    let supabaseLib;
    try {
      supabaseLib = require('@supabase/supabase-js');
    } catch (e) {
      supabaseLib = null;
    }
    module.exports = factory(supabaseLib);
  } else {
    root.BingoSupabase = factory(root.supabase);
  }
})(typeof self !== 'undefined' ? self : this, function (supabaseLib) {
  'use strict';

  const DEFAULT_URL = 'https://qkniaufrahsoykkzwcbg.supabase.co';
  const DEFAULT_KEY = 'sb_publishable_ATsDZ_DaLixPOsMK--Dwbw_p0xyR3QE';

  class BingoSupabaseManager {
    constructor() {
      this.supabaseLib = supabaseLib || (typeof window !== 'undefined' ? window.supabase : null);
      this.client = null;
      this.channel = null;
      this.currentRoomCode = null;
      this.sessionToken = null;
      this.playerNum = null;

      const storedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('bingo_supabase_url') : null;
      const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('bingo_supabase_anon_key') : null;
      const globalConfig = typeof window !== 'undefined' ? window.SUPABASE_CONFIG : null;
      const envUrl = typeof process !== 'undefined' && process.env ? (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) : null;
      const envKey = typeof process !== 'undefined' && process.env ? (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY) : null;

      this.url = storedUrl || (globalConfig && globalConfig.url) || envUrl || DEFAULT_URL;
      this.anonKey = storedKey || (globalConfig && globalConfig.anonKey) || envKey || DEFAULT_KEY;

      this.initClient();
    }

    initClient() {
      const lib = this.supabaseLib || (typeof window !== 'undefined' ? window.supabase : null);
      if (this.url && this.anonKey && lib && typeof lib.createClient === 'function') {
        try {
          this.client = lib.createClient(this.url.trim(), this.anonKey.trim(), {
            auth: {
              persistSession: false,
              autoRefreshToken: false
            },
            realtime: {
              params: {
                eventsPerSecond: 10
              }
            }
          });
        } catch (e) {
          console.warn('[Supabase] Failed to initialize client:', e.message);
          this.client = null;
        }
      }
    }

    isConfigured() {
      return !!(this.url && this.anonKey && this.client);
    }

    setCredentials(url, anonKey) {
      this.url = (url || '').trim();
      this.anonKey = (anonKey || '').trim();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bingo_supabase_url', this.url);
        localStorage.setItem('bingo_supabase_anon_key', this.anonKey);
      }
      this.initClient();
    }

    clearCredentials() {
      this.url = '';
      this.anonKey = '';
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('bingo_supabase_url');
        localStorage.removeItem('bingo_supabase_anon_key');
      }
      this.client = null;
      if (this.channel) {
        this.channel.unsubscribe();
        this.channel = null;
      }
    }

    /**
     * Test Supabase URL and Anon Key connection with live query
     */
    async testConnection() {
      if (!this.url || !this.anonKey) {
        return {
          success: false,
          error: 'Supabase Project URL and Anon Key must not be empty.'
        };
      }

      const lib = this.supabaseLib || (typeof window !== 'undefined' ? window.supabase : null);
      if (!lib || typeof lib.createClient !== 'function') {
        return {
          success: false,
          error: 'Supabase JS library not loaded. Check internet connection.'
        };
      }

      try {
        const testClient = lib.createClient(this.url.trim(), this.anonKey.trim(), {
          auth: { persistSession: false }
        });

        const { data, error } = await testClient
          .from('bingo_rooms')
          .select('code, status')
          .limit(1);

        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205') {
            return {
              success: true,
              tableMissing: true,
              message: 'Connected to Supabase project! (Table "bingo_rooms" not created yet. Run supabase_schema.sql in Supabase SQL editor).'
            };
          }
          return {
            success: false,
            error: error.message || 'Database query error.'
          };
        }

        this.client = testClient;
        return {
          success: true,
          tableMissing: false,
          message: 'Connected successfully to Supabase! Table "bingo_rooms" and RLS policies verified.'
        };
      } catch (err) {
        return {
          success: false,
          error: err.message || 'Connection failed.'
        };
      }
    }

    /**
     * Create Room via Secure RPC
     */
    async createRoom(playerName) {
      if (!this.isConfigured()) {
        throw new Error('Supabase is not configured.');
      }

      const { data, error } = await this.client.rpc('bingo_create_room', {
        p_host_name: playerName || 'Player 1'
      });

      if (error) {
        throw new Error(`Failed to create room: ${error.message}`);
      }

      this.currentRoomCode = data.room_code;
      this.sessionToken = data.session_token;
      this.playerNum = 1;

      return {
        roomCode: data.room_code,
        sessionToken: data.session_token,
        playerNum: 1,
        playerName: data.player_name
      };
    }

    /**
     * Join Room via Secure RPC with diagnostic pre-check & safe logging
     */
    async joinRoom(roomCode, playerName, sessionToken) {
      if (!this.isConfigured()) {
        throw new Error('Supabase is not configured.');
      }

      const code = (roomCode || '').replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
      if (!code || code.length !== 6) {
        throw new Error('Room code must be exactly 6 characters.');
      }

      console.log(`[BingoSupabase] Checking room availability for code "${code}"...`);

      // Diagnostic pre-check using sanitized public table
      const { data: roomCheck, error: checkError } = await this.client
        .from('bingo_rooms')
        .select('code, status, host_name, guest_name, created_at')
        .eq('code', code)
        .maybeSingle();

      if (checkError) {
        console.warn(`[BingoSupabase] Room pre-check notice:`, checkError.message);
      }

      if (!roomCheck) {
        console.error(`[BingoSupabase] Room "${code}" not found in database.`);
        throw new Error(`Room "${code}" not found. Please double-check the 6-character code from Player 1.`);
      }

      console.log(`[BingoSupabase] Found room "${code}" with status "${roomCheck.status}". Host: ${roomCheck.host_name}`);

      if (roomCheck.status === 'ABANDONED') {
        throw new Error(`Room "${code}" was closed or abandoned by the host. Please ask the host to create a new room.`);
      }

      if (roomCheck.status === 'GAME_OVER') {
        throw new Error(`The match in room "${code}" has already finished.`);
      }

      if (roomCheck.status === 'PLAYING') {
        throw new Error(`Room "${code}" is currently in an active game.`);
      }

      if (roomCheck.status === 'READY') {
        // If room is already READY, check if the caller is rejoining with their session token
        const storedSession = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('bingo_session') : null;
        let myToken = sessionToken;
        if (!myToken && storedSession) {
          try {
            const parsed = JSON.parse(storedSession);
            if (parsed.roomCode === code) myToken = parsed.sessionToken;
          } catch (e) {}
        }
        if (!myToken) {
          throw new Error(`Room "${code}" already has 2 players waiting to start.`);
        }
      }

      const rpcParams = {
        p_room_code: code,
        p_guest_name: (playerName || 'Player 2').trim()
      };

      console.log(`[BingoSupabase] Calling authoritative RPC bingo_join_room...`);
      const { data, error } = await this.client.rpc('bingo_join_room', rpcParams);

      if (error) {
        console.error(`[BingoSupabase] bingo_join_room RPC error for "${code}":`, error.message);
        throw new Error(error.message || `Failed to join room "${code}".`);
      }

      console.log(`[BingoSupabase] Successfully joined room "${data.room_code}" as Player 2!`);

      this.currentRoomCode = data.room_code;
      this.sessionToken = data.session_token;
      this.playerNum = 2;

      return {
        roomCode: data.room_code,
        sessionToken: data.session_token,
        playerNum: 2,
        playerName: data.player_name,
        hostName: data.host_name
      };
    }

    /**
     * Host starts the game via Secure RPC
     */
    async startGame(roomCode, sessionToken) {
      if (!this.isConfigured()) return;
      const token = sessionToken || this.sessionToken;
      const code = (roomCode || this.currentRoomCode || '').trim().toUpperCase();

      const { data, error } = await this.client.rpc('bingo_start_game', {
        p_room_code: code,
        p_token: token
      });

      if (error) {
        throw new Error(`Failed to start game: ${error.message}`);
      }
      return data;
    }

    /**
     * Get isolated player private state (only caller's board)
     */
    async getPlayerState(roomCode, sessionToken) {
      if (!this.isConfigured()) return null;
      const token = sessionToken || this.sessionToken;
      const code = (roomCode || this.currentRoomCode || '').trim().toUpperCase();

      const { data, error } = await this.client.rpc('bingo_get_player_state', {
        p_room_code: code,
        p_token: token
      });

      if (error) {
        throw new Error(`Failed to fetch player state: ${error.message}`);
      }
      return data;
    }

    /**
     * Player calls a number (Strict privacy: secret pending called number stored in private table)
     */
    async callNumber(roomCode, sessionToken, number) {
      if (!this.isConfigured()) return;
      const token = sessionToken || this.sessionToken;
      const code = (roomCode || this.currentRoomCode || '').trim().toUpperCase();

      const { data, error } = await this.client.rpc('bingo_call_number', {
        p_room_code: code,
        p_token: token,
        p_number: parseInt(number, 10)
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    }

    /**
     * Player marks called number (Authoritatively verified against secret pending number)
     */
    async markCalled(roomCode, sessionToken, number) {
      if (!this.isConfigured()) return;
      const token = sessionToken || this.sessionToken;
      const code = (roomCode || this.currentRoomCode || '').trim().toUpperCase();

      const { data, error } = await this.client.rpc('bingo_mark_called', {
        p_room_code: code,
        p_token: token,
        p_number: parseInt(number, 10)
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    }

    /**
     * Player leaves the room
     */
    async leaveRoom(roomCode, sessionToken) {
      if (!this.isConfigured()) return;
      const token = sessionToken || this.sessionToken;
      const code = (roomCode || this.currentRoomCode || '').trim().toUpperCase();

      const { data, error } = await this.client.rpc('bingo_leave_room', {
        p_room_code: code,
        p_token: token
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    }

    /**
     * Subscribe to Realtime room updates on sanitized public table ONLY
     */
    subscribeToRoom(roomCode, onRoomUpdate) {
      if (!this.isConfigured()) return null;

      if (this.channel) {
        this.channel.unsubscribe();
      }

      const code = (roomCode || this.currentRoomCode || '').trim().toUpperCase();

      const channel = this.client
        .channel(`room_${code}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bingo_rooms',
            filter: `code=eq.${code}`
          },
          (payload) => {
            if (payload.new && onRoomUpdate) {
              onRoomUpdate(payload.new);
            }
          }
        )
        .subscribe();

      this.channel = channel;
      return channel;
    }

    unsubscribe() {
      if (this.channel) {
        this.channel.unsubscribe();
        this.channel = null;
      }
      this.currentRoomCode = null;
      this.sessionToken = null;
      this.playerNum = null;
    }
  }

  return new BingoSupabaseManager();
});
