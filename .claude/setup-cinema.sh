#!/bin/sh
# SessionStart: install yt-dlp (+ browser impersonation) and put `c` on PATH.
# Runs only in Claude Code cloud sessions; ffmpeg/curl/python3 are preinstalled there.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
dir=$(cd "$(dirname "$0")" && pwd)
python3 -m pip install -q --upgrade "yt-dlp[default,curl-cffi]" >/dev/null 2>&1 || true
ln -sf "$dir/cinema/c" /usr/local/bin/c 2>/dev/null || true
exit 0
