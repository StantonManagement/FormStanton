/**
 * Auth diagnostic script
 * Run: node scripts/check-auth.mjs
 */

import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

console.log('=== Auth Environment Check ===\n');

// Check env vars
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_SECRET',
];

const optional = [
  'ADMIN_PASSWORD_HASH',
  'ADMIN_PASSWORD', // legacy
];

console.log('Required variables:');
for (const key of required) {
  const val = process.env[key];
  const status = val ? (val.includes('your_') ? '⚠️ PLACEHOLDER' : '✅ SET') : '❌ MISSING';
  console.log(`  ${key}: ${status}`);
}

console.log('\nOptional auth variables:');
for (const key of optional) {
  const val = process.env[key];
  const status = val 
    ? (val.startsWith('$2') ? '✅ BCRYPT HASH' : val.includes('your_') ? '⚠️ PLACEHOLDER' : '⚠️ PLAIN TEXT')
    : '❌ NOT SET';
  console.log(`  ${key}: ${status}`);
}

// Check Supabase connection
console.log('\nSupabase connection test:');
try {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data, error } = await supabase.from('admin_users').select('count');
  if (error) {
    console.log('  ❌ Failed:', error.message);
  } else {
    console.log('  ✅ Connected to Supabase');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Check admin_users table
console.log('\nAdmin users in database:');
try {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, username, display_name, is_active, user_type')
    .eq('is_active', true);
    
  if (error) {
    console.log('  ❌ Query failed:', error.message);
  } else if (!data || data.length === 0) {
    console.log('  ⚠️ No active admin_users found');
    console.log('     You must use legacy password login (ADMIN_PASSWORD_HASH)');
  } else {
    console.log(`  ✅ Found ${data.length} active user(s):`);
    for (const user of data) {
      console.log(`     - ${user.username} (${user.display_name}) [${user.user_type}]`);
    }
    console.log('\n  To log in with a user account:');
    console.log('    Username: (one of the above)');
    console.log('    Password: (the password_hash in the DB)');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Check legacy password
console.log('\nLegacy password check:');
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const adminPasswordLegacy = process.env.ADMIN_PASSWORD;

if (!adminPasswordHash && !adminPasswordLegacy) {
  console.log('  ❌ No legacy password configured');
  console.log('     Set ADMIN_PASSWORD_HASH in .env.local');
} else if (adminPasswordHash) {
  if (adminPasswordHash.startsWith('$2')) {
    console.log('  ✅ ADMIN_PASSWORD_HASH is bcrypt format');
    console.log('     To test: try logging in with any password');
    console.log('     (it will fail but you\'ll know the format is right)');
  } else if (adminPasswordHash.includes('your_')) {
    console.log('  ⚠️ ADMIN_PASSWORD_HASH is placeholder value');
  } else {
    console.log('  ⚠️ ADMIN_PASSWORD_HASH is plain text (not bcrypt)');
    console.log('     This works but is less secure');
    console.log(`     Current value: ${adminPasswordHash.substring(0, 3)}...`);
  }
}

console.log('\n=== Login Instructions ===');
console.log('Method 1 - User account (recommended):');
console.log('  Use one of the usernames listed above with their DB password');
console.log('\nMethod 2 - Legacy master password:');
console.log(`  Leave username blank, use password: ${adminPasswordHash?.startsWith('your') ? '(placeholder - check .env.local)' : '***'}`);
