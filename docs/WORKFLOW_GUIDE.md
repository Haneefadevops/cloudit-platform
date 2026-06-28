# CloudIT Platform — Kimi Claw Workflow Guide

## Overview

This guide explains how to use the **3-file system** to work with Kimi Claw Desktop without crashes or lost progress.

## The 3 Files

| File | Purpose | Who Updates |
|------|---------|-------------|
| `MASTER_PROMPT.md` | One prompt you paste into Kimi Claw at the start of every session | **You** (only if rules change) |
| `KIMI_CLAW_INSTRUCTIONS.md` | All tasks with a "CURRENT TASK" tracker at the top | **Kimi Claw** (after each task) |
| `WORKFLOW_GUIDE.md` | This file — explains how everything works | **You** (if workflow changes) |

## File Locations

Save these files in your project:
```
C:\Project\cloudit-platform\docs├── MASTER_PROMPT.md
├── KIMI_CLAW_INSTRUCTIONS.md
└── WORKFLOW_GUIDE.md
```

## Step-by-Step Workflow

### Step 1: Before Starting Kimi Claw

1. Open `KIMI_CLAW_INSTRUCTIONS.md` in a text editor (VS Code, Notepad, etc.)
2. Check the **CURRENT TASK TRACKER** at the top
3. Note what the current task is

### Step 2: Start Kimi Claw Session

1. Open Kimi Claw Desktop (browser)
2. Copy the entire contents of `MASTER_PROMPT.md`
3. Paste it into Kimi Claw chat
4. Press Enter

### Step 3: Kimi Claw Works

Kimi Claw will:
1. Read the WORKFLOW_GUIDE.md file
2. Read the KIMI_CLAW_INSTRUCTIONS.md file
3. Find the CURRENT TASK
4. Execute that task
5. Update the instructions file (mark task as done, update tracker)
6. Commit and push to GitHub
7. Tell you: "Task X.Y done. Waiting for your 'continue' command."

### Step 4: You Continue

When Kimi Claw says it's done, just type:
```
continue
```

Kimi Claw will:
1. Read the updated instructions file
2. Find the new CURRENT TASK
3. Execute it
4. Update the file again
5. Commit and push
6. Say "Task X.Y+1 done. Waiting for continue."

### Step 5: Repeat Until Sprint Complete

Keep typing "continue" until the sprint is done.
When a sprint completes, Kimi Claw will say: "Sprint X complete. Next sprint: Y."

## What You Need to Do

| Action | When | Who |
|--------|------|-----|
| Paste MASTER_PROMPT | Start of every session | You |
| Type "continue" | After each task completes | You |
| Update instructions file | After each task | Kimi Claw |
| Commit and push | After each task | Kimi Claw |
| Update CURRENT TASK tracker | After each task | Kimi Claw |
| Check sprint progress | Anytime | You or Kimi Claw |

## Why This Works

| Problem | Solution |
|---------|----------|
| Kimi Claw crashes with big prompts | Master Prompt is small (~2,700 chars). Tasks are read from file. |
| Lost chat history | Instructions file is saved locally and in Git. |
| Don't know what to do next | CURRENT TASK tracker always shows the next task. |
| Accidentally paste wrong prompt | You only ever paste the Master Prompt. Kimi Claw reads tasks from file. |
| Multiple tasks run at once | Master Prompt explicitly says "ONE TASK AT A TIME." |
| Manual file updates forgotten | Kimi Claw updates the file automatically. |

## Important Rules

### DO:
- ✅ Paste the Master Prompt at the start of every session
- ✅ Type "continue" when Kimi Claw says it's done
- ✅ Let Kimi Claw update the instructions file (don't interfere)
- ✅ Verify Git push succeeded before closing Kimi Claw
- ✅ Keep the instructions file open in a text editor to monitor progress

### DON'T:
- ❌ Skip pasting the Master Prompt (Kimi Claw won't know the workflow)
- ❌ Type "continue" before Kimi Claw says it's done
- ❌ Edit the instructions file while Kimi Claw is working
- ❌ Let Kimi Claw run multiple tasks without stopping
- ❌ Close Kimi Claw without confirming the task is done

## If Kimi Claw Crashes

1. Note what task was running (from the CURRENT TASK tracker in the file)
2. Restart Kimi Claw
3. Paste the Master Prompt again
4. Add this message: **"Continue from Task X.Y — you were working on [specific file]."**
5. Kimi Claw will resume from where it left off

## If You Want to Skip a Task

1. Open `KIMI_CLAW_INSTRUCTIONS.md`
2. Manually update the CURRENT TASK tracker to the next task
3. In the task list, mark the skipped task as `[ ] SKIPPED`
4. Save the file
5. Commit and push manually:
   ```bash
   git add docs/KIMI_CLAW_INSTRUCTIONS.md
   git commit -m "docs: skip task X.Y"
   git push origin main
   ```
6. Continue with the next task

## Sprint Completion

When a sprint is complete, Kimi Claw will:
1. Update the Sprint Progress checkboxes
2. Mark the sprint as `[x] COMPLETE`
3. Update CURRENT TASK to the first task of the next sprint
4. Commit and push
5. Say: "Sprint X complete. Starting Sprint Y, Task Y.1"

## Example Session Log

```
Session 1:
- User pasted Master Prompt
- Kimi Claw read workflow and instructions files
- Found Task 3.1
- Completed Task 3.1
- Updated instructions file (marked 3.1 as [x], set current to 3.2)
- Committed and pushed
- Said: "Task 3.1 done. Waiting for 'continue'."
- User typed: "continue"
- Kimi Claw read updated instructions file
- Found Task 3.2
- Completed Task 3.2
- Updated instructions file again
- Committed and pushed
- Said: "Task 3.2 done. Waiting for 'continue'."
- User closed Kimi Claw

Session 2 (next day):
- User pasted Master Prompt
- Kimi Claw read workflow and instructions files
- Found Task 3.3 (current task)
- Completed Task 3.3
- ... and so on ...
```

## Quick Commands

```bash
# Check current task
cat docs/KIMI_CLAW_INSTRUCTIONS.md | head -20

# Check last commit
git log --oneline -5

# Check if Kimi Claw pushed correctly
git status
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Kimi Claw says "I can't find the instructions file" | Verify the file path in MASTER_PROMPT matches your actual path |
| Kimi Claw tries to do multiple tasks | Stop it and say "Only do the CURRENT TASK. Stop after that." |
| Git push fails | Check internet, check Git credentials, try again |
| Task is too big for Kimi Claw | Ask Kimi Claw to split it into 2 smaller tasks |
| Not sure if task is done | Ask Kimi Claw: "Show me what files you changed and confirm the commit" |
| Instructions file not updated | Check if Kimi Claw has write access to the file |
| Current task shows wrong task | Manually update the tracker to the correct task |

## Tips for Success

1. **Start each session fresh.** Always paste the Master Prompt. Don't assume Kimi Claw remembers.
2. **Be patient.** One task per session might seem slow, but it's crash-proof.
3. **Verify before moving on.** Always check that Git push succeeded before typing "continue".
4. **Keep backups.** The instructions file is in Git, so you can always revert.
5. **Don't rush.** If Kimi Claw is taking time, let it finish. Don't interrupt.
6. **Monitor progress.** Keep the instructions file open to see real-time progress.

## Contact & Support

- Project: CloudIT Platform
- Repo: https://github.com/Haneefadevops/cloudit-platform.git
- Server: Hetzner CX33
- Domain: cloudit.lk

---

*Workflow Guide v1.0 — Generated for CloudIT Platform*
