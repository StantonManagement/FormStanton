#!/usr/bin/env ts-node

import bcrypt from 'bcryptjs';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 12;

async function getPasswordFromArgsOrPrompt(): Promise<string> {
  const argPassword = process.argv[2];
  if (argPassword) {
    return argPassword;
  }

  const rl = createInterface({ input, output });
  try {
    const password = await rl.question('Enter new admin password: ');
    const confirmation = await rl.question('Confirm admin password: ');

    if (password !== confirmation) {
      throw new Error('Passwords do not match');
    }

    return password;
  } finally {
    rl.close();
  }
}

function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (password !== password.trim()) {
    throw new Error('Password cannot have leading or trailing whitespace');
  }
}

async function main() {
  try {
    const password = await getPasswordFromArgsOrPrompt();
    validatePassword(password);

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    console.log('ADMIN_PASSWORD_HASH=' + hash);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to generate admin password hash:', message);
    process.exit(1);
  }
}

void main();
