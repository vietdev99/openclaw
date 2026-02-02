const fs = require('fs');
const path = require('path');
const os = require('os');

// Read current config
const configPath = path.join(os.homedir(), '.moltbot', 'moltbot.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Read Claude credentials
const claudeCredsPath = path.join(os.homedir(), '.claude', '.credentials.json');
const claudeCreds = JSON.parse(fs.readFileSync(claudeCredsPath, 'utf-8'));

// Add auth profiles
if (!config.auth) config.auth = {};
if (!config.auth.profiles) config.auth.profiles = {};

config.auth.profiles['anthropic:claude-cli'] = {
  mode: 'oauth',
  provider: 'anthropic',
  accessToken: claudeCreds.claudeAiOauth.accessToken,
  refreshToken: claudeCreds.claudeAiOauth.refreshToken,
  expiresAt: claudeCreds.claudeAiOauth.expiresAt
};

// Write updated config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Auth profile added successfully!');
console.log(JSON.stringify(config, null, 2));
