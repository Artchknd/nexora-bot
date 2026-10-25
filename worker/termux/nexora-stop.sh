#!/data/data/com.termux/files/usr/bin/bash
# Termux:Widget shortcut: stop the worker. SIGTERM lets it report "offline" first.
DIR="$HOME/nexora-bot/worker"
PID_FILE="$DIR/worker.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  PID="$(cat "$PID_FILE")"
  kill -TERM "$PID"
  for _ in $(seq 1 15); do
    kill -0 "$PID" 2>/dev/null || break
    sleep 1
  done
  kill -0 "$PID" 2>/dev/null && kill -KILL "$PID"
  echo "Nexora worker stopped"
else
  echo "Nexora worker is not running"
fi
rm -f "$PID_FILE"
termux-wake-unlock
