<!-- BEGIN:vercel-testing-rule -->
# Use Vercel CLI for Local Testing

When testing the application locally to verify builds or serve the app, **always** prioritize using the Vercel CLI commands instead of standard npm/Next.js commands. This accurately simulates the Vercel production environment (including Edge functions and Serverless constraints).

- Use `npx vercel dev` instead of `npm run dev`
- Use `npx vercel build` instead of `npm run build`
<!-- END:vercel-testing-rule -->
