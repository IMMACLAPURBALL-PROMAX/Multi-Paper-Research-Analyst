<!-- BEGIN:vercel-testing-rule -->
# STRICT INVARIANT: Only use Vercel CLI for Local Testing

You are STRICTLY FORBIDDEN from running `npm run dev`, `npm run build`, or `next build`.
You MUST EXCLUSIVELY run:
- `npx vercel dev`
- `npx vercel build`

Failure to follow this rule will cause environment inconsistencies.
<!-- END:vercel-testing-rule -->

<!-- BEGIN:git-command-rule -->
# STRICT INVARIANT: Do Not Run Any Git Commands Without Permission

You MUST NEVER execute ANY `git` commands (including `git add`, `git commit`, `git push`, `git pull`, etc.) automatically under any circumstances. 
Always make your code changes, summarize them, and stop. Wait for the user to explicitly instruct you to "commit" or "push". Only execute git commands when the user gives direct, explicit permission for that specific action.
<!-- END:git-command-rule -->
