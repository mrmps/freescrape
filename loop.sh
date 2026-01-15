#!/bin/bash
# Ralph Wiggum loop for llmfetch development
# Runs Claude Code repeatedly until exit criteria are met

MAX_ITERATIONS=${1:-100}
ITERATION=0

echo "Starting Ralph Wiggum loop (max $MAX_ITERATIONS iterations)"
echo "Exit criteria: tests pass + benchmark ≥75% success rate"
echo ""

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo "=== ITERATION $ITERATION / $MAX_ITERATIONS ==="
  echo "Started at: $(date)"

  # Run Claude with the PROMPT.md instructions
  claude -p "$(cat PROMPT.md @fix_plan.md)" \
    --dangerously-skip-permissions \
    --model sonnet \
    --verbose

  EXIT_CODE=$?
  echo "Claude exited with code: $EXIT_CODE"
  echo "Completed at: $(date)"
  echo ""

  # Check if we should stop (look for EXIT_SIGNAL in git log or a marker file)
  if [ -f ".ralph_complete" ]; then
    echo "Ralph complete marker found! Exiting."
    rm -f .ralph_complete
    break
  fi

  # Short pause between iterations
  sleep 5
done

echo "Ralph Wiggum loop finished after $ITERATION iterations"
