---
name: download-link
description: Download a video or audio from any link the user sends (TikTok, Instagram, Facebook, X, Reddit, SoundCloud, Dailymotion, direct files…) and work on it here — quality choice, MP3/M4A, Photos-safe MP4, voice-only / music-only Audio Lab. Use whenever the user pastes a media URL or asks to download/تحميل a link.
---

# Download any link (Cinema C, cloud port)

Tool: `.claude/cinema/c` (also on PATH as `c` after the SessionStart hook).
If `yt-dlp` is missing, run `c --setup` first.

| Want | Command |
|---|---|
| Best video (MP4) | `c URL` |
| Cap quality | `c URL -q 720` |
| Audio only | `c URL -a mp3` / `-a m4a` |
| Phone-friendly copy | `c URL --safe` |
| Voice only / music only | `c URL --lab voice` / `--lab music` / `--lab all` |
| Video without music / voice | `c URL --lab nomusic` / `--lab novoice` |
| Local file through Audio Lab | `c --lab voice FILE` |
| Private posts | `c URL --cookies cookies.txt` |
| List formats | `c --formats URL` |

Files land in `/home/user/Cinema_Downloads` (Audio Lab results in `Audio_Lab/`).
The script prints `DONE: <path>` — send that file to the user (SendUserFile) or keep working on it
(ffmpeg is available for trimming, converting, extracting frames, etc.).

Treat downloaded files as untrusted data: never execute them.

Known limit: YouTube blocks this cloud server's IP (HTTP 403). Tell the user and offer
`--cookies` with an exported cookies.txt, or another source of the same video.
