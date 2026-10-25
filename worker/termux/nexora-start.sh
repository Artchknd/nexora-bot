#!/data/data/com.termux/files/usr/bin/bash
# Termux:Widget shortcut: start the Nexora worker in the background.
DIR="$HOME/nexora-bot/worker"
PID_FILE="$DIR/worker.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Nexora worker is already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

termux-wake-lock
cd "$DIR" || exit 1
nohup node --env-file=.env index.ts >> worker.log 2>&1 &
echo $! > "$PID_FILE"
echo "Nexora worker started (pid $!). Log: $DIR/worker.log"
