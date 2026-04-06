# RespiraV1

Respira demo app prepared for GitHub and Vercel deployment.

## Deploy on Vercel

1. Import this repo into Vercel.
2. Set these project environment variables:
   - `OPENROUTER_KEY`
   - `OPENROUTER_BASE`
   - `OPENROUTER_MODEL`
3. Use these values for the current Gemma setup:
   - `OPENROUTER_BASE=https://generativelanguage.googleapis.com/v1beta`
   - `OPENROUTER_MODEL=gemma-4-31b-it`
4. Deploy.

## Notes

- This app is a static frontend demo.
- The build step writes the Vercel environment variables into `public/respira-local-config.js`.
- Do not commit a real API key into the repo.
