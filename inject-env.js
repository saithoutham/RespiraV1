const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'public', 'respira-local-config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

const geminiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_KEY || '';
const geminiBase = process.env.GEMINI_API_BASE || process.env.OPENROUTER_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const geminiModel = process.env.GEMINI_MODEL || process.env.OPENROUTER_MODEL || 'gemma-4-31b-it';

configContent = configContent
  .replace('REPLACE_ME_GEMINI_API_KEY', geminiKey)
  .replace('REPLACE_ME_GEMINI_API_BASE', geminiBase)
  .replace('REPLACE_ME_GEMINI_MODEL', geminiModel);

fs.writeFileSync(configPath, configContent);

if (geminiKey) {
  console.log('Successfully injected GEMINI_API_KEY');
} else {
  console.warn('GEMINI_API_KEY not found in environment variables');
}
