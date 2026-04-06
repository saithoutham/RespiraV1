const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const filesToCopy = ['index.html', '404.html', 'respira.html', 'sw.js'];
const dirsToCopy = [
  'public',
  'caregiver',
  'checkin',
  'dashboard',
  'education',
  'health',
  'login',
  'medications',
  'onboarding',
  'reports',
  'scans',
  'settings',
  'signup',
  'timeline'
];

const geminiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_KEY || '';
const geminiBase = process.env.GEMINI_API_BASE || process.env.OPENROUTER_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const geminiModel = process.env.GEMINI_MODEL || process.env.OPENROUTER_MODEL || 'gemma-4-31b-it';

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

filesToCopy.forEach((file) => {
  fs.copyFileSync(path.join(rootDir, file), path.join(distDir, file));
});

dirsToCopy.forEach((dir) => {
  fs.cpSync(path.join(rootDir, dir), path.join(distDir, dir), { recursive: true });
});

const configPath = path.join(distDir, 'public', 'respira-local-config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

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

console.log('Built deploy output at dist/');
