# Prompt for next Kimi session — push TheReplyte multi-channel changes

## Context

The TheReplyte multi-channel rollout is complete and verified by the original Kimi session. There are 8 verified local commits that must be pushed to the remote. Separately, Codex is working on uncommitted NotchMe changes in the working tree; those must NOT be pushed.

## Your task

Push **only** the verified TheReplyte commits. Do not push any uncommitted working-tree changes.

## Exact commands

Run these commands in order:

```bash
cd /path/to/cloudit-platform

# Confirm the current branch and the verified commit
# Should print: 9a1a436 fix(thereplyte): Phase 5 — restore full Chatwoot env template with FB/IG vars
git log --oneline -1

# Push exactly that commit and its ancestors.
# Replace 'master' with the actual remote branch name if it is different.
git push origin 9a1a436:master
```

If the remote default branch is `main` instead of `master`, use:

```bash
git push origin 9a1a436:main
```

## Hard rules

1. **Do NOT run `git push origin master` or `git push --all` blindly.** Only push the explicit commit SHA.
2. **Do NOT commit or stage any working-tree changes** that belong to the NotchMe project or any unrelated work.
3. **Do NOT force-push** (`-f`) unless explicitly instructed by the user.
4. If the push fails because the remote branch has moved on, stop and report the error to the user — do not try to resolve it with rebase or merge.

## Verification after push

After the push succeeds, confirm the remote has exactly the 8 TheReplyte commits:

```bash
git fetch origin
git log origin/master --oneline -8
```

Expected output (order may vary if remote was already ahead):

```
9a1a436 fix(thereplyte): Phase 5 — restore full Chatwoot env template with FB/IG vars
52fb56b feat(thereplyte): Phase 5 — CloudIT go-live docs and Chatwoot env template
739f498 feat(thereplyte): Phase 4 — analytics, AI settings, and playground multi-channel support
d306fa5 feat(thereplyte): Phase 3 — dashboard customer and support views for multi-channel
cec2154 feat(thereplyte): Phase 2 — add missing client channel migration
2d2a4db feat(thereplyte): Phase 2 — dashboard client onboarding for multi-channel
50c21cc feat(thereplyte): Phase 1 — backend routing fixes for multi-channel
a125ef6 feat(thereplyte): Phase 0 — documentation alignment for multi-channel onboarding
```

## Report back

Return a concise summary with:
- The exact push command you ran.
- Whether the push succeeded or failed.
- The output of `git log origin/master --oneline -8` (or `origin/main`).
- Any errors or unexpected state.
