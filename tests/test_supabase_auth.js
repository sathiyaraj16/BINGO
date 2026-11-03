/**
 * Test Supabase Authentication & Connectivity
 */
const BingoSupabase = require('../supabase.js');

async function testSupabase() {
  console.log('--- Testing Supabase Connection ---');
  console.log('Project URL:', BingoSupabase.url);
  console.log('Anon Key:', BingoSupabase.anonKey ? (BingoSupabase.anonKey.slice(0, 15) + '...') : 'none');

  const result = await BingoSupabase.testConnection();
  console.log('Connection Test Result:', result);

  if (result.success) {
    console.log('✓ Successfully authenticated with Supabase!');
    if (result.tableMissing) {
      console.log('ℹ️  Note: "bingo_rooms" table needs to be created via supabase_schema.sql');
    }
  } else {
    console.error('❌ Connection test failed:', result.error);
    process.exit(1);
  }
}

testSupabase();
