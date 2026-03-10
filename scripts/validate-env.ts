#!/usr/bin/env node
/**
 * Environment Variable Validation Script
 * Checks that all required environment variables are present and valid
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const result: ValidationResult = {
  valid: true,
  errors: [],
  warnings: []
};

console.log('🔍 Validating environment configuration...\n');

// Required variables
const requiredVars = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    validate: (val: string) => val.startsWith('https://') && val.includes('supabase.co')
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key',
    validate: (val: string) => val.length > 100
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Supabase service role key',
    validate: (val: string) => val.length > 100
  },
  {
    name: 'ADMIN_PASSWORD',
    description: 'Admin dashboard password',
    validate: (val: string) => val.length >= 8
  },
  {
    name: 'SESSION_SECRET',
    description: 'Session encryption secret',
    validate: (val: string) => val.length >= 32
  }
];

// Optional variables
const optionalVars = [
  {
    name: 'RESEND_API_KEY',
    description: 'Resend email API key',
    validate: (val: string) => val.startsWith('re_')
  },
  {
    name: 'ANTHROPIC_API_KEY',
    description: 'Anthropic API key (for scan extraction)',
    validate: (val: string) => val.startsWith('sk-ant-')
  }
];

// Check required variables
console.log('📋 Required Variables:');
for (const varConfig of requiredVars) {
  const value = process.env[varConfig.name];
  
  if (!value) {
    result.valid = false;
    result.errors.push(`❌ ${varConfig.name} is missing`);
    console.log(`  ❌ ${varConfig.name}: MISSING`);
  } else if (!varConfig.validate(value)) {
    result.valid = false;
    result.errors.push(`❌ ${varConfig.name} has invalid format`);
    console.log(`  ❌ ${varConfig.name}: INVALID FORMAT`);
  } else {
    console.log(`  ✅ ${varConfig.name}: OK`);
  }
}

// Check optional variables
console.log('\n📋 Optional Variables:');
for (const varConfig of optionalVars) {
  const value = process.env[varConfig.name];
  
  if (!value) {
    result.warnings.push(`⚠️  ${varConfig.name} is not set (${varConfig.description})`);
    console.log(`  ⚠️  ${varConfig.name}: NOT SET (optional)`);
  } else if (!varConfig.validate(value)) {
    result.warnings.push(`⚠️  ${varConfig.name} has invalid format`);
    console.log(`  ⚠️  ${varConfig.name}: INVALID FORMAT`);
  } else {
    console.log(`  ✅ ${varConfig.name}: OK`);
  }
}

// Check for .env.local file
console.log('\n📄 Configuration Files:');
const envLocalExists = fs.existsSync(path.join(process.cwd(), '.env.local'));
if (envLocalExists) {
  console.log('  ✅ .env.local: EXISTS');
} else {
  result.warnings.push('⚠️  .env.local file not found');
  console.log('  ⚠️  .env.local: NOT FOUND');
}

// Security checks
console.log('\n🔒 Security Checks:');

// Check admin password strength
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminPassword) {
  if (adminPassword.length < 12) {
    result.warnings.push('⚠️  Admin password should be at least 12 characters');
    console.log('  ⚠️  Admin password length: Consider using 12+ characters');
  } else {
    console.log('  ✅ Admin password length: OK');
  }
  
  // Check for common weak passwords
  const weakPasswords = ['password', 'admin', '12345678', 'qwerty'];
  if (weakPasswords.some(weak => adminPassword.toLowerCase().includes(weak))) {
    result.warnings.push('⚠️  Admin password appears to be weak');
    console.log('  ⚠️  Admin password strength: WEAK');
  } else {
    console.log('  ✅ Admin password strength: OK');
  }
}

// Check session secret
const sessionSecret = process.env.SESSION_SECRET;
if (sessionSecret && sessionSecret.length < 32) {
  result.warnings.push('⚠️  Session secret should be at least 32 characters');
  console.log('  ⚠️  Session secret length: TOO SHORT');
} else if (sessionSecret) {
  console.log('  ✅ Session secret length: OK');
}

// Summary
console.log('\n' + '='.repeat(50));
if (result.valid && result.errors.length === 0) {
  console.log('✅ Environment validation PASSED');
  if (result.warnings.length > 0) {
    console.log(`\n⚠️  ${result.warnings.length} warning(s):`);
    result.warnings.forEach(w => console.log(`   ${w}`));
  }
  process.exit(0);
} else {
  console.log('❌ Environment validation FAILED');
  console.log(`\n${result.errors.length} error(s):`);
  result.errors.forEach(e => console.log(`   ${e}`));
  
  if (result.warnings.length > 0) {
    console.log(`\n${result.warnings.length} warning(s):`);
    result.warnings.forEach(w => console.log(`   ${w}`));
  }
  
  console.log('\n💡 Tip: Copy .env.local.example to .env.local and fill in your values');
  process.exit(1);
}
