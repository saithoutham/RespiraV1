const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'public', 'respira-local-config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

const openrouterKey = process.env.OPENROUTER_KEY || '';
const openrouterBase = process.env.OPENROUTER_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const openrouterModel = process.env.OPENROUTER_MODEL || 'gemma-4-31b-it';

configContent = configContent
  .replace('REPLACE_ME_OPENROUTER_KEY', openrouterKey)
  .replace('REPLACE_ME_OPENROUTER_BASE', openrouterBase)
  .replace('REPLACE_ME_OPENROUTER_MODEL', openrouterModel);

fs.writeFileSync(configPath, configContent);

if (openrouterKey) {
  console.log('Successfully injected OPENROUTER_KEY');
} else {
  console.warn('OPENROUTER_KEY not found in environment variables');
}
