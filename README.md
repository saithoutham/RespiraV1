# RespiraV1

Respira demo app prepared for GitHub and Vercel deployment.

## Deploy on Vercel

1. Import this repo into Vercel.
2. Use these Vercel project settings:
   - Framework Preset: `Other`
   - Root Directory: repo root `/`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: leave blank or use `npm install`
3. Set these project environment variables:
   - `GEMINI_API_KEY`
   - `GEMINI_API_BASE`
   - `GEMINI_MODEL`
4. Apply those env vars to:
   - `Production`
   - `Preview`
   - `Development`
5. Use these values for the current Gemma setup:
   - `GEMINI_API_BASE=https://generativelanguage.googleapis.com/v1beta`
   - `GEMINI_MODEL=gemma-4-31b-it`
6. Redeploy.

## What Vercel Means

- Root Directory: the folder Vercel treats as the app source. For this repo it should be the repo root, not `public/` and not any subfolder.
- Environment labels: where each env var applies. `Production` is the live site, `Preview` is branch/PR deploys, `Development` is local `vercel dev`.

## Notes

- This app is a static frontend demo.
- The build step writes the Vercel environment variables into `dist/public/respira-local-config.js`.
- Do not commit a real API key into the repo.
- `OPENROUTER_*` env names are still accepted as fallback, but the deploy target is Google Gemma/Gemini, so `GEMINI_*` is the correct naming.
