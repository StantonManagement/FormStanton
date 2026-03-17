import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabase';

async function createWillUser() {
  const username = 'wt@stantoncap.com';
  const displayName = 'Will';
  const password = 'will123';
  const role = 'staff';

  // Check if user already exists
  const { data: existing } = await supabaseAdmin
    .from('admin_users')
    .select('id, username')
    .eq('username', username)
    .single();

  if (existing) {
    console.log(`User ${username} already exists with ID: ${existing.id}`);
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .insert({
      username,
      display_name: displayName,
      password_hash: passwordHash,
      role,
      is_active: true,
    })
    .select('id, username, display_name, role')
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw error;
  }

  console.log('User created successfully:', data);
}

createWillUser()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
