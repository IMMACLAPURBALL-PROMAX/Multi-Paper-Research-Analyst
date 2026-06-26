<!-- BEGIN:vercel-testing-rule -->
# STRICT INVARIANT: Only use Vercel CLI for Local Testing

You are STRICTLY FORBIDDEN from running `npm run dev`, `npm run build`, or `next build`.
You MUST EXCLUSIVELY run:
- `npx vercel dev`
- `npx vercel build`

Failure to follow this rule will cause environment inconsistencies.
<!-- END:vercel-testing-rule -->

<!-- BEGIN:git-push-rule -->
# STRICT INVARIANT: Do Not Git Push Without Permission

You MUST NEVER execute a `git push` command automatically under any circumstances. 
Always stop and wait for the user to explicitly say "push". You may commit changes locally using `git commit`, but pushing requires explicit user approval.
<!-- END:git-push-rule -->
