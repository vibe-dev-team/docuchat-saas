#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const command = process.argv[2];
if (!command) {
  console.error('Usage: dbmate-guard <command>');
  process.exit(1);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isDownCommand = ['down', 'rollback'].includes(command);

if (nodeEnv === 'production' && isDownCommand) {
  console.error('Refusing to run down migrations in production.');
  process.exit(1);
}

const result = spawnSync('dbmate', [command, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status ?? 1);
