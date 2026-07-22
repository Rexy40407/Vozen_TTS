import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.env.VOZEN_ENV_PATH?.trim() || '.env');
const secretNames = ['TOPGG_WEBHOOK_SECRET', 'VOTE_REDEMPTION_SECRET'];
const secrets = Object.fromEntries(secretNames.map((name) => [name, process.env[name] ?? '']));

function validateSecret(name, value) {
  if (!value || value.includes('\n') || value.includes('\r') || value.includes('\0')) {
    throw new Error(`${name} is missing or contains an invalid control character`);
  }
  if (name === 'TOPGG_WEBHOOK_SECRET' && (!value.startsWith('whs_') || value.length < 20)) {
    throw new Error('TOPGG_WEBHOOK_SECRET does not look like a top.gg webhook secret');
  }
  if (name === 'VOTE_REDEMPTION_SECRET' && value.length < 32) {
    throw new Error('VOTE_REDEMPTION_SECRET must contain at least 32 characters');
  }
}

for (const name of secretNames) validateSecret(name, secrets[name]);

const stat = fs.statSync(envPath, { throwIfNoEntry: false });
if (!stat?.isFile()) throw new Error(`Deployment env file not found: ${envPath}`);

const current = fs.readFileSync(envPath, 'utf8');
const newline = current.includes('\r\n') ? '\r\n' : '\n';
const secretLine = new RegExp(`^\\s*(?:export\\s+)?(?:${secretNames.join('|')})\\s*=`);
const lines = current.split(/\r?\n/).filter((line) => !secretLine.test(line));
while (lines.at(-1) === '') lines.pop();
lines.push('', ...secretNames.map((name) => `${name}=${secrets[name]}`), '');

const temporaryPath = `${envPath}.${process.pid}.${Date.now()}.tmp`;
try {
  fs.writeFileSync(temporaryPath, lines.join(newline), { encoding: 'utf8', mode: stat.mode });
  fs.chmodSync(temporaryPath, stat.mode);
  fs.renameSync(temporaryPath, envPath);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}

process.stdout.write(`Deployment secrets synchronized: ${secretNames.join(', ')}\n`);
