#!/bin/sh
# Cinema C V33 — Pro — iPhone / a-Shell
# Built on V32 AudioLab (every proven path kept unchanged). New in V33:
# - SOUND GUARD: after every video download Cinema checks the sound.
#     no audio track / silent track -> automatic retry with a format that has sound
#     TikTok-style HE-AAC audio      -> converted to plain AAC (plays everywhere)
#     HEVC / VP9 / AV1 video         -> extra iPhone-safe H.264 copy
# - Smarter format choice: H.264 without watermark preferred on TikTok & co.
# - Paste anything: Cinema finds the link inside shared text; Enter = clipboard
# - BATCH: several links at once, `c --batch links.txt`, or whole playlists
# - 12) EDIT STUDIO: trim, compress for WhatsApp, GIF, cover image, speed,
#        rotate, 9:16 Reels (blurred background), square, loudness boost,
#        mute, fix sound, burn subtitles      (also: c --edit [FILE])
# - 13) THUMBNAIL  14) SUBTITLES (.srt)  15) INFO
# - c --history / c --again (repeat the last link) / c --doctor
# - c --update-nightly (newest yt-dlp when a site just broke)
# - Bilingual menus (English / العربية)
#
# Kept from V32/V31/V17/V11:
# - V17 UX: c -> URL -> quality -> Photos/Files -> exact downloaded file
# - V11/Cinema_Photos output discovery: unique work directory, no --print-to-file
# - Manual Photos: create a separate Photos-safe MP4, then open it
# - Audio Lab (voice / music separation), Facebook profile best-effort mode
#
# Photos SAFE normalization:
# - H.264 video
# - AAC audio
# - yuv420p pixel format
# - MP4 +faststart
# - original download preserved
# - no ffprobe dependency (ffmpeg -i is used for inspection everywhere)
#
# a-Shell rules followed everywhere: no ffprobe, no `while read < file`
# (it can read the KEYBOARD in a-Shell), no background jobs, no python heredocs.

set -u

APP='Cinema C'
VERSION='33.0-Pro-iPhone'

HOME_DIR=${HOME:-.}
BIN_DIR="$HOME_DIR/Documents/bin"
DOWNLOAD_DIR=${CINEMA_DOWNLOAD_DIR:-"$HOME_DIR/Documents/Cinema_Downloads"}
STATE_DIR="$HOME_DIR/Documents/.cinema"

CONNECTIONS=${CINEMA_CONNECTIONS:-8}
INPUT=''
INSTALL=0
COOKIES=''
YTDLP=''
SAVE_MODE='ask'   # ask | photos | files
OUTPUT_FILE=''
PHOTOS_SAFE_FILE=''
WORK_DIR=''

# Facebook profile batch state (isolated from the proven single-video path)
FB_PROFILE_ID=''
FB_BATCH_DIR=''
FB_LINKS_FILE=''
FB_ARCHIVE_FILE=''
FB_SCAN_DIR=''
FB_SOCKET_TIMEOUT=${CINEMA_FB_SOCKET_TIMEOUT:-6}
FB_IMPERSONATE=''
FB_LOGIN_REQUIRED=0
FB_STATUS=''
FB_LAST_LOG=''
FB_DEBUG=0
FB_SETUP_COOKIES=0
FB_DOCTOR=0

# V32 Audio Lab / maintenance flags
LAB_LOCAL=0
LAB_FILE=''
LAB_MODE=''
LAB_LAST=''
LAB_DOCTOR=0
SETUP_AI=0
DO_UPDATE=0

# V33 Pro state
URL_LIST=''            # newline list of every URL found (batch when > 1)
BATCH_FILE=''
PLAYLIST=0
PLAYLIST_MAX=${CINEMA_PLAYLIST_MAX:-50}
EDIT_LOCAL=0
EDIT_FILE=''
SHOW_HISTORY=0
DO_AGAIN=0
DO_DOCTOR=0
UPDATE_NIGHTLY=0
SOUND_GUARD=${CINEMA_SOUND_GUARD:-1}   # 0 disables the post-download sound check
HISTORY_FILE="$STATE_DIR/history.txt"
PROBE_FILE="$STATE_DIR/.probe.txt"
EXTRA_SAFE_FILE=''     # H.264 copy built automatically for HEVC/VP9/AV1 downloads
ED_SS=''               # edit studio: start offset (seconds, ffmpeg syntax)
ED_T=''                # edit studio: duration (seconds, ffmpeg syntax)
ED_LAST=''

say() { printf '%s\n' "$*"; }
err() { printf 'ERROR: %s\n' "$*" >&2; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  say 'Cinema C V33 — Pro — iPhone / a-Shell'
  say ''
  say 'Daily use / الاستخدام اليومي:'
  say '  c                      (paste a link, or just Enter to use the clipboard)'
  say '  c "URL"                (one link)'
  say '  c "URL1" "URL2" ...    (several links = batch)'
  say ''
  say 'Single video:'
  say '  paste a video/reel URL -> quality -> Photos SAFE or Files'
  say '  Shared text is fine: Cinema extracts the link from it.'
  say ''
  say 'Batch / playlists:'
  say '  c --batch links.txt    (one link per line)'
  say '  c --playlist "URL"     (whole playlist/channel, max CINEMA_PLAYLIST_MAX=50)'
  say '  at the URL prompt type  b  to paste many links, empty line to finish'
  say ''
  say 'Edit Studio / استوديو التعديل:'
  say '  c --edit               (pick a file from Cinema_Downloads)'
  say '  c --edit "file.mp4"    trim, compress, GIF, cover, speed, rotate, 9:16,'
  say '                         loudness, mute, fix sound, burn subtitles'
  say ''
  say 'Audio Lab (separate voice / music):'
  say '  c  -> paste URL -> 11'
  say '  c --lab                (pick a file from Cinema_Downloads)'
  say '  c --lab "file.mp4"     (process a specific file, offline)'
  say '  c --setup-ai           (optional studio-quality AI stems)'
  say '  c --lab-doctor'
  say ''
  say 'History:'
  say '  c --history            (last 20 downloads)'
  say '  c --again              (download the last link again)'
  say ''
  say 'Maintenance:'
  say '  c --update             (update yt-dlp; fixes most site errors)'
  say '  c --update-nightly     (newest yt-dlp build, when a site broke today)'
  say '  c --doctor             (check everything Cinema needs)'
  say ''
  say 'Install once:'
  say '  sh ./Cinema_C_V33_Pro_iPhone.sh --install'
  say ''
  say 'Facebook authentication:'
  say '  c --setup-facebook-cookies'
  say '  c --cookies facebook_cookies.txt "PROFILE_URL"'
  say ''
  say 'Diagnostics:'
  say '  c --fb-doctor'
  say '  c --fb-debug "PROFILE_URL"'
  say '  c --version'
  say ''
  say 'Settings (environment variables):'
  say '  CINEMA_SOUND_GUARD=0   disable the automatic sound check/fix'
  say '  CINEMA_CONNECTIONS=8   parallel fragments (1-16)'
  say ''
  say 'Important: Facebook profile-wide enumeration is best-effort.'
  say 'Cinema never claims that hidden/dynamic videos were all discovered.'
}

cleanup() {
  status=$?
  if [ -n "${WORK_DIR:-}" ] && [ -d "$WORK_DIR" ]; then
    rm -rf "$WORK_DIR" 2>/dev/null || true
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

find_ytdlp() {
  if have yt-dlp && yt-dlp --version >/dev/null 2>&1; then
    YTDLP='yt-dlp'
    return 0
  fi
  if have yt_dlp && yt_dlp --version >/dev/null 2>&1; then
    YTDLP='yt_dlp'
    return 0
  fi
  return 1
}

run_ytdlp() {
  "$YTDLP" "$@"
}

validate_connections() {
  case "$CONNECTIONS" in
    ''|*[!0-9]*)
      err '-N must be a whole number from 1 to 16.'
      exit 1
      ;;
  esac
  [ "$CONNECTIONS" -ge 1 ] && [ "$CONNECTIONS" -le 16 ] || {
    err '-N must be from 1 to 16.'
    exit 1
  }

  case "$FB_SOCKET_TIMEOUT" in
    ''|*[!0-9]*)
      err 'CINEMA_FB_SOCKET_TIMEOUT must be a whole number.'
      exit 1
      ;;
  esac
  [ "$FB_SOCKET_TIMEOUT" -ge 3 ] && [ "$FB_SOCKET_TIMEOUT" -le 15 ] || {
    err 'CINEMA_FB_SOCKET_TIMEOUT must be from 3 to 15 seconds.'
    exit 1
  }

}

validate_cookie_file() {
  [ -z "$COOKIES" ] && return 0

  [ -f "$COOKIES" ] || {
    err "Cookies file not found: $COOKIES"
    return 1
  }

  first_line=$(sed -n '1p' "$COOKIES" 2>/dev/null || true)
  case "$first_line" in
    '# Netscape HTTP Cookie File'|'# HTTP Cookie File')
      return 0
      ;;
  esac

  warn 'Cookies file does not start with a Netscape/Mozilla cookie header.'
  say 'Expected first line: # Netscape HTTP Cookie File'
  return 1
}


setup_facebook_cookies() {
  say 'Facebook profile authentication setup'
  say '-------------------------------------'
  say 'Facebook may redirect profile pages to LOGIN when the shell is not authenticated.'
  say ''
  say 'Cinema accepts a yt-dlp cookies file in Netscape/Mozilla format.'
  say 'Recommended filename in a-Shell Documents:'
  say '  facebook_cookies.txt'
  say ''
  say 'The first line must be one of:'
  say '  # Netscape HTTP Cookie File'
  say '  # HTTP Cookie File'
  say ''
  say 'Then run:'
  say '  c --cookies facebook_cookies.txt "PROFILE_URL"'
  say ''
  say 'If Documents/facebook_cookies.txt exists and is valid, plain `c` can use it automatically for a Facebook profile.'
  say ''
  say 'SECURITY: cookies are login credentials. Do not share this file.'
}

maybe_use_default_facebook_cookies() {
  [ -n "$COOKIES" ] && return 0

  default_cookie="$HOME_DIR/Documents/facebook_cookies.txt"
  [ -f "$default_cookie" ] || return 0

  previous_cookie=$COOKIES
  COOKIES=$default_cookie
  if validate_cookie_file >/dev/null 2>&1; then
    say '[C][auth] Using Documents/facebook_cookies.txt'
    return 0
  fi

  COOKIES=$previous_cookie
  return 0
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --install)
        INSTALL=1
        shift
        ;;
      --photos)
        SAVE_MODE='photos'
        shift
        ;;
      --files)
        SAVE_MODE='files'
        shift
        ;;
      -N)
        [ "$#" -ge 2 ] || { err '-N needs a number'; exit 1; }
        CONNECTIONS=$2
        shift 2
        ;;
      --cookies)
        [ "$#" -ge 2 ] || { err '--cookies needs a file'; exit 1; }
        COOKIES=$2
        shift 2
        ;;
      --output)
        [ "$#" -ge 2 ] || { err '--output needs a folder'; exit 1; }
        DOWNLOAD_DIR=$2
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      --fb-doctor)
        FB_DOCTOR=1
        shift
        ;;
      --fb-debug)
        FB_DEBUG=1
        shift
        ;;
      --setup-facebook-cookies)
        FB_SETUP_COOKIES=1
        shift
        ;;
      --lab)
        LAB_LOCAL=1
        shift
        if [ "$#" -gt 0 ]; then
          case "$1" in -*) ;; *) LAB_FILE=$1; shift ;; esac
        fi
        ;;
      --lab-doctor)
        LAB_DOCTOR=1
        shift
        ;;
      --setup-ai)
        SETUP_AI=1
        shift
        ;;
      --update)
        DO_UPDATE=1
        shift
        ;;
      --version)
        say "$APP $VERSION"
        exit 0
        ;;
      --batch)
        [ "$#" -ge 2 ] || { err '--batch needs a links file'; exit 1; }
        BATCH_FILE=$2
        shift 2
        ;;
      --playlist)
        PLAYLIST=1
        shift
        ;;
      --edit)
        EDIT_LOCAL=1
        shift
        if [ "$#" -gt 0 ]; then
          case "$1" in -*) ;; *) EDIT_FILE=$1; shift ;; esac
        fi
        ;;
      --history)
        SHOW_HISTORY=1
        shift
        ;;
      --again)
        DO_AGAIN=1
        shift
        ;;
      --doctor)
        DO_DOCTOR=1
        shift
        ;;
      --update-nightly)
        UPDATE_NIGHTLY=1
        shift
        ;;
      -*)
        err "Unknown option: $1"
        exit 1
        ;;
      *)
        add_urls_from_text "$1"
        [ -n "$INPUT" ] || INPUT=$1
        shift
        ;;
    esac
  done
  validate_connections
  validate_cookie_file || exit 1
}

install_self() {
  mkdir -p "$BIN_DIR" || { err "Cannot create $BIN_DIR"; exit 1; }
  cp "$0" "$BIN_DIR/c" || { err 'Install failed'; exit 1; }
  chmod +x "$BIN_DIR/c" 2>/dev/null || true
  have rehash && rehash >/dev/null 2>&1 || true
  say "OK: $APP $VERSION installed."
  say 'From now on type: c'
  say 'Photos SAFE needs no Shortcut; ffmpeg builds a compatibility MP4 first.'
  say 'Facebook profile mode is best-effort; LOGIN redirects become AUTH_REQUIRED.'
  say 'For Facebook cookies help: c --setup-facebook-cookies'
  say 'For diagnostics: c --fb-doctor'
  say 'Menu 11 = Audio Lab (voice / music separation); c --lab for local files.'
  say 'NEW V33: Sound Guard checks/fixes the sound of every video download.'
  say 'NEW V33: menu 12-15 = Edit Studio, Thumbnail, Subtitles, Info.'
  say 'NEW V33: Enter at the URL prompt uses the clipboard; b = many links.'
  say 'NEW V33: c --edit, c --batch FILE, c --playlist URL, c --history, c --again, c --doctor'
}

prompt_url() {
  if [ -z "$URL_LIST" ] && [ -z "$INPUT" ]; then
    pu_clip=''
    if have pbpaste; then
      mkdir -p "$STATE_DIR" 2>/dev/null || true
      pbpaste > "$STATE_DIR/.clipboard.txt" 2>/dev/null || true
      pu_clip=$(grep -Eo 'https?://[^[:space:]"<>]+' "$STATE_DIR/.clipboard.txt" 2>/dev/null | sed -n '1p')
      rm -f "$STATE_DIR/.clipboard.txt" 2>/dev/null || true
    fi
    say ''
    if [ -n "$pu_clip" ]; then
      say "Clipboard / المنسوخ: $pu_clip"
      printf 'Paste URL (Enter = clipboard, b = many links): '
    else
      printf 'Paste video URL (b = many links / عدة روابط): '
    fi
    IFS= read -r INPUT || INPUT=''
    case "$INPUT" in
      '') INPUT=$pu_clip ;;
      b|B) read_batch_lines; INPUT='' ;;
    esac
    [ -z "$INPUT" ] || add_urls_from_text "$INPUT" || true
  fi

  # V33: the link can sit inside any shared text; take the first one found.
  INPUT=$(url_at 1)
  case "$INPUT" in
    http://*|https://*) ;;
    *)
      err 'Invalid URL'
      exit 1
      ;;
  esac
}


is_facebook_profile_url() {
  case "$INPUT" in
    *facebook.com/profile.php\?*id=[0-9]*|*facebook.com/profile.php\?id=[0-9]*)
      return 0
      ;;
  esac
  return 1
}

extract_facebook_profile_id() {
  FB_PROFILE_ID=$(printf '%s\n' "$INPUT" | sed -n 's/.*[?&]id=\([0-9][0-9]*\).*/\1/p' | sed -n '1p')
  [ -n "$FB_PROFILE_ID" ]
}

fb_profile_paths() {
  FB_BATCH_DIR="$DOWNLOAD_DIR/Facebook_Profile_$FB_PROFILE_ID"
  FB_LINKS_FILE="$STATE_DIR/facebook_profile_${FB_PROFILE_ID}_links.txt"
  FB_ARCHIVE_FILE="$STATE_DIR/facebook_profile_${FB_PROFILE_ID}_archive.txt"
  FB_SCAN_DIR="$STATE_DIR/facebook_scan_${FB_PROFILE_ID}_last"

  # Keep the most recent scan artifacts only. They are useful for diagnosis,
  # but old scans should not accumulate forever.
  rm -rf "$FB_SCAN_DIR" 2>/dev/null || true
  mkdir -p "$FB_BATCH_DIR" "$FB_SCAN_DIR" "$STATE_DIR" || return 1
}

detect_fb_impersonation() {
  FB_IMPERSONATE=''

  targets=$("$YTDLP" --list-impersonate-targets 2>/dev/null || true)

  # Jev Q012 favored Safari before Chrome. More importantly, V30 never
  # impersonates on the first attempt; this target is fallback-only.
  if printf '%s\n' "$targets" | grep -E '^Safari([[:space:]-]|$)' | grep -Evi 'unavailable|not available' >/dev/null 2>&1; then
    FB_IMPERSONATE='safari'
    return 0
  fi

  if printf '%s\n' "$targets" | grep -E '^Chrome([[:space:]-]|$)' | grep -Evi 'unavailable|not available' >/dev/null 2>&1; then
    FB_IMPERSONATE='chrome'
    return 0
  fi

  return 1
}

facebook_doctor() {
  say 'Cinema Facebook Doctor'
  say '----------------------'
  say "Cinema: $VERSION"

  if ! find_ytdlp; then
    say 'yt-dlp: NOT FOUND'
    return 1
  fi

  ver=$("$YTDLP" --version 2>/dev/null || printf 'unknown')
  say "yt-dlp: $ver"
  say "profile socket timeout: ${FB_SOCKET_TIMEOUT}s"
  say 'profile shell watchdog: disabled (a-Shell has no fork-based job control)'

  if detect_fb_impersonation; then
    say "browser impersonation: available ($FB_IMPERSONATE)"
  else
    say 'browser impersonation: unavailable (not fatal)'
  fi

  if have ffmpeg; then
    say 'ffmpeg: available'
  else
    say 'ffmpeg: unavailable'
  fi

  say ''
  say 'For profile-wide Facebook discovery, a login wall may require:'
  say '  c --cookies cookies.txt "PROFILE_URL"'
  say 'The cookies file must be Netscape/Mozilla format.'
  return 0
}

count_lines_file() {
  f=$1
  if [ -f "$f" ]; then
    wc -l < "$f" 2>/dev/null | tr -d ' '
  else
    printf '0'
  fi
}

parse_facebook_dump_shell() {
  page=$1
  normalized="$FB_SCAN_DIR/normalized_$$.txt"
  : > "$normalized"

  # No Python and no executable heredoc: both were removed from this release.
  # Normalize common JSON/HTML escaping before extracting candidate IDs.
  sed 's#\\/#/#g; s#\\u0026#\&#g; s#&amp;#\&#g' "$page" > "$normalized" 2>/dev/null || {
    rm -f "$normalized" 2>/dev/null || true
    return 1
  }

  # /reel/123...
  grep -Eo '/reel/[0-9]{6,}' "$normalized" 2>/dev/null | \
    sed -n 's#^/reel/\([0-9][0-9]*\)$#https://www.facebook.com/reel/\1#p' \
    >> "$FB_LINKS_FILE" || true

  # /watch/?...v=123... and /video.php?...v=123...
  grep -Eo '(/watch/\?[^" <]*v=[0-9]{6,}|/video\.php\?[^" <]*v=[0-9]{6,})' "$normalized" 2>/dev/null | \
    sed -n 's/.*[?&]v=\([0-9][0-9]*\).*/https:\/\/www.facebook.com\/watch\/?v=\1/p' \
    >> "$FB_LINKS_FILE" || true

  # Facebook JSON payloads often expose video_id/videoId even when a direct
  # permalink is absent in the server-rendered HTML.
  grep -Eo '"(video_id|videoId)"[[:space:]]*:[[:space:]]*"[0-9]{6,}"' "$normalized" 2>/dev/null | \
    sed -n 's/.*"\([0-9][0-9]*\)"$/https:\/\/www.facebook.com\/watch\/?v=\1/p' \
    >> "$FB_LINKS_FILE" || true

  # Common permalink path: /name/videos/.../123456
  grep -Eo '/[^" <]+/videos/([^/" <]+/)?[0-9]{6,}' "$normalized" 2>/dev/null | \
    sed -n 's#.*/\([0-9][0-9]*\)$#https://www.facebook.com/watch/?v=\1#p' \
    >> "$FB_LINKS_FILE" || true

  rm -f "$normalized" 2>/dev/null || true
  return 0
}

dedupe_fb_links() {
  [ -s "$FB_LINKS_FILE" ] || return 1

  tmp="$FB_LINKS_FILE.tmp"
  seen="$FB_SCAN_DIR/seen_ids.txt"
  : > "$tmp"
  : > "$seen"

  fb_total=$(wc -l < "$FB_LINKS_FILE" | tr -d ' ')
  fb_i=0
  while [ "$fb_i" -lt "$fb_total" ]; do
    fb_i=$((fb_i + 1))
    u=$(sed -n "${fb_i}p" "$FB_LINKS_FILE")
    [ -n "$u" ] || continue
    vid=''

    case "$u" in
      *facebook.com/reel/*)
        vid=$(printf '%s\n' "$u" | sed -n 's#.*facebook\.com/reel/\([0-9][0-9]*\).*#\1#p')
        ;;
      *\?v=[0-9]*|*\&v=[0-9]*)
        vid=$(printf '%s\n' "$u" | sed -n 's/.*[?&]v=\([0-9][0-9]*\).*/\1/p')
        ;;
    esac

    [ -n "$vid" ] || continue

    if ! grep -qx "$vid" "$seen" 2>/dev/null; then
      printf '%s\n' "$vid" >> "$seen"
      printf '%s\n' "$u" >> "$tmp"
    fi
  done

  mv "$tmp" "$FB_LINKS_FILE"
  [ -s "$FB_LINKS_FILE" ]
}


fetch_fb_page_dump() {
  index=$1
  total=$2
  url=$3
  page_dir="$FB_SCAN_DIR/fetch_$index"

  rm -rf "$page_dir" 2>/dev/null || true
  mkdir -p "$page_dir" || return 1

  say "[C][scan] $index/$total checking Facebook..."

  attempt=1
  while [ "$attempt" -le 2 ]; do
    log_file="$page_dir/fetch_$attempt.log"
    FB_LAST_LOG=$log_file

    old_pwd=$(pwd)
    cd "$page_dir" || {
      err 'STATUS=SCAN_DIR_ERROR'
      return 1
    }

    set -- --ignore-errors --skip-download --write-pages \
      --quiet --no-warnings --no-progress \
      --socket-timeout "$FB_SOCKET_TIMEOUT" \
      --retries 0 --extractor-retries 0 --fragment-retries 0 \
      --no-playlist \
      --add-header 'Accept-Language:en-US,en;q=0.8'

    [ -z "$COOKIES" ] || set -- "$@" --cookies "$COOKIES"

    if [ "$attempt" -eq 2 ] && [ -n "$FB_IMPERSONATE" ]; then
      set -- "$@" --impersonate "$FB_IMPERSONATE"
    fi

    set -- "$@" "$url"

    "$YTDLP" "$@" >"$log_file" 2>&1
    rc=$?

    cd "$old_pwd" 2>/dev/null || cd "$HOME_DIR/Documents" 2>/dev/null || true

    login_seen=0
    if grep -Eqi 'facebook\.com/login/|Unsupported URL: https://(www\.)?facebook\.com/login/|_fb_noscript|login_next' "$log_file" 2>/dev/null; then
      login_seen=1
    fi

    for page in "$page_dir"/*.dump; do
      [ -f "$page" ] || continue
      case "$(basename "$page")" in
        *facebook.com_login*|*login_next*|*login_*)
          login_seen=1
          ;;
      esac
    done

    if [ "$login_seen" -eq 1 ]; then
      FB_LOGIN_REQUIRED=1
      FB_STATUS='AUTH_REQUIRED'
      say '[C][auth] STATUS=AUTH_REQUIRED'
      say '[C][auth] Facebook redirected profile discovery to LOGIN.'
      if [ "$FB_DEBUG" -eq 1 ]; then
        say '[C][debug] Last Facebook fetch log:'
        tail -n 20 "$log_file" 2>/dev/null || true
      fi
      return 2
    fi

    dump_count=0
    before=$(count_lines_file "$FB_LINKS_FILE")

    for page in "$page_dir"/*.dump; do
      [ -f "$page" ] || continue
      dump_count=$((dump_count + 1))
      parse_facebook_dump_shell "$page" || true
    done

    dedupe_fb_links >/dev/null 2>&1 || true
    after=$(count_lines_file "$FB_LINKS_FILE")

    if [ "$dump_count" -gt 0 ]; then
      if [ "$after" -gt "$before" ] 2>/dev/null; then
        say "[C][scan] +$((after - before)) candidates (total $after)"
      else
        say '[C][scan] page received; +0 candidates'
      fi
      FB_STATUS='PAGE_RECEIVED'
      if [ "$FB_DEBUG" -eq 1 ]; then
        say '[C][debug] Last Facebook fetch log:'
        tail -n 20 "$log_file" 2>/dev/null || true
      fi
      return 0
    fi

    if [ "$attempt" -eq 1 ] && [ -n "$FB_IMPERSONATE" ]; then
      say "[C][scan] no page; retry once with $FB_IMPERSONATE..."
      attempt=2
      continue
    fi

    FB_STATUS='NO_PAGE'
    say '[C][scan] STATUS=NO_PAGE'
    if [ "$FB_DEBUG" -eq 1 ]; then
      say '[C][debug] Last Facebook fetch log:'
      tail -n 20 "$log_file" 2>/dev/null || true
    fi
    return 0
  done

  return 0
}

scan_facebook_profile() {
  : > "$FB_LINKS_FILE"
  FB_LOGIN_REQUIRED=0
  FB_STATUS=''
  detect_fb_impersonation >/dev/null 2>&1 || true

  if [ -n "$FB_IMPERSONATE" ]; then
    say "[C][scan] fallback browser available: $FB_IMPERSONATE"
  fi

  fetch_fb_page_dump 1 3 "$INPUT"
  rc=$?
  [ "$rc" -eq 2 ] && return 2

  before=$(count_lines_file "$FB_LINKS_FILE")
  fetch_fb_page_dump 2 3 "https://www.facebook.com/profile.php?id=$FB_PROFILE_ID&sk=reels_tab"
  rc=$?
  [ "$rc" -eq 2 ] && return 2
  after=$(count_lines_file "$FB_LINKS_FILE")
  say "[C][scan] reels surface added $((after - before)) candidates."

  discovered=$(count_lines_file "$FB_LINKS_FILE")
  if [ "$discovered" -eq 0 ] 2>/dev/null; then
    before=$discovered
    fetch_fb_page_dump 3 3 "https://m.facebook.com/profile.php?id=$FB_PROFILE_ID&sk=reels_tab"
    rc=$?
    [ "$rc" -eq 2 ] && return 2
    after=$(count_lines_file "$FB_LINKS_FILE")
    say "[C][scan] mobile fallback added $((after - before)) candidates."
  else
    say '[C][scan] candidates found; mobile fallback skipped.'
  fi

  dedupe_fb_links
}

run_fb_bulk_video() {
  video_url=$1
  selector=$2
  tpl="$FB_BATCH_DIR/%(title).100B [%(id)s].%(ext)s"

  bulk_connections=$CONNECTIONS
  [ "$bulk_connections" -le 4 ] || bulk_connections=4

  set -- --no-playlist --continue --newline --no-part \
    --concurrent-fragments "$bulk_connections" \
    --retries 10 --fragment-retries 10 --extractor-retries 3 \
    --socket-timeout 30 \
    --download-archive "$FB_ARCHIVE_FILE" \
    -f "$selector" -o "$tpl"

  [ -z "$COOKIES" ] || set -- "$@" --cookies "$COOKIES"

  if have ffmpeg; then
    set -- "$@" --merge-output-format mp4
  fi

  set -- "$@" "$video_url"
  run_ytdlp "$@"
}

facebook_profile_flow() {
  maybe_use_default_facebook_cookies

  extract_facebook_profile_id || {
    err 'Could not read the Facebook profile numeric ID.'
    return 1
  }

  fb_profile_paths || {
    err 'Could not create Facebook batch folders.'
    return 1
  }

  say ''
  say "[C] Facebook profile detected: $FB_PROFILE_ID"
  say '[C] Best-effort mode: Facebook does not expose a stable public bulk-video API to yt-dlp.'
  say ''
  say 'Profile quality:'
  say ' 1) BEST available'
  say ' 2) 1080p or lower'
  say ' 3) 720p or lower'
  say ' 0) Cancel'
  printf 'Number: '
  IFS= read -r q || q=''

  case "$q" in
    0) return 0 ;;
    1) selector=$(best_selector) ;;
    2) selector=$(selector_for_height 1080) ;;
    3) selector=$(selector_for_height 720) ;;
    *) err 'Wrong number.'; return 1 ;;
  esac

  say ''
  say '[C] Profile discovery starting.'
  say "[C] Socket timeout: ${FB_SOCKET_TIMEOUT}s; extraction retries: 0."
  [ -z "$COOKIES" ] || say "[C][auth] Cookies file: $COOKIES"

  scan_facebook_profile
  scan_rc=$?

  if [ "$scan_rc" -eq 2 ] || [ "$FB_LOGIN_REQUIRED" -eq 1 ]; then
    say ''
    say '========================================'
    say '[C] STATUS=AUTH_REQUIRED'
    say '[C] Facebook profile bulk discovery needs a logged-in Facebook session.'
    if [ -z "$COOKIES" ]; then
      say ''
      say 'Next step: put a valid Netscape/Mozilla cookie file in Documents as:'
      say '  facebook_cookies.txt'
      say ''
      say 'Then run the same daily command again:'
      say '  c'
      say ''
      say 'For setup help:'
      say '  c --setup-facebook-cookies'
    else
      say ''
      say 'The supplied cookies were rejected or are stale.'
      say 'Export a fresh logged-in Facebook cookies file and retry.'
    fi
    say ''
    say 'Single Facebook reel/video URLs still work normally.'
    say '========================================'
    return 0
  fi

  if [ "$scan_rc" -ne 0 ]; then
    err 'No candidate Facebook video/reel links were exposed to Cinema.'
    say 'This does NOT mean the profile has no videos.'
    say ''
    if [ -z "$COOKIES" ]; then
      say 'Retry with a fresh Netscape-format cookies file:'
      say "  c --cookies cookies.txt \"$INPUT\""
    else
      say 'Cookies were supplied, but Facebook still did not expose a bulk list.'
    fi
    say ''
    say 'Single Facebook reel/video URLs remain supported.'
    return 1
  fi

  discovered=$(count_lines_file "$FB_LINKS_FILE")
  say ''
  say "[C] Candidate links discovered: $discovered"
  say '[C] This count is NOT a guarantee that every profile video was exposed.'
  say "[C] Batch folder: $FB_BATCH_DIR"
  printf 'Download these candidates now? [y/N]: '
  IFS= read -r yn || yn=''

  case "$yn" in
    y|Y|yes|YES) ;;
    *) say 'Cancelled.'; return 0 ;;
  esac

  if [ "$discovered" -gt 50 ] 2>/dev/null; then
    say "[C] Large batch: $discovered candidates."
    printf 'Confirm large download again? [y/N]: '
    IFS= read -r yn2 || yn2=''
    case "$yn2" in
      y|Y|yes|YES) ;;
      *) say 'Cancelled.'; return 0 ;;
    esac
  fi

  attempted=0
  downloaded=0
  skipped=0
  failed=0

  fb_total=$(wc -l < "$FB_LINKS_FILE" | tr -d ' ')
  fb_i=0
  while [ "$fb_i" -lt "$fb_total" ]; do
    fb_i=$((fb_i + 1))
    video_url=$(sed -n "${fb_i}p" "$FB_LINKS_FILE")
    [ -n "$video_url" ] || continue

    attempted=$((attempted + 1))
    before=$(count_lines_file "$FB_ARCHIVE_FILE")

    say ''
    say "[$attempted/$discovered] $video_url"

    if run_fb_bulk_video "$video_url" "$selector"; then
      after=$(count_lines_file "$FB_ARCHIVE_FILE")
      if [ "$after" -gt "$before" ] 2>/dev/null; then
        downloaded=$((downloaded + 1))
      else
        skipped=$((skipped + 1))
      fi
    else
      failed=$((failed + 1))
      warn "Failed: $video_url"
    fi
  done

  say ''
  say '========================================'
  say '[C] Facebook profile batch finished.'
  say "[C] Discovered: $discovered"
  say "[C] New downloads: $downloaded"
  say "[C] Already downloaded/skipped: $skipped"
  say "[C] Failed: $failed"
  say "[C] Folder: $FB_BATCH_DIR"
  say '========================================'

  [ "$downloaded" -gt 0 ] || [ "$skipped" -gt 0 ]
}

show_menu() {
  say ''
  say 'Choose quality:'
  say '----------------------------------------'
  say ' 1) BEST quality — automatic       — أفضل جودة'
  say ' 2) 4K / 2160p or lower'
  say ' 3) 2K / 1440p or lower'
  say ' 4) Full HD / 1080p or lower'
  say ' 5) HD / 720p or lower'
  say ' 6) SD / 480p or lower             — حجم صغير'
  say ' 7) FAST MP4 — H.264, most compatible — سريع ومتوافق'
  say ' 8) AUDIO — M4A                    — صوت فقط'
  say ' 9) AUDIO — MP3                    — صوت MP3'
  say '10) EXACT site formats — show IDs'
  say '11) AUDIO LAB — voice / music      — فصل الصوت والموسيقى'
  say '12) EDIT STUDIO — trim/compress/GIF — تعديل وقص وضغط'
  say '13) THUMBNAIL — cover image        — صورة الغلاف'
  say '14) SUBTITLES — .srt               — الترجمة'
  say '15) INFO — title / duration        — معلومات'
  say ' 0) Cancel'
  say '----------------------------------------'
}

choose_destination() {
  media_kind=$1

  if [ "$media_kind" = 'audio' ]; then
    SAVE_MODE='files'
    return 0
  fi

  [ "$SAVE_MODE" = 'ask' ] || return 0

  say ''
  say 'Save after download:'
  say ' 1) Photos SAFE   — verify by rebuilding to iPhone-safe MP4 — الصور'
  say ' 2) Files only    — Cinema_Downloads                       — الملفات'
  printf 'Number: '
  IFS= read -r dst || dst=''

  case "$dst" in
    1) SAVE_MODE='photos' ;;
    2) SAVE_MODE='files' ;;
    *)
      err 'Wrong number.'
      exit 1
      ;;
  esac
}

selector_for_height() {
  h=$1
  if have ffmpeg; then
    printf '%s' "bv*[height<=$h][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=$h][ext=mp4]+ba/b[height<=$h][ext=mp4]/b[height<=$h]/best"
  else
    printf '%s' "b[height<=$h][ext=mp4]/b[height<=$h]/best"
  fi
}

best_selector() {
  if have ffmpeg; then
    printf '%s' 'bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv*[ext=mp4]+ba/b[ext=mp4]/best'
  else
    printf '%s' 'b[ext=mp4]/best'
  fi
}

new_work_dir() {
  mkdir -p "$STATE_DIR" "$DOWNLOAD_DIR" || {
    err 'Cannot create working folders.'
    exit 1
  }

  stamp=$(date '+%Y%m%d_%H%M%S' 2>/dev/null || printf 'job')
  WORK_DIR="$STATE_DIR/job_${stamp}_$$"
  mkdir -p "$WORK_DIR" || {
    err 'Cannot create unique download job folder.'
    exit 1
  }
}

discover_completed_output() {
  found=''
  count=0

  # Historical method: inspect the unique job folder only after yt-dlp exits.
  # Ignore known temporary/metadata files.
  for f in "$WORK_DIR"/*; do
    [ -f "$f" ] || continue
    case "$f" in
      *.part|*.ytdl|*.temp|*.tmp|*.json|*.description|*.jpg|*.jpeg|*.png|*.webp)
        continue
        ;;
    esac

    case "$f" in
      *.mp4|*.MP4|*.m4v|*.M4V|*.mov|*.MOV|*.mkv|*.MKV|*.webm|*.WEBM|*.m4a|*.M4A|*.mp3|*.MP3|*.aac|*.AAC|*.opus|*.OPUS)
        found=$f
        count=$((count + 1))
        ;;
    esac
  done

  [ "$count" -eq 1 ] || {
    if [ "$count" -eq 0 ]; then
      err 'yt-dlp finished but no completed media file was found.'
    else
      err 'More than one completed media file was found; refusing to guess.'
    fi
    return 1
  }

  OUTPUT_FILE=$found
  return 0
}

move_to_downloads() {
  [ -n "$OUTPUT_FILE" ] && [ -f "$OUTPUT_FILE" ] || return 1

  base=${OUTPUT_FILE##*/}
  dest="$DOWNLOAD_DIR/$base"

  if [ -e "$dest" ]; then
    stamp=$(date '+%Y%m%d_%H%M%S' 2>/dev/null || printf '%s' "$$")
    dest="$DOWNLOAD_DIR/Cinema_${stamp}_$base"
  fi

  mv "$OUTPUT_FILE" "$dest" || {
    err 'Could not move the completed file into Cinema_Downloads.'
    return 1
  }

  OUTPUT_FILE=$dest
  return 0
}

ytdlp_attempt() {
  # $1 selector ; $2 action ; $3 impersonate target (optional)
  y_sel=$1
  y_act=$2
  y_imp=${3:-}

  if [ -n "${WORK_DIR:-}" ] && [ -d "$WORK_DIR" ]; then
    rm -rf "$WORK_DIR" 2>/dev/null || true
  fi
  new_work_dir
  tpl="$WORK_DIR/%(title).120B [%(id)s].%(ext)s"

  # Deliberately no --print-to-file and no last_output.txt.
  set -- --no-playlist --continue --newline --no-part \
    --concurrent-fragments "$CONNECTIONS" \
    --retries 10 --fragment-retries 10 --extractor-retries 3 \
    --socket-timeout 30 \
    -f "$y_sel" -o "$tpl"

  [ -z "$COOKIES" ] || set -- "$@" --cookies "$COOKIES"
  [ -z "$y_imp" ] || set -- "$@" --impersonate "$y_imp"

  case "$y_act" in
    merge)
      if have ffmpeg; then
        set -- "$@" --merge-output-format mp4
      fi
      ;;
    m4a)
      if have ffmpeg; then
        set -- "$@" -x --audio-format m4a
      fi
      ;;
    mp3)
      if ! have ffmpeg; then
        err 'MP3 needs ffmpeg. Choose M4A instead.'
        return 1
      fi
      set -- "$@" -x --audio-format mp3 --audio-quality 0
      ;;
    none)
      ;;
    *)
      err "Internal action error: $y_act"
      return 1
      ;;
  esac

  set -- "$@" "$INPUT"
  run_ytdlp "$@"
}

run_download() {
  selector=$1
  action=$2

  if ! ytdlp_attempt "$selector" "$action" ''; then
    recovered=0
    case "$action" in
      merge|none) fallback='bv*+ba/b/best' ;;
      *) fallback='ba/b/best' ;;
    esac

    if [ "$fallback" != "$selector" ]; then
      warn 'First attempt failed; retrying with any available format...'
      ytdlp_attempt "$fallback" "$action" '' && recovered=1
    fi

    if [ "$recovered" -eq 0 ] && detect_fb_impersonation >/dev/null 2>&1; then
      warn "Retrying once with browser impersonation ($FB_IMPERSONATE)..."
      ytdlp_attempt "$fallback" "$action" "$FB_IMPERSONATE" && recovered=1
    fi

    if [ "$recovered" -eq 0 ]; then
      err 'yt-dlp reported a download error.'
      say 'Most common fix: the site changed. Update yt-dlp, then retry:'
      say '  c --update'
      say 'Private/age-restricted posts may also need: c --cookies cookies.txt'
      return 1
    fi
  fi

  discover_completed_output || return 1
  move_to_downloads || return 1

  # V33: check/fix the sound of every video download.
  case "$action" in
    merge|none) sound_guard "$action" ;;
  esac
  record_history

  say ''
  say "DONE: $OUTPUT_FILE"
  return 0
}

show_exact_formats() {
  say ''
  say '[C] Actual formats reported by the site:'
  say '----------------------------------------'

  set -- -F --no-playlist --socket-timeout 30 --retries 3
  [ -z "$COOKIES" ] || set -- "$@" --cookies "$COOKIES"
  set -- "$@" "$INPUT"

  run_ytdlp "$@" || return 1

  say '----------------------------------------'
  printf 'Type format ID (example 18 or 137+140): '
  IFS= read -r fid || fid=''
  [ -n "$fid" ] || {
    err 'Empty format ID'
    return 1
  }

  choose_destination video
  say "[C] Downloading format: $fid"
  run_download "$fid" merge
}


make_photos_safe_copy() {
  [ -n "$OUTPUT_FILE" ] && [ -f "$OUTPUT_FILE" ] || {
    err 'No downloaded video was found for Photos preparation.'
    return 1
  }

  have ffmpeg || {
    err 'Photos SAFE needs ffmpeg in a-Shell.'
    return 1
  }

  base=${OUTPUT_FILE##*/}
  stem=${base%.*}
  PHOTOS_SAFE_FILE="$DOWNLOAD_DIR/PhotosSafe_${stem}.mp4"

  if [ -e "$PHOTOS_SAFE_FILE" ]; then
    stamp=$(date '+%Y%m%d_%H%M%S' 2>/dev/null || printf '%s' "$$")
    PHOTOS_SAFE_FILE="$DOWNLOAD_DIR/PhotosSafe_${stamp}_${stem}.mp4"
  fi

  tmp="$PHOTOS_SAFE_FILE.tmp.mp4"
  rm -f "$tmp" 2>/dev/null || true

  say ''
  say '[C] Checking export compatibility before Photos...'
  say '[C] Building Photos-safe MP4: H.264 + AAC + yuv420p + faststart'
  say '[C] Original downloaded file will be kept.'

  # First try iPhone hardware H.264. If the a-Shell build does not expose it,
  # fall back to libx264. No ffprobe is used in this path.
  if ffmpeg -y -hide_banner -loglevel error \
      -i "$OUTPUT_FILE" \
      -map 0:v:0 -map 0:a:0? \
      -sn -dn \
      -c:v h264_videotoolbox -pix_fmt yuv420p -b:v 6000k \
      -c:a aac -b:a 192k \
      -movflags +faststart \
      "$tmp"
  then
    :
  else
    rm -f "$tmp" 2>/dev/null || true
    say '[C] Hardware H.264 unavailable/failed; trying software H.264...'

    if ! ffmpeg -y -hide_banner -loglevel error \
        -i "$OUTPUT_FILE" \
        -map 0:v:0 -map 0:a:0? \
        -sn -dn \
        -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p \
        -c:a aac -b:a 192k \
        -movflags +faststart \
        "$tmp"
    then
      rm -f "$tmp" 2>/dev/null || true
      err 'Could not build a Photos-safe MP4.'
      return 1
    fi
  fi

  [ -s "$tmp" ] || {
    rm -f "$tmp" 2>/dev/null || true
    err 'Photos-safe output is empty.'
    return 1
  }

  # Independent sanity check: decode one video frame using ffmpeg.
  # We deliberately avoid ffprobe because that path stalled on-device before.
  if ! ffmpeg -hide_banner -loglevel error \
      -i "$tmp" \
      -map 0:v:0 -frames:v 1 \
      -f null /dev/null
  then
    rm -f "$tmp" 2>/dev/null || true
    err 'Photos-safe MP4 failed the decode sanity check.'
    return 1
  fi

  mv "$tmp" "$PHOTOS_SAFE_FILE" || {
    rm -f "$tmp" 2>/dev/null || true
    err 'Could not finalize the Photos-safe MP4.'
    return 1
  }

  say "[C] Photos-safe MP4 ready: $PHOTOS_SAFE_FILE"
  return 0
}

open_exact_video_for_photos() {
  [ -n "$PHOTOS_SAFE_FILE" ] && [ -f "$PHOTOS_SAFE_FILE" ] || return 1

  say ''
  say '[C] Opening the Photos-safe MP4...'
  say '[C] In the iOS panel choose: Save Video.'

  if have open; then
    open "$PHOTOS_SAFE_FILE" >/dev/null 2>&1 && return 0
  fi

  if have view; then
    view "$PHOTOS_SAFE_FILE" >/dev/null 2>&1 && return 0
  fi

  err 'Could not open the Photos-safe video automatically.'
  return 1
}

finish() {
  case "$SAVE_MODE" in
    photos)
      if make_photos_safe_copy; then
        open_exact_video_for_photos || {
          say 'Open this Photos-safe file manually from Files, then Share -> Save Video:'
          say "$PHOTOS_SAFE_FILE"
        }
      else
        err 'Photos SAFE preparation failed.'
        say 'Original download was preserved here:'
        say "$OUTPUT_FILE"
        return 1
      fi
      ;;
    files)
      say "Saved in Files: $OUTPUT_FILE"
      if [ -n "$EXTRA_SAFE_FILE" ] && [ -f "$EXTRA_SAFE_FILE" ]; then
        say "iPhone-safe H.264 copy: $EXTRA_SAFE_FILE"
      fi
      ;;
  esac
}

# =====================================================================
# V32 AUDIO LAB — separate VOICE and MUSIC from any video/audio
#   Offline engines (run on the iPhone, no internet after model fetch):
#     VOICE : center(mid) extraction + speech band + RNNoise (arnndn)
#             neural speech model + FFT denoise + loudness normalize
#     MUSIC : phase-cancel karaoke (removes centered vocals) while
#             restoring the bass/kick from the mid channel
#   Cloud engine (studio quality, optional):
#     AI STEMS : Demucs (htdemucs) on Replicate — needs your API token
# All work happens in a unique job folder; the source file is never touched.
# =====================================================================

LAB_DIR_NAME='Audio_Lab'
LAB_FMT='m4a'          # m4a | mp3 | wav
LAB_STRENGTH=1         # 1 normal, 2 strong (double neural pass)
LAB_SRC=''             # local media file being processed
LAB_JOB=''
LAB_WAV=''
LAB_STEREO=0           # 1 = real stereo (side channel has content)
LAB_STEM=''
LAB_OUTS=''            # newline list of produced files
FILTER_CACHE=''
RNN_MODEL=${CINEMA_RNN_MODEL:-lq}   # lq = voice vs general noise (best for music beds)
REPLICATE_MODEL='ryan5453/demucs'
REPLICATE_FALLBACK_VERSION='5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77'
REPLICATE_TOKEN_FILE="$HOME_DIR/Documents/replicate_token.txt"

lab_ff() {
  # ffmpeg with errors captured to a FILE (no pipes: proven safer on a-Shell)
  ffmpeg -y -nostdin -hide_banner -loglevel error "$@" 2> "$STATE_DIR/last_lab_ffmpeg.txt"
  rc=$?
  if [ "$rc" -ne 0 ] && [ -s "$STATE_DIR/last_lab_ffmpeg.txt" ]; then
    say '[LAB] ffmpeg said:'
    tail -n 8 "$STATE_DIR/last_lab_ffmpeg.txt" 2>/dev/null || true
  fi
  return "$rc"
}

has_filter() {
  have ffmpeg || return 1
  if [ -z "$FILTER_CACHE" ] || [ ! -s "$FILTER_CACHE" ]; then
    mkdir -p "$STATE_DIR" 2>/dev/null || true
    FILTER_CACHE="$STATE_DIR/ffmpeg_filters.txt"
    ffmpeg -hide_banner -filters > "$FILTER_CACHE" 2>/dev/null || return 1
  fi
  grep -Eq "[[:space:]]$1[[:space:]]" "$FILTER_CACHE"
}

rnn_model_path() {
  printf '%s' "$STATE_DIR/models/$RNN_MODEL.rnnn"
}

ensure_rnn_model() {
  m=$(rnn_model_path)
  [ -s "$m" ] && return 0
  have curl || return 1
  mkdir -p "$STATE_DIR/models" || return 1
  say "[LAB] Downloading neural voice model ($RNN_MODEL.rnnn, one time only)..."
  for u in \
    "https://raw.githubusercontent.com/richardpl/arnndn-models/master/$RNN_MODEL.rnnn" \
    "https://github.com/richardpl/arnndn-models/raw/master/$RNN_MODEL.rnnn"
  do
    if curl -L --fail --silent --show-error --connect-timeout 15 --max-time 120 \
        -o "$m.tmp" "$u" 2>/dev/null && [ -s "$m.tmp" ]; then
      mv "$m.tmp" "$m" && return 0
    fi
    rm -f "$m.tmp" 2>/dev/null || true
  done
  return 1
}

lab_new_job() {
  mkdir -p "$STATE_DIR" || return 1
  stamp=$(date '+%Y%m%d_%H%M%S' 2>/dev/null || printf 'lab')
  LAB_JOB="$STATE_DIR/lab_${stamp}_$$"
  mkdir -p "$LAB_JOB" || return 1
  LAB_OUTS=''
}

lab_cleanup() {
  [ -n "$LAB_JOB" ] && [ -d "$LAB_JOB" ] && rm -rf "$LAB_JOB" 2>/dev/null
  LAB_JOB=''
  return 0
}

lab_out_dir() {
  d="$DOWNLOAD_DIR/$LAB_DIR_NAME"
  mkdir -p "$d" || return 1
  printf '%s' "$d"
}

lab_unique() {
  # $1 = desired path ; prints a non-existing path
  p=$1
  if [ ! -e "$p" ]; then printf '%s' "$p"; return; fi
  stem=${p%.*}; ext=${p##*.}
  stamp=$(date '+%H%M%S' 2>/dev/null || printf '%s' "$$")
  printf '%s' "${stem}_${stamp}.${ext}"
}

lab_add_out() {
  LAB_OUTS="${LAB_OUTS}$1
"
}

# Decode the first audio stream to a clean 48 kHz PCM WAV and classify it.
lab_prepare() {
  src=$1
  [ -f "$src" ] || { err "File not found: $src"; return 1; }
  have ffmpeg || { err 'Audio Lab needs ffmpeg in a-Shell.'; return 1; }

  base=${src##*/}
  LAB_STEM=${base%.*}
  LAB_STEM=$(printf '%s' "$LAB_STEM" | sed 's/^PhotosSafe_//; s/^Cinema_[0-9]*_[0-9]*_//; s/[\/:*?"<>|]/_/g')
  LAB_WAV="$LAB_JOB/source.wav"

  say '[LAB] Decoding audio...'
  lab_ff -i "$src" -vn -sn -dn -map 0:a:0 -ar 48000 -c:a pcm_s16le "$LAB_WAV" || {
    err 'This file has no readable audio track.'
    return 1
  }

  info="$LAB_JOB/info.txt"
  ffmpeg -nostdin -hide_banner -i "$LAB_WAV" > /dev/null 2> "$info" || true
  LAB_STEREO=0
  if grep -Eq 'Audio:.*(mono|1 channels)' "$info" 2>/dev/null; then
    say '[LAB] Source is MONO.'
    return 0
  fi

  # Real stereo or "fake stereo" (identical L/R)? Measure the side channel.
  side="$LAB_JOB/side.txt"
  ffmpeg -nostdin -hide_banner -i "$LAB_WAV" -af 'pan=mono|c0=c0-c1,volumedetect' \
    -f null "$LAB_JOB/.null" > /dev/null 2> "$side" || true
  mv_db=$(sed -n 's/.*max_volume: *\(-*[0-9.inf]*\) dB.*/\1/p' "$side" | sed -n '1p')
  mv_int=${mv_db%%.*}
  case "$mv_int" in
    ''|*inf*) LAB_STEREO=0 ;;
    *) if [ "$mv_int" -gt -45 ] 2>/dev/null; then LAB_STEREO=1; fi ;;
  esac
  if [ "$LAB_STEREO" -eq 1 ]; then
    say "[LAB] Real stereo detected (side peak ${mv_db} dB)."
  else
    say '[LAB] Stereo channels are identical (mono content).'
  fi
  return 0
}

lab_encode() {
  # $1 = wav in ; $2 = output path WITHOUT extension ; prints final path via LAB_LAST
  in=$1; outbase=$2
  case "$LAB_FMT" in
    mp3) out=$(lab_unique "$outbase.mp3"); set -- -c:a libmp3lame -q:a 0 ;;
    wav) out=$(lab_unique "$outbase.wav"); set -- -c:a pcm_s16le ;;
    *)   out=$(lab_unique "$outbase.m4a"); set -- -c:a aac -b:a 256k -movflags +faststart ;;
  esac
  lab_ff -i "$in" -ac 2 "$@" "$out" || return 1
  LAB_LAST=$out
  lab_add_out "$out"
  return 0
}

lab_voice_wav() {
  # Produces $LAB_JOB/voice.wav
  chain=''
  [ "$LAB_STEREO" -eq 1 ] && chain='pan=mono|c0=0.5*c0+0.5*c1,'
  chain="${chain}highpass=f=80,lowpass=f=8000"

  neural=0
  if has_filter arnndn && ensure_rnn_model; then
    m=$(rnn_model_path)
    chain="$chain,arnndn=m='$m'"
    [ "$LAB_STRENGTH" -ge 2 ] && chain="$chain,arnndn=m='$m'"
    neural=1
  fi
  if has_filter afftdn; then
    if [ "$neural" -eq 1 ]; then chain="$chain,afftdn=nf=-30"
    else chain="$chain,afftdn=nr=24:nf=-28"; fi
  fi
  chain="$chain,dynaudnorm=f=200:g=11,alimiter=limit=0.95"

  if [ "$neural" -eq 1 ]; then
    say "[LAB] VOICE: neural speech isolation (RNNoise/$RNN_MODEL, strength $LAB_STRENGTH)..."
  else
    warn 'Neural model unavailable; using basic FFT voice filter (lower quality).'
  fi
  lab_ff -i "$LAB_WAV" -af "$chain" -ar 48000 -c:a pcm_s16le "$LAB_JOB/voice.wav"
}

lab_music_wav() {
  # Produces $LAB_JOB/music.wav (vocals removed). Needs real stereo.
  if [ "$LAB_STEREO" -ne 1 ]; then
    err 'MUSIC-only offline mode needs a real stereo mix.'
    say 'This source is mono, so vocals and music cannot be split by phase.'
    say 'Use option 6 (AI STEMS) for this file.'
    return 2
  fi
  say '[LAB] MUSIC: removing centered vocals, restoring bass...'
  fc='[0:a]asplit=2[a][b];'
  fc="$fc[a]pan=stereo|c0=c0-c1|c1=c1-c0,highpass=f=140[s];"
  fc="$fc[b]pan=mono|c0=0.5*c0+0.5*c1,lowpass=f=140,pan=stereo|c0=c0|c1=c0[l];"
  fc="$fc[s][l]amerge=inputs=2,pan=stereo|c0=c0+c2|c1=c1+c3,alimiter=limit=0.95[out]"
  lab_ff -i "$LAB_WAV" -filter_complex "$fc" -map '[out]' -ar 48000 -c:a pcm_s16le "$LAB_JOB/music.wav"
}

lab_mux_video() {
  # $1 = video source ; $2 = processed wav ; $3 = label
  vsrc=$1; wav=$2; label=$3
  od=$(lab_out_dir) || return 1
  out=$(lab_unique "$od/$LAB_STEM - $label.mp4")
  say "[LAB] Building video: $label ..."
  lab_ff -i "$vsrc" -i "$wav" -map 0:v:0 -map 1:a:0 -c:v copy \
    -c:a aac -b:a 192k -ac 2 -shortest -movflags +faststart "$out" || {
      rm -f "$out" 2>/dev/null || true
      say '[LAB] Video copy failed; re-encoding video to H.264...'
      lab_ff -i "$vsrc" -i "$wav" -map 0:v:0 -map 1:a:0 \
        -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p \
        -c:a aac -b:a 192k -ac 2 -shortest -movflags +faststart "$out" || return 1
    }
  LAB_LAST=$out
  lab_add_out "$out"
}

has_video_stream() {
  ffmpeg -nostdin -hide_banner -i "$1" > /dev/null 2> "$STATE_DIR/.vinfo.txt" || true
  grep -q 'Video:' "$STATE_DIR/.vinfo.txt" 2>/dev/null && ! grep -q 'Video:.*attached pic' "$STATE_DIR/.vinfo.txt" 2>/dev/null
}

# ---------------- AI STEMS (Replicate / Demucs) ----------------

json_str() {
  # $1 key ; $2 file -> first "key":"value"
  tr -d '\n' < "$2" | grep -o "\"$1\" *: *\"[^\"]*\"" | sed -n '1s/.*: *"\(.*\)"$/\1/p'
}

replicate_token() {
  if [ -n "${REPLICATE_API_TOKEN:-}" ]; then printf '%s' "$REPLICATE_API_TOKEN"; return 0; fi
  [ -s "$REPLICATE_TOKEN_FILE" ] || return 1
  t=''
  IFS= read -r t < "$REPLICATE_TOKEN_FILE" || true
  t=$(printf '%s' "$t" | tr -d '\r\n ')
  [ -n "$t" ] || return 1
  printf '%s' "$t"
}

setup_ai() {
  say 'AI STEMS setup (Demucs on Replicate)'
  say '------------------------------------'
  say 'Gives studio-grade separation: pure vocals + pure music (no vocals).'
  say 'Works for songs, nasheeds, mono files — things offline mode cannot split.'
  say 'Cost: pay-per-use on replicate.com (usually cents per song).'
  say ''
  say '1) Create an account at https://replicate.com'
  say '2) Account -> API tokens -> copy your token (starts with r8_)'
  say ''
  printf 'Paste token now (or Enter to skip): '
  IFS= read -r tok || tok=''
  tok=$(printf '%s' "$tok" | tr -d '\r\n ')
  if [ -n "$tok" ]; then
    printf '%s\n' "$tok" > "$REPLICATE_TOKEN_FILE" && chmod 600 "$REPLICATE_TOKEN_FILE" 2>/dev/null
    say "Saved: $REPLICATE_TOKEN_FILE"
    say 'SECURITY: this token can spend your Replicate credit. Do not share it.'
  else
    say "Later: put the token alone in $REPLICATE_TOKEN_FILE"
  fi
}

lab_ai_stems() {
  have curl || { err 'AI STEMS needs curl.'; return 1; }
  tok=$(replicate_token) || {
    err 'No Replicate token yet.'
    say 'Run once: c --setup-ai'
    return 1
  }
  auth="Authorization: Bearer $tok"
  api='https://api.replicate.com/v1'

  say '[AI] Compressing audio for upload...'
  up="$LAB_JOB/upload.mp3"
  lab_ff -i "$LAB_WAV" -ac 2 -c:a libmp3lame -b:a 256k "$up" || return 1

  say '[AI] Uploading...'
  r="$LAB_JOB/file.json"
  curl -sS --fail --connect-timeout 20 --max-time 600 -X POST -H "$auth" \
    -F "content=@$up;type=audio/mpeg" "$api/files" -o "$r" || {
      err 'Upload failed (check token / internet).'
      return 1
    }
  furl=$(tr -d '\n' < "$r" | grep -o '"get" *: *"[^"]*"' | sed -n '1s/.*: *"\(.*\)"$/\1/p')
  [ -n "$furl" ] || { err 'Upload response had no file URL.'; cat "$r"; return 1; }

  ver=$REPLICATE_FALLBACK_VERSION
  m="$LAB_JOB/model.json"
  if curl -sS --fail --connect-timeout 15 --max-time 30 -H "$auth" "$api/models/$REPLICATE_MODEL" -o "$m" 2>/dev/null; then
    v=$(tr -d '\n' < "$m" | grep -o '"latest_version" *: *{ *"id" *: *"[0-9a-f]*"' | sed -n '1s/.*"\([0-9a-f]*\)"$/\1/p')
    [ -n "$v" ] && ver=$v
  fi

  say '[AI] Separating with Demucs (htdemucs)... this can take 1-3 minutes.'
  body="{\"version\":\"$ver\",\"input\":{\"audio\":\"$furl\",\"stem\":\"vocals\",\"output_format\":\"mp3\",\"mp3_bitrate\":320}}"
  p="$LAB_JOB/pred.json"
  curl -sS --fail --connect-timeout 20 --max-time 90 -X POST -H "$auth" \
    -H 'Content-Type: application/json' -H 'Prefer: wait=60' \
    -d "$body" "$api/predictions" -o "$p" || { err 'Could not start AI job.'; cat "$p" 2>/dev/null; return 1; }

  pid=$(json_str id "$p")
  status=$(json_str status "$p")
  tries=0
  while [ "$status" != 'succeeded' ]; do
    case "$status" in
      failed|canceled)
        err "AI job $status."
        json_str error "$p"
        return 1
        ;;
    esac
    tries=$((tries + 1))
    [ "$tries" -le 120 ] || { err 'AI job timed out (10 min).'; return 1; }
    say "[AI] status: ${status:-starting} ..."
    sleep 5
    curl -sS --fail --connect-timeout 15 --max-time 30 -H "$auth" "$api/predictions/$pid" -o "$p" || true
    status=$(json_str status "$p")
  done

  od=$(lab_out_dir) || return 1
  # Output is an object: {"vocals": "https://...", "no_vocals": "https://...", ...}
  pairs="$LAB_JOB/pairs.txt"
  tr -d '\n' < "$p" | sed 's/.*"output" *: *{\([^}]*\)}.*/\1/' | \
    grep -o '"[a-z_]*" *: *"https://[^"]*"' > "$pairs" 2>/dev/null || true
  [ -s "$pairs" ] || { err 'AI finished but returned no stems.'; return 1; }

  got=0
  npairs=$(wc -l < "$pairs" | tr -d ' ')
  i=0
  while [ "$i" -lt "$npairs" ]; do
    i=$((i + 1))
    line=$(sed -n "${i}p" "$pairs")
    key=$(printf '%s' "$line" | sed -n 's/^"\([a-z_]*\)".*/\1/p')
    url=$(printf '%s' "$line" | sed -n 's/.*"\(https:[^"]*\)"$/\1/p')
    [ -n "$key" ] && [ -n "$url" ] || continue
    case "$key" in
      vocals) label='AI_VOICE' ;;
      no_vocals) label='AI_MUSIC' ;;
      *) label="AI_$(printf '%s' "$key" | tr 'a-z' 'A-Z')" ;;
    esac
    tmp="$LAB_JOB/$key.mp3"
    say "[AI] Downloading $label ..."
    curl -sS -L --fail --connect-timeout 20 --max-time 600 -o "$tmp" "$url" || continue
    lab_encode "$tmp" "$od/$LAB_STEM - $label" && got=$((got + 1))
    [ "$key" = 'vocals' ] && cp "$tmp" "$LAB_JOB/voice_ai.mp3" 2>/dev/null
    [ "$key" = 'no_vocals' ] && cp "$tmp" "$LAB_JOB/music_ai.mp3" 2>/dev/null
  done
  [ "$got" -gt 0 ]
}

# ---------------- menus / flows ----------------

lab_menu() {
  say ''
  say 'AUDIO LAB — what do you want?'
  say '----------------------------------------'
  say ' 1) VOICE only   — clean speech, music removed'
  say ' 2) MUSIC only   — vocals removed (karaoke)'
  say ' 3) BOTH         — voice file + music file'
  say ' 4) VIDEO + voice only  (music muted in video)'
  say ' 5) VIDEO + music only  (voice muted in video)'
  say ' 6) AI STEMS     — studio quality (Demucs, online)'
  say ' 7) Original audio only (no processing)'
  say ' 0) Cancel'
  say '----------------------------------------'
  say 'Offline 1-5 are best for speech over background music.'
  say 'For songs/singing or mono files, choose 6.'
  printf 'Number: '
  IFS= read -r LAB_MODE || LAB_MODE=''
  case "$LAB_MODE" in
    0) return 1 ;;
    1|2|3|4|5|6|7) ;;
    *) err 'Wrong number.'; return 1 ;;
  esac

  case "$LAB_MODE" in
    1|3|4)
      say ''
      say 'Voice strength:'
      say ' 1) Normal (natural voice)'
      say ' 2) Strong (more music removed, voice may sound thinner)'
      printf 'Number [1]: '
      IFS= read -r s || s=''
      [ "$s" = '2' ] && LAB_STRENGTH=2
      ;;
  esac

  case "$LAB_MODE" in
    4|5) ;;
    *)
      say ''
      say 'Audio format:'
      say ' 1) M4A (iPhone, default)   2) MP3   3) WAV (lossless)'
      printf 'Number [1]: '
      IFS= read -r f || f=''
      case "$f" in 2) LAB_FMT='mp3' ;; 3) LAB_FMT='wav' ;; *) LAB_FMT='m4a' ;; esac
      ;;
  esac
  return 0
}

lab_needs_video() {
  case "$LAB_MODE" in 4|5) return 0 ;; esac
  return 1
}

lab_process() {
  # $1 = local media file
  LAB_SRC=$1
  lab_new_job || { err 'Cannot create lab job folder.'; return 1; }
  lab_prepare "$LAB_SRC" || { lab_cleanup; return 1; }
  od=$(lab_out_dir) || { lab_cleanup; return 1; }
  rc=0

  case "$LAB_MODE" in
    1)
      lab_voice_wav && lab_encode "$LAB_JOB/voice.wav" "$od/$LAB_STEM - VOICE" || rc=1
      ;;
    2)
      lab_music_wav && lab_encode "$LAB_JOB/music.wav" "$od/$LAB_STEM - MUSIC" || rc=1
      ;;
    3)
      lab_voice_wav && lab_encode "$LAB_JOB/voice.wav" "$od/$LAB_STEM - VOICE" || rc=1
      if lab_music_wav; then
        lab_encode "$LAB_JOB/music.wav" "$od/$LAB_STEM - MUSIC" || rc=1
      fi
      ;;
    4|5)
      if ! has_video_stream "$LAB_SRC"; then
        err 'This file has no video track. Choose 1-3 instead.'
        rc=1
      elif [ "$LAB_MODE" -eq 4 ]; then
        lab_voice_wav && lab_mux_video "$LAB_SRC" "$LAB_JOB/voice.wav" 'VIDEO_VOICE' || rc=1
      else
        lab_music_wav && lab_mux_video "$LAB_SRC" "$LAB_JOB/music.wav" 'VIDEO_MUSIC' || rc=1
      fi
      ;;
    6)
      lab_ai_stems || rc=1
      ;;
    7)
      lab_encode "$LAB_WAV" "$od/$LAB_STEM - ORIGINAL" || rc=1
      ;;
  esac

  lab_cleanup
  say ''
  if [ -n "$LAB_OUTS" ]; then
    say '========================================'
    say '[LAB] Ready:'
    printf '%s' "$LAB_OUTS" | sed '/^$/d; s/^/  /'
    say "[LAB] Folder: $od"
    say '========================================'
  fi
  [ "$rc" -eq 0 ] || return 1

  # A processed VIDEO can go through the proven Photos SAFE flow.
  if lab_needs_video && [ -n "${LAB_LAST:-}" ] && [ -f "$LAB_LAST" ]; then
    OUTPUT_FILE=$LAB_LAST
    choose_destination video
    finish
    return $?
  fi
  if have open && [ -n "${LAB_LAST:-}" ] && [ -f "$LAB_LAST" ]; then
    open "$LAB_LAST" >/dev/null 2>&1 || true
  fi
  return 0
}

lab_pick_local() {
  # Interactive picker over media in Cinema_Downloads.
  # a-Shell note: never use `while read ... < file` here — in a-Shell that
  # read can fall back to the KEYBOARD. Plain for-loops + sed only.
  list="$STATE_DIR/lab_pick.txt"
  mkdir -p "$STATE_DIR" "$DOWNLOAD_DIR" 2>/dev/null || true
  : > "$list"
  say ''
  say 'Pick a file from Cinema_Downloads:'
  say '----------------------------------------'
  n=0
  for f in "$DOWNLOAD_DIR"/* "$DOWNLOAD_DIR/$LAB_DIR_NAME"/*; do
    [ -f "$f" ] || continue
    case "$f" in
      *.mp4|*.MP4|*.m4v|*.mov|*.MOV|*.mkv|*.webm|*.m4a|*.M4A|*.mp3|*.MP3|*.wav|*.WAV|*.aac|*.opus|*.ogg|*.flac) ;;
      *) continue ;;
    esac
    n=$((n + 1))
    printf '%s\n' "$f" >> "$list"
    say "$(printf '%2d' "$n")) ${f##*/}"
  done
  [ "$n" -gt 0 ] || { err "No media files found in $DOWNLOAD_DIR"; return 1; }
  say ' 0) Cancel'
  say '----------------------------------------'
  printf 'Number: '
  IFS= read -r k || k=''
  case "$k" in ''|0|*[!0-9]*) return 1 ;; esac
  [ "$k" -le "$n" ] || { err 'Wrong number.'; return 1; }
  LAB_SRC=$(sed -n "${k}p" "$list")
  [ -n "$LAB_SRC" ] && [ -f "$LAB_SRC" ]
}

lab_local_flow() {
  # c --lab [FILE]
  have ffmpeg || { err 'Audio Lab needs ffmpeg in a-Shell.'; return 1; }
  if [ -n "$LAB_FILE" ]; then
    LAB_SRC=$LAB_FILE
    [ -f "$LAB_SRC" ] || [ ! -f "$DOWNLOAD_DIR/$LAB_SRC" ] || LAB_SRC="$DOWNLOAD_DIR/$LAB_SRC"
  else
    lab_pick_local || return 1
  fi
  [ -f "$LAB_SRC" ] || { err "File not found: $LAB_SRC"; return 1; }
  say "[LAB] File: ${LAB_SRC##*/}"
  lab_menu || return 0
  lab_process "$LAB_SRC"
}

lab_url_flow() {
  # menu option 11: URL -> download -> lab
  lab_menu || return 0
  if lab_needs_video; then
    say '[LAB] Downloading video (best iPhone-friendly MP4)...'
    run_download "$(best_selector)" merge || return 1
  else
    say '[LAB] Downloading best audio...'
    if have ffmpeg; then
      run_download 'bestaudio/best' m4a || return 1
    else
      run_download 'bestaudio[ext=m4a]/bestaudio' none || return 1
    fi
  fi
  lab_process "$OUTPUT_FILE"
}

lab_doctor() {
  say 'Cinema Audio Lab Doctor'
  say '-----------------------'
  if have ffmpeg; then say 'ffmpeg: OK'; else say 'ffmpeg: MISSING (Audio Lab disabled)'; return 1; fi
  for flt in arnndn afftdn dynaudnorm alimiter amerge pan volumedetect; do
    if has_filter "$flt"; then say "filter $flt: OK"; else say "filter $flt: missing"; fi
  done
  if [ -s "$(rnn_model_path)" ]; then say "voice model ($RNN_MODEL): installed"
  elif ensure_rnn_model; then say "voice model ($RNN_MODEL): downloaded now"
  else say "voice model ($RNN_MODEL): NOT available (basic filter fallback)"; fi
  if replicate_token >/dev/null 2>&1; then say 'AI STEMS token: set'; else say 'AI STEMS token: not set (c --setup-ai)'; fi
  if have curl; then say 'curl: OK'; else say 'curl: missing'; fi
  return 0
}

update_ytdlp() {
  say '[C] Updating yt-dlp...'
  if have pip; then pip install --upgrade yt-dlp && return 0; fi
  if have python3; then python3 -m pip install --upgrade yt-dlp && return 0; fi
  err 'pip not found. In a-Shell run: pip install --upgrade yt-dlp'
  return 1
}

# =====================================================================
# V33 PRO — helpers shared by every new feature
# =====================================================================

# Collect every http(s) link found in free text (a shared caption, a message
# with several links...). Appends new, unique links to URL_LIST.
add_urls_from_text() {
  au_found=$(printf '%s\n' "$1" | tr -d '\r' | grep -Eo 'https?://[^[:space:]"<>]+' 2>/dev/null || true)
  [ -n "$au_found" ] || return 1
  set -f
  for au_u in $au_found; do
    au_u=$(printf '%s' "$au_u" | sed 's/[.,;:!?)]*$//')
    [ -n "$au_u" ] || continue
    case "
$URL_LIST" in
      *"
$au_u
"*) continue ;;
    esac
    URL_LIST="${URL_LIST}$au_u
"
  done
  set +f
  return 0
}

url_count() {
  printf '%s' "$URL_LIST" | sed '/^$/d' | wc -l | tr -d ' '
}

url_at() {
  printf '%s' "$URL_LIST" | sed '/^$/d' | sed -n "$1p"
}

read_batch_lines() {
  say 'Paste links, one per line. Empty line = start.'
  say 'الصق الروابط (كل رابط في سطر) وبعدين سطر فاضي للبدء'
  while :; do
    IFS= read -r rb_line || break
    [ -n "$rb_line" ] || break
    add_urls_from_text "$rb_line" || warn "No link in: $rb_line"
  done
}

load_batch_file() {
  if [ ! -f "$BATCH_FILE" ] && [ -f "$HOME_DIR/Documents/$BATCH_FILE" ]; then
    BATCH_FILE="$HOME_DIR/Documents/$BATCH_FILE"
  fi
  [ -f "$BATCH_FILE" ] || { err "Links file not found: $BATCH_FILE"; exit 1; }
  add_urls_from_text "$(cat "$BATCH_FILE")" || { err 'No links found in the file.'; exit 1; }
  say "[C] Links loaded from file: $(url_count)"
}

# Turn a playlist/channel URL into a list of video links (fast, metadata only).
expand_playlist() {
  mkdir -p "$STATE_DIR" || return 1
  pl_file="$STATE_DIR/playlist_links.txt"
  say "[C] Reading playlist (max $PLAYLIST_MAX items)..."
  set -- --flat-playlist --yes-playlist --no-warnings --socket-timeout 30 \
    --playlist-end "$PLAYLIST_MAX" --print '%(webpage_url,url)s'
  [ -z "$COOKIES" ] || set -- "$@" --cookies "$COOKIES"
  run_ytdlp "$@" "$INPUT" > "$pl_file" 2> "$STATE_DIR/.playlist_err.txt" || {
    err 'Could not read the playlist.'
    tail -n 4 "$STATE_DIR/.playlist_err.txt" 2>/dev/null || true
    return 1
  }
  URL_LIST=''
  add_urls_from_text "$(cat "$pl_file")" || { err 'The playlist returned no video links.'; return 1; }
  INPUT=$(url_at 1)
  say "[C] Playlist videos found: $(url_count)"
}

# ---------------- media inspection (ffmpeg -i only; no ffprobe) ----------------

probe_media() {
  mkdir -p "$STATE_DIR" 2>/dev/null || true
  ffmpeg -nostdin -hide_banner -i "$1" > /dev/null 2> "$PROBE_FILE" || true
}

probe_has_video() {
  grep -q 'Video:' "$PROBE_FILE" 2>/dev/null || return 1
  # cover art inside MP3/M4A is not a real video track
  grep 'Video:' "$PROBE_FILE" 2>/dev/null | grep -vq 'attached pic'
}

probe_has_audio() {
  grep -q 'Audio:' "$PROBE_FILE" 2>/dev/null
}

probe_vcodec() {
  grep 'Video:' "$PROBE_FILE" 2>/dev/null | grep -v 'attached pic' | \
    sed -n 's/.*Video: \([A-Za-z0-9_]*\).*/\1/p' | sed -n '1p'
}

probe_he_aac() {
  grep -Eq 'Audio: aac \(HE' "$PROBE_FILE" 2>/dev/null
}

probe_duration_ms() {
  pd=$(sed -n 's/.*Duration: \([0-9:.]*\),.*/\1/p' "$PROBE_FILE" 2>/dev/null | sed -n '1p')
  [ -n "$pd" ] || return 1
  to_ms "$pd"
}

# Sets SS_STATE: ok | none | silent   (ffmpeg is never run inside $( ) on a-Shell)
sound_state() {
  SS_STATE=ok
  probe_media "$1"
  probe_has_audio || { SS_STATE=none; return 0; }
  ss_log="$STATE_DIR/.volume.txt"
  # first 5 minutes are enough to tell silence from sound, and stay fast on long videos
  ffmpeg -nostdin -hide_banner -i "$1" -map 0:a:0 -vn -t 300 -af volumedetect -f null /dev/null \
    > /dev/null 2> "$ss_log" || true
  ss_peak=$(sed -n 's/.*max_volume: *\(-*[0-9inf]*\).*/\1/p' "$ss_log" | sed -n '1p')
  case "$ss_peak" in
    ''|*inf*) SS_STATE=silent; return 0 ;;
  esac
  if [ "$ss_peak" -le -60 ] 2>/dev/null; then
    SS_STATE=silent
  fi
  return 0
}

# Number helpers. Pure shell: no awk/bc dependency.
strip0() {
  s0=$1
  while :; do
    case "$s0" in 0?*) s0=${s0#0} ;; *) break ;; esac
  done
  printf '%s' "${s0:-0}"
}

# [[H:]M:]S[.fff] -> milliseconds
to_ms() {
  tm=$1
  case "$tm" in ''|*[!0-9:.]*|*.*.*|:*|*:) return 1 ;; esac
  tm_frac=0
  case "$tm" in
    *.*)
      tm_f=${tm#*.}
      tm=${tm%.*}
      tm_f="${tm_f}000"
      tm_f=${tm_f%"${tm_f#???}"}
      tm_frac=$(strip0 "$tm_f")
      ;;
  esac
  tm_old_ifs=$IFS
  IFS=:
  set -f
  set -- $tm
  set +f
  IFS=$tm_old_ifs
  [ "$#" -ge 1 ] && [ "$#" -le 3 ] || return 1
  tm_total=0
  for tm_part in "$@"; do
    tm_part=$(strip0 "$tm_part")
    tm_total=$((tm_total * 60 + tm_part))
  done
  printf '%s' $((tm_total * 1000 + tm_frac))
}

ms_to_s() {
  printf '%d.%03d' $(($1 / 1000)) $(($1 % 1000))
}

file_bytes() {
  wc -c < "$1" 2>/dev/null | tr -d ' '
}

# ---------------- SOUND GUARD ----------------
# Runs after every successful video download.
#  1) no audio / silent audio -> one retry with a format that carries sound
#  2) H.264 + HE-AAC (TikTok)  -> audio converted to AAC-LC, video untouched
#  3) HEVC/VP9/AV1 in Files mode -> extra iPhone-safe H.264 copy

fix_he_aac_in_place() {
  # $1 = video codec name (from probe_vcodec)
  hf_vc=${1:-}
  case "$OUTPUT_FILE" in
    *.mp4|*.MP4|*.m4v|*.M4V|*.mov|*.MOV) ;;
    *) return 1 ;;
  esac
  hf_tmp="${OUTPUT_FILE%.*}.soundfix.tmp.mp4"
  rm -f "$hf_tmp" 2>/dev/null || true
  set --
  # iOS only plays HEVC in MP4 when it is tagged hvc1
  [ "$hf_vc" != 'hevc' ] || set -- -tag:v hvc1
  if ffmpeg -y -nostdin -hide_banner -loglevel error -i "$OUTPUT_FILE" \
      -map 0:v:0 -map 0:a:0 -c:v copy "$@" -c:a aac -b:a 192k -ac 2 \
      -movflags +faststart "$hf_tmp" 2> "$STATE_DIR/last_soundfix.txt" && [ -s "$hf_tmp" ]; then
    mv "$hf_tmp" "$OUTPUT_FILE" && return 0
  fi
  rm -f "$hf_tmp" 2>/dev/null || true
  return 1
}

sound_guard() {
  sg_action=$1
  EXTRA_SAFE_FILE=''
  [ "$SOUND_GUARD" -eq 1 ] || return 0
  have ffmpeg || return 0

  probe_media "$OUTPUT_FILE"
  probe_has_video || return 0

  sound_state "$OUTPUT_FILE"
  sg_state=$SS_STATE
  if [ "$sg_state" != 'ok' ]; then
    if [ "$sg_state" = 'none' ]; then
      warn 'SOUND GUARD: this video has NO audio track.'
    else
      warn 'SOUND GUARD: this video has a SILENT audio track.'
    fi
    say '[C] Retrying once with a format that carries sound...'
    sg_bad="$STATE_DIR/soundguard_first_$$.${OUTPUT_FILE##*.}"
    mv "$OUTPUT_FILE" "$sg_bad" 2>/dev/null || sg_bad=$OUTPUT_FILE
    sg_first_name=$OUTPUT_FILE
    if ytdlp_attempt 'b[acodec!=none][vcodec!=none]/bv*+ba[acodec!=none]/b' "$sg_action" '' \
        && discover_completed_output && move_to_downloads; then
      sound_state "$OUTPUT_FILE"
      if [ "$SS_STATE" = 'ok' ]; then
        rm -f "$sg_bad" 2>/dev/null || true
        say '[C] SOUND GUARD: fixed — the new file has sound.'
      else
        rm -f "$OUTPUT_FILE" 2>/dev/null || true
        mv "$sg_bad" "$sg_first_name" 2>/dev/null || true
        OUTPUT_FILE=$sg_first_name
        warn 'SOUND GUARD: every format is silent — the post itself has no sound.'
      fi
    else
      mv "$sg_bad" "$sg_first_name" 2>/dev/null || true
      OUTPUT_FILE=$sg_first_name
      warn 'SOUND GUARD: retry failed; keeping the first file.'
    fi
    probe_media "$OUTPUT_FILE"
  fi

  sg_vc=$(probe_vcodec)
  if probe_he_aac; then
    say '[C] SOUND GUARD: HE-AAC audio found (plays silent in some apps).'
    if fix_he_aac_in_place "$sg_vc"; then
      say '[C] SOUND GUARD: audio converted to AAC-LC (video untouched).'
    else
      warn 'SOUND GUARD: audio conversion failed; original kept.'
    fi
  fi

  case "$sg_vc" in
    h264|'') return 0 ;;
  esac

  if [ "$SAVE_MODE" = 'files' ]; then
    say "[C] SOUND GUARD: video codec is $sg_vc (not iPhone-friendly everywhere)."
    say '[C] Building an extra iPhone-safe H.264 copy; the original is kept.'
    if make_photos_safe_copy; then
      EXTRA_SAFE_FILE=$PHOTOS_SAFE_FILE
    fi
  fi
  return 0
}

# ---------------- history ----------------

record_history() {
  mkdir -p "$STATE_DIR" 2>/dev/null || return 0
  rh_when=$(date '+%Y-%m-%d %H:%M' 2>/dev/null || printf '-')
  printf '%s | %s | %s\n' "$rh_when" "$INPUT" "${OUTPUT_FILE##*/}" >> "$HISTORY_FILE" 2>/dev/null || true
}

show_history() {
  if [ ! -s "$HISTORY_FILE" ]; then
    say 'No downloads in history yet. / لا يوجد سجل بعد'
    return 0
  fi
  say 'Last downloads / آخر التحميلات:'
  say '----------------------------------------'
  tail -n 20 "$HISTORY_FILE"
  say '----------------------------------------'
  say 'Repeat the last one: c --again'
}

load_last_url() {
  [ -s "$HISTORY_FILE" ] || { err 'No history yet.'; return 1; }
  ll_url=$(tail -n 1 "$HISTORY_FILE" | sed -n 's/^[^|]*| \(http[^ ]*\) |.*/\1/p')
  [ -n "$ll_url" ] || { err 'Could not read the last link from history.'; return 1; }
  say "[C] Last link: $ll_url"
  add_urls_from_text "$ll_url"
}

# ---------------- batch ----------------

batch_flow() {
  bt_total=$(url_count)
  say ''
  say "[C] BATCH: $bt_total links / عدد الروابط: $bt_total"
  say 'Quality for ALL links / الجودة لكل الروابط:'
  say '----------------------------------------'
  say ' 1) BEST quality        — أفضل جودة'
  say ' 2) 1080p or lower'
  say ' 3) 720p or lower'
  say ' 4) 480p or lower       — حجم صغير'
  say ' 5) AUDIO — M4A         — صوت فقط'
  say ' 6) AUDIO — MP3         — صوت MP3'
  say ' 0) Cancel'
  say '----------------------------------------'
  printf 'Number: '
  IFS= read -r bq || bq=''
  bt_kind=video
  case "$bq" in
    0) return 0 ;;
    1) bt_sel=$(best_selector); bt_act=merge ;;
    2) bt_sel=$(selector_for_height 1080); bt_act=merge ;;
    3) bt_sel=$(selector_for_height 720); bt_act=merge ;;
    4) bt_sel=$(selector_for_height 480); bt_act=merge ;;
    5) bt_kind=audio
       if have ffmpeg; then bt_sel='bestaudio/best'; bt_act=m4a
       else bt_sel='bestaudio[ext=m4a]/bestaudio'; bt_act=none; fi ;;
    6) bt_kind=audio; bt_sel='bestaudio/best'; bt_act=mp3 ;;
    *) err 'Wrong number.'; return 1 ;;
  esac

  bt_safe=0
  if [ "$bt_kind" = video ] && have ffmpeg; then
    printf 'Also build Photos-safe copies? / نسخ آمنة للصور؟ [y/N]: '
    IFS= read -r yn || yn=''
    case "$yn" in y|Y|yes|YES) bt_safe=1 ;; esac
  fi
  SAVE_MODE='files'

  bt_ok=0
  bt_fail=0
  bt_failed="$STATE_DIR/failed_links.txt"
  : > "$bt_failed"
  bt_i=0
  while [ "$bt_i" -lt "$bt_total" ]; do
    bt_i=$((bt_i + 1))
    INPUT=$(url_at "$bt_i")
    [ -n "$INPUT" ] || continue
    say ''
    say "========== [$bt_i/$bt_total] =========="
    say "$INPUT"
    if run_download "$bt_sel" "$bt_act"; then
      bt_ok=$((bt_ok + 1))
      if [ "$bt_safe" -eq 1 ] && [ -z "$EXTRA_SAFE_FILE" ]; then
        make_photos_safe_copy || warn 'Photos-safe copy failed for this one.'
      fi
    else
      bt_fail=$((bt_fail + 1))
      printf '%s\n' "$INPUT" >> "$bt_failed"
    fi
  done

  say ''
  say '========================================'
  say '[C] Batch finished / انتهى التحميل الجماعي'
  say "[C] Downloaded: $bt_ok"
  say "[C] Failed: $bt_fail"
  say "[C] Folder: $DOWNLOAD_DIR"
  if [ "$bt_fail" -gt 0 ]; then
    say "[C] Failed links saved: $bt_failed"
    say "[C] Retry them later: c --batch \"$bt_failed\""
  fi
  say '========================================'
  [ "$bt_ok" -gt 0 ]
}

# ---------------- thumbnail / subtitles / info ----------------

download_thumbnail() {
  new_work_dir
  set -- --skip-download --write-thumbnail --no-playlist --no-warnings \
    --socket-timeout 30 -o "$WORK_DIR/%(title).120B [%(id)s].%(ext)s"
  have ffmpeg && set -- "$@" --convert-thumbnails jpg
  [ -z "$COOKIES" ] || set -- "$@" --cookies "$COOKIES"
  run_ytdlp "$@" "$INPUT" || { err 'Could not get the thumbnail.'; return 1; }
  th_found=''
  for f in "$WORK_DIR"/*; do
    case "$f" in *.jpg|*.jpeg|*.png|*.webp) th_found=$f ;; esac
  done
  [ -n "$th_found" ] || { err 'This site gave no thumbnail.'; return 1; }
  th_dest="$DOWNLOAD_DIR/${th_found##*/}"
  [ ! -e "$th_dest" ] || th_dest="$DOWNLOAD_DIR/$(date '+%H%M%S')_${th_found##*/}"
  mv "$th_found" "$th_dest" || return 1
  OUTPUT_FILE=$th_dest
  record_history
  say ''
  say "DONE: $th_dest"
  if have open; then
    say '[C] Opening the image — choose Save Image to put it in Photos.'
    open "$th_dest" >/dev/null 2>&1 || true
  fi
  return 0
}

download_subtitles() {
  say ''
  say 'Subtitle language / لغة الترجمة:'
  say ' 1) Arabic  — عربي'
  say ' 2) English — إنجليزي'
  say ' 3) Arabic + English'
  say ' 4) Every language available'
  say ' 0) Cancel'
  printf 'Number [1]: '
  IFS= read -r sl || sl=''
  case "$sl" in
    0) return 0 ;;
    2) langs='en.*,en' ;;
    3) langs='ar.*,ar,en.*,en' ;;
    4) langs='all' ;;
    *) langs='ar.*,ar' ;;
  esac
  new_work_dir
  set -- --skip-download --write-subs --write-auto-subs --sub-langs "$langs" \
    --no-playlist --no-warnings --socket-timeout 30 \
    -o "$WORK_DIR/%(title).120B [%(id)s].%(ext)s"
  have ffmpeg && set -- "$@" --convert-subs srt
  [ -z "$COOKIES" ] || set -- "$@" --cookies "$COOKIES"
  run_ytdlp "$@" "$INPUT" || { err 'Could not get subtitles.'; return 1; }
  sub_dir="$DOWNLOAD_DIR/Subtitles"
  mkdir -p "$sub_dir" || return 1
  sub_n=0
  for f in "$WORK_DIR"/*; do
    case "$f" in
      *.srt|*.vtt|*.ass)
        mv "$f" "$sub_dir/" && sub_n=$((sub_n + 1))
        say "DONE: $sub_dir/${f##*/}"
        ;;
    esac
  done
  if [ "$sub_n" -eq 0 ]; then
    err 'No subtitles in that language for this video.'
    say 'Try option 4 (every language).'
    return 1
  fi
  say "[C] Burn them into a video: c --edit -> 11"
  return 0
}

show_info() {
  say ''
  say '[C] Reading info...'
  set -- --skip-download --no-playlist --no-warnings --socket-timeout 30 \
    --print 'Title    : %(title)s' \
    --print 'Uploader : %(uploader,channel,creator)s' \
    --print 'Duration : %(duration_string)s' \
    --print 'Date     : %(upload_date>%Y-%m-%d)s' \
    --print 'Views    : %(view_count)s   Likes: %(like_count)s' \
    --print 'Quality  : %(height)sp  %(vcodec)s / %(acodec)s' \
    --print 'Site     : %(extractor_key)s'
  [ -z "$COOKIES" ] || set -- "$@" --cookies "$COOKIES"
  say '----------------------------------------'
  run_ytdlp "$@" "$INPUT" || warn 'The site did not return info.'
  say '----------------------------------------'
}

# =====================================================================
# V33 EDIT STUDIO — استوديو التعديل
# Every result goes to Cinema_Downloads/Edits; the source is never touched.
# Video results are always H.264 + AAC + yuv420p + faststart (Photos-safe).
# =====================================================================

EDIT_DIR_NAME='Edits'

edit_out_dir() {
  eo=$DOWNLOAD_DIR/$EDIT_DIR_NAME
  mkdir -p "$eo" || return 1
  printf '%s' "$eo"
}

ed_unique() {
  eu=$1
  if [ ! -e "$eu" ]; then printf '%s' "$eu"; return; fi
  eu_stem=${eu%.*}
  eu_ext=${eu##*.}
  printf '%s' "${eu_stem}_$(date '+%H%M%S' 2>/dev/null || printf '%s' "$$").${eu_ext}"
}

ed_ff() {
  ffmpeg -y -nostdin -hide_banner -loglevel error "$@" 2> "$STATE_DIR/last_edit_ffmpeg.txt"
  ed_rc=$?
  if [ "$ed_rc" -ne 0 ] && [ -s "$STATE_DIR/last_edit_ffmpeg.txt" ]; then
    say '[EDIT] ffmpeg said:'
    tail -n 8 "$STATE_DIR/last_edit_ffmpeg.txt" 2>/dev/null || true
  fi
  return "$ed_rc"
}

# $1 in ; $2 out ; $3 video filter ('' none) ; $4 audio filter ('' none)
# $5 video kbps (hardware encoder; also software when $6 = abr) ; $6 crf|abr
# Uses ED_SS / ED_T for trimming and ED_ABR for the audio bitrate.
ed_encode_video() {
  ev_in=$1
  ev_out=$2
  ev_vf=$3
  ev_af=$4
  ev_kbps=${5:-6000}
  ev_mode=${6:-crf}
  for ev_enc in hw sw; do
    set --
    [ -z "$ED_SS" ] || set -- "$@" -ss "$ED_SS"
    set -- "$@" -i "$ev_in"
    [ -z "$ED_T" ] || set -- "$@" -t "$ED_T"
    set -- "$@" -map 0:v:0
    probe_media "$ev_in"
    if probe_has_audio; then
      set -- "$@" -map 0:a:0
      [ -z "$ev_af" ] || set -- "$@" -af "$ev_af"
      set -- "$@" -c:a aac -b:a "${ED_ABR:-192}k" -ac 2
    else
      set -- "$@" -an
    fi
    set -- "$@" -sn -dn
    [ -z "$ev_vf" ] || set -- "$@" -vf "$ev_vf"
    if [ "$ev_enc" = 'hw' ]; then
      set -- "$@" -c:v h264_videotoolbox -b:v "${ev_kbps}k"
    elif [ "$ev_mode" = 'abr' ]; then
      set -- "$@" -c:v libx264 -preset veryfast -b:v "${ev_kbps}k" \
        -maxrate "$((ev_kbps * 3 / 2))k" -bufsize "$((ev_kbps * 2))k"
    else
      set -- "$@" -c:v libx264 -preset veryfast -crf 20
    fi
    set -- "$@" -pix_fmt yuv420p -movflags +faststart "$ev_out"
    rm -f "$ev_out" 2>/dev/null || true
    if ffmpeg -y -nostdin -hide_banner -loglevel error "$@" 2> "$STATE_DIR/last_edit_ffmpeg.txt" \
        && [ -s "$ev_out" ]; then
      return 0
    fi
    rm -f "$ev_out" 2>/dev/null || true
    if [ "$ev_enc" = 'hw' ]; then
      say '[EDIT] Hardware H.264 unavailable/failed; trying software H.264...'
    fi
  done
  say '[EDIT] ffmpeg said:'
  tail -n 8 "$STATE_DIR/last_edit_ffmpeg.txt" 2>/dev/null || true
  return 1
}

# Audio-only result. $1 in ; $2 out (.m4a/.mp3) ; $3 audio filter ('' none)
ed_encode_audio() {
  ea_in=$1
  ea_out=$2
  ea_af=$3
  set --
  [ -z "$ED_SS" ] || set -- "$@" -ss "$ED_SS"
  set -- "$@" -i "$ea_in"
  [ -z "$ED_T" ] || set -- "$@" -t "$ED_T"
  set -- "$@" -map 0:a:0 -vn
  [ -z "$ea_af" ] || set -- "$@" -af "$ea_af"
  case "$ea_out" in
    *.mp3) set -- "$@" -c:a libmp3lame -q:a 0 ;;
    *) set -- "$@" -c:a aac -b:a 256k -movflags +faststart ;;
  esac
  ed_ff "$@" "$ea_out"
}

ed_ask_time() {
  # $1 prompt ; $2 default -> sets AT_MS ('' = empty answer, no default)
  # (a-Shell: never read the keyboard inside $( ), so this sets a variable)
  AT_MS=''
  printf '%s' "$1"
  IFS= read -r at_v || at_v=''
  at_v=$(printf '%s' "$at_v" | tr -d ' \r')
  [ -n "$at_v" ] || at_v=$2
  [ -n "$at_v" ] || return 0
  AT_MS=$(to_ms "$at_v") || { err "Wrong time: $at_v (use 75 or 1:15 or 0:01:15)"; return 1; }
}

ed_trim() {
  ED_SS=''
  ED_T=''
  say 'Times: 75  or  1:15  or  0:01:15  (decimals ok: 1:15.5)'
  ed_ask_time 'Start / البداية (Enter = 0): ' '0' || return 1
  st_ms=$AT_MS
  ed_ask_time 'End / النهاية (Enter = until the end): ' '' || return 1
  en_ms=$AT_MS
  if [ -n "$en_ms" ]; then
    [ "$en_ms" -gt "$st_ms" ] || { err 'End must be after start.'; return 1; }
    ED_T=$(ms_to_s $((en_ms - st_ms)))
  fi
  [ "$st_ms" -eq 0 ] || ED_SS=$(ms_to_s "$st_ms")

  if [ "$ED_IS_VIDEO" -eq 0 ]; then
    ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - CUT.m4a")
    ed_encode_audio "$ED_SRC" "$ED_LAST" ''
    ed_rc=$?
    ED_SS=''; ED_T=''
    return "$ed_rc"
  fi

  say ' 1) Exact cut  (re-encode, frame accurate) — دقيق'
  say ' 2) Fast cut   (no re-encode, cuts at keyframes) — سريع'
  printf 'Number [1]: '
  IFS= read -r tm_mode || tm_mode=''
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - CUT.mp4")
  if [ "$tm_mode" = '2' ]; then
    set --
    [ -z "$ED_SS" ] || set -- "$@" -ss "$ED_SS"
    set -- "$@" -i "$ED_SRC"
    [ -z "$ED_T" ] || set -- "$@" -t "$ED_T"
    ed_ff "$@" -map 0:v:0 -map '0:a:0?' -c copy -avoid_negative_ts make_zero \
      -movflags +faststart "$ED_LAST"
    ed_rc=$?
  else
    ed_encode_video "$ED_SRC" "$ED_LAST" '' '' 6000
    ed_rc=$?
  fi
  ED_SS=''; ED_T=''
  return "$ed_rc"
}

ed_compress() {
  [ "$ED_IS_VIDEO" -eq 1 ] || { err 'Compress needs a video file.'; return 1; }
  say 'Target size / الحجم المطلوب:'
  say ' 1) WhatsApp    — 15 MB'
  say ' 2) Telegram/IG — 45 MB'
  say ' 3) Small       — 8 MB'
  say ' 4) Custom MB'
  printf 'Number [1]: '
  IFS= read -r cz || cz=''
  case "$cz" in
    2) cz_mb=45 ;;
    3) cz_mb=8 ;;
    4) printf 'MB: '; IFS= read -r cz_mb || cz_mb=''
       case "$cz_mb" in ''|*[!0-9]*) err 'Whole MB number only.'; return 1 ;; esac
       [ "$cz_mb" -ge 1 ] || { err 'At least 1 MB.'; return 1; } ;;
    *) cz_mb=15 ;;
  esac
  probe_media "$ED_SRC"
  cz_ms=$(probe_duration_ms) || { err 'Could not read the video duration.'; return 1; }
  [ "$cz_ms" -gt 0 ] || { err 'Video duration is zero.'; return 1; }

  cz_try=1
  cz_factor=92
  while [ "$cz_try" -le 2 ]; do
    # total kbit available = MB * 8192 ; keep 8% for container overhead
    cz_total=$((cz_mb * 8192 * 1000 / cz_ms * cz_factor / 100))
    ED_ABR=96
    cz_v=$((cz_total - ED_ABR))
    if [ "$cz_v" -lt 120 ]; then
      ED_ABR=48
      cz_v=$((cz_total - ED_ABR))
      [ "$cz_v" -ge 60 ] || { err "Video too long for $cz_mb MB. Trim it first (option 1)."; ED_ABR=''; return 1; }
    fi
    if [ "$cz_v" -lt 700 ]; then cz_cap=480
    elif [ "$cz_v" -lt 1800 ]; then cz_cap=720
    else cz_cap=1080; fi
    cz_vf="scale='if(gt(iw,ih),-2,trunc(min($cz_cap,iw)/2)*2)':'if(gt(iw,ih),trunc(min($cz_cap,ih)/2)*2,-2)'"
    say "[EDIT] Compressing to ~$cz_mb MB (video ${cz_v} kbps, ${cz_cap}p)..."
    ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - ${cz_mb}MB.mp4")
    ed_encode_video "$ED_SRC" "$ED_LAST" "$cz_vf" '' "$cz_v" abr || { ED_ABR=''; return 1; }
    cz_bytes=$(file_bytes "$ED_LAST")
    if [ "$cz_bytes" -le $((cz_mb * 1048576)) ] 2>/dev/null; then
      say "[EDIT] Size: $((cz_bytes / 1048576)).$(( (cz_bytes % 1048576) * 10 / 1048576 )) MB"
      ED_ABR=''
      return 0
    fi
    say '[EDIT] A bit too big; one more pass at lower bitrate...'
    rm -f "$ED_LAST" 2>/dev/null || true
    cz_factor=75
    cz_try=$((cz_try + 1))
  done
  ED_ABR=''
  err 'Could not reach that size. Trim the video or pick a bigger size.'
  return 1
}

ed_extract_audio() {
  say ' 1) MP3   2) M4A (iPhone)'
  printf 'Number [1]: '
  IFS= read -r xa || xa=''
  case "$xa" in 2) xa_ext=m4a ;; *) xa_ext=mp3 ;; esac
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - AUDIO.$xa_ext")
  ed_encode_audio "$ED_SRC" "$ED_LAST" ''
}

ed_gif() {
  [ "$ED_IS_VIDEO" -eq 1 ] || { err 'GIF needs a video file.'; return 1; }
  ed_ask_time 'Start / البداية (Enter = 0): ' '0' || return 1
  st_ms=$AT_MS
  printf 'Length in seconds (Enter = 5, max 20): '
  IFS= read -r gl || gl=''
  case "$gl" in ''|*[!0-9]*) gl=5 ;; esac
  [ "$gl" -ge 1 ] || gl=5
  [ "$gl" -le 20 ] || gl=20
  printf 'Width (Enter = 480): '
  IFS= read -r gw || gw=''
  case "$gw" in ''|*[!0-9]*) gw=480 ;; esac
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - GIF.gif")
  if has_filter palettegen && has_filter paletteuse; then
    gf="fps=12,scale=$gw:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"
  else
    gf="fps=12,scale=$gw:-2"
  fi
  ed_ff -ss "$(ms_to_s "$st_ms")" -t "$gl" -i "$ED_SRC" -vf "$gf" -loop 0 "$ED_LAST"
}

ed_cover() {
  [ "$ED_IS_VIDEO" -eq 1 ] || { err 'Cover needs a video file.'; return 1; }
  say ' 1) Auto — best-looking frame from the first part — تلقائي'
  say ' 2) At a time I choose — وقت محدد'
  printf 'Number [1]: '
  IFS= read -r cv || cv=''
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - COVER.jpg")
  if [ "$cv" = '2' ]; then
    ed_ask_time 'Time / الوقت (Enter = 1): ' '1' || return 1
    cv_ms=$AT_MS
    ed_ff -ss "$(ms_to_s "$cv_ms")" -i "$ED_SRC" -map 0:v:0 -frames:v 1 -q:v 2 "$ED_LAST"
  else
    if has_filter thumbnail; then
      ed_ff -i "$ED_SRC" -map 0:v:0 -vf 'thumbnail=150' -frames:v 1 -q:v 2 "$ED_LAST"
    else
      ed_ff -ss 1 -i "$ED_SRC" -map 0:v:0 -frames:v 1 -q:v 2 "$ED_LAST"
    fi
  fi
}

ed_speed() {
  say ' 1) 0.5x  slow motion — بطيء'
  say ' 2) 0.75x'
  say ' 3) 1.25x'
  say ' 4) 1.5x'
  say ' 5) 2x    fast — سريع'
  printf 'Number: '
  IFS= read -r sp || sp=''
  case "$sp" in
    1) sp_v=0.5 ;;
    2) sp_v=0.75 ;;
    3) sp_v=1.25 ;;
    4) sp_v=1.5 ;;
    5) sp_v=2.0 ;;
    *) err 'Wrong number.'; return 1 ;;
  esac
  if [ "$ED_IS_VIDEO" -eq 0 ]; then
    ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - ${sp_v}x.m4a")
    ed_encode_audio "$ED_SRC" "$ED_LAST" "atempo=$sp_v"
    return $?
  fi
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - ${sp_v}x.mp4")
  ed_encode_video "$ED_SRC" "$ED_LAST" "setpts=PTS/$sp_v" "atempo=$sp_v" 6000
}

ed_frame() {
  [ "$ED_IS_VIDEO" -eq 1 ] || { err 'This needs a video file.'; return 1; }
  say ' 1) Rotate 90° right — تدوير يمين'
  say ' 2) Rotate 90° left  — تدوير يسار'
  say ' 3) Rotate 180°'
  say ' 4) Mirror (flip)    — عكس'
  say ' 5) Vertical 9:16 — crop center         — طولي قص'
  say ' 6) Vertical 9:16 — blurred background  — طولي لريلز/تيك توك'
  say ' 7) Square 1:1    — crop center         — مربع'
  printf 'Number: '
  IFS= read -r fr || fr=''
  case "$fr" in
    1) fr_vf='transpose=1'; fr_tag='ROT90R' ;;
    2) fr_vf='transpose=2'; fr_tag='ROT90L' ;;
    3) fr_vf='hflip,vflip'; fr_tag='ROT180' ;;
    4) fr_vf='hflip'; fr_tag='MIRROR' ;;
    5) fr_vf="crop='trunc(min(iw,ih*9/16)/2)*2':'trunc(min(ih,iw*16/9)/2)*2',setsar=1"; fr_tag='9x16' ;;
    6) fr_vf="split[a][b];[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10:2,scale=1080:1920[bg];[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1"
       fr_tag='REELS' ;;
    7) fr_vf="crop='trunc(min(iw,ih)/2)*2':'trunc(min(iw,ih)/2)*2',setsar=1"; fr_tag='SQUARE' ;;
    *) err 'Wrong number.'; return 1 ;;
  esac
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - $fr_tag.mp4")
  ed_encode_video "$ED_SRC" "$ED_LAST" "$fr_vf" '' 6000
}

ed_loudness() {
  say ' 1) Normal loud  (-14 LUFS, like TikTok/YouTube) — تعلية عادية'
  say ' 2) Extra loud   (-10 LUFS)                     — تعلية قوية'
  say ' 3) Speech boost (evens out quiet voices)       — توضيح الكلام'
  printf 'Number [1]: '
  IFS= read -r ln || ln=''
  case "$ln" in
    2) ln_af='loudnorm=I=-10:TP=-1:LRA=9'; ln_tag='LOUD+' ;;
    3) ln_af='highpass=f=70,dynaudnorm=f=150:g=15,alimiter=limit=0.95'; ln_tag='SPEECH' ;;
    *) ln_af='loudnorm=I=-14:TP=-1.5:LRA=11'; ln_tag='LOUD' ;;
  esac
  probe_media "$ED_SRC"
  probe_has_audio || { err 'This file has no audio track.'; return 1; }
  if [ "$ED_IS_VIDEO" -eq 0 ]; then
    ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - $ln_tag.m4a")
    ed_encode_audio "$ED_SRC" "$ED_LAST" "$ln_af,aresample=48000"
    return $?
  fi
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - $ln_tag.mp4")
  if [ "$(probe_vcodec)" = 'h264' ] && ed_ff -i "$ED_SRC" -map 0:v:0 -map 0:a:0 -c:v copy \
      -af "$ln_af,aresample=48000" -c:a aac -b:a 192k -ac 2 -movflags +faststart "$ED_LAST"; then
    return 0
  fi
  rm -f "$ED_LAST" 2>/dev/null || true
  ed_encode_video "$ED_SRC" "$ED_LAST" '' "$ln_af,aresample=48000" 6000
}

ed_mute() {
  [ "$ED_IS_VIDEO" -eq 1 ] || { err 'Mute needs a video file.'; return 1; }
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - MUTED.mp4")
  probe_media "$ED_SRC"
  if [ "$(probe_vcodec)" = 'h264' ] && ed_ff -i "$ED_SRC" -map 0:v:0 -c:v copy -an \
      -movflags +faststart "$ED_LAST"; then
    return 0
  fi
  rm -f "$ED_LAST" 2>/dev/null || true
  ED_SS=''; ED_T=''
  ed_ff -i "$ED_SRC" -map 0:v:0 -an -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
    -movflags +faststart "$ED_LAST"
}

ed_fix_sound() {
  probe_media "$ED_SRC"
  probe_has_audio || { err 'This file has NO audio track at all — nothing to fix. Download it again (Sound Guard retries automatically).'; return 1; }
  if [ "$ED_IS_VIDEO" -eq 0 ]; then
    ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - FIXED.m4a")
    ed_encode_audio "$ED_SRC" "$ED_LAST" ''
    return $?
  fi
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - FIXED.mp4")
  fx_vc=$(probe_vcodec)
  if [ "$fx_vc" = 'h264' ]; then
    say '[EDIT] Video is H.264: keeping it, rebuilding the audio as AAC-LC 48 kHz...'
    if ed_ff -i "$ED_SRC" -map 0:v:0 -map 0:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
        -movflags +faststart "$ED_LAST"; then
      return 0
    fi
    rm -f "$ED_LAST" 2>/dev/null || true
  fi
  say "[EDIT] Rebuilding video ($fx_vc -> H.264) and audio (AAC-LC)..."
  ed_encode_video "$ED_SRC" "$ED_LAST" '' 'aresample=48000' 6000
}

ed_burn_subs() {
  [ "$ED_IS_VIDEO" -eq 1 ] || { err 'Subtitles need a video file.'; return 1; }
  has_filter subtitles || {
    err 'This ffmpeg build has no subtitles filter (libass). Burning is not possible here.'
    return 1
  }
  bs_list="$STATE_DIR/subs_pick.txt"
  : > "$bs_list"
  bs_n=0
  for f in "$DOWNLOAD_DIR"/*.srt "$DOWNLOAD_DIR/Subtitles"/*.srt "$HOME_DIR/Documents"/*.srt; do
    [ -f "$f" ] || continue
    bs_n=$((bs_n + 1))
    printf '%s\n' "$f" >> "$bs_list"
    say "$(printf '%2d' "$bs_n")) ${f##*/}"
  done
  [ "$bs_n" -gt 0 ] || {
    err 'No .srt files found. Get them with option 14 (SUBTITLES) or put one in Documents.'
    return 1
  }
  printf 'Number: '
  IFS= read -r bs || bs=''
  case "$bs" in ''|0|*[!0-9]*) return 1 ;; esac
  [ "$bs" -le "$bs_n" ] || { err 'Wrong number.'; return 1; }
  bs_src=$(sed -n "${bs}p" "$bs_list")
  # Copy to a path with no special characters: the filter syntax treats : ' , specially.
  cp "$bs_src" "$STATE_DIR/burn_subs.srt" || return 1
  bs_path=$(printf '%s' "$STATE_DIR/burn_subs.srt" | sed "s/[\\\\:']/\\\\&/g")
  ED_LAST=$(ed_unique "$ED_OD/$ED_STEM - SUBS.mp4")
  ed_encode_video "$ED_SRC" "$ED_LAST" \
    "subtitles=$bs_path:force_style='FontSize=20,Outline=2,Shadow=1,MarginV=40'" '' 6000
}

ed_menu() {
  say ''
  say 'EDIT STUDIO — استوديو التعديل'
  say '----------------------------------------'
  say ' 1) Trim / cut              — قص من إلى'
  say ' 2) Compress (WhatsApp...)  — ضغط الحجم'
  say ' 3) Extract audio MP3/M4A   — استخراج الصوت'
  say ' 4) GIF                     — صورة متحركة'
  say ' 5) Cover image             — صورة غلاف'
  say ' 6) Speed 0.5x - 2x         — السرعة'
  say ' 7) Rotate / 9:16 / square  — تدوير وأبعاد'
  say ' 8) Louder / normalize      — تعلية الصوت'
  say ' 9) Mute video              — بدون صوت'
  say '10) Fix sound / iPhone-safe — إصلاح الصوت'
  say '11) Burn subtitles (.srt)   — دمج الترجمة'
  say ' 0) Done'
  say '----------------------------------------'
  printf 'Number: '
  IFS= read -r ED_CHOICE || ED_CHOICE=''
}

# $1 = source media file. Lets the user chain several edits on the result.
edit_studio() {
  have ffmpeg || { err 'Edit Studio needs ffmpeg in a-Shell.'; return 1; }
  ED_SRC=$1
  [ -f "$ED_SRC" ] || { err "File not found: $ED_SRC"; return 1; }
  ED_OD=$(edit_out_dir) || { err 'Cannot create the Edits folder.'; return 1; }
  ED_SS=''
  ED_T=''
  ED_ABR=''
  ed_results=''

  while :; do
    ED_STEM=${ED_SRC##*/}
    ED_STEM=${ED_STEM%.*}
    ED_STEM=$(printf '%s' "$ED_STEM" | sed 's/^PhotosSafe_//; s/[\/:*?"<>|]/_/g')
    probe_media "$ED_SRC"
    if probe_has_video; then ED_IS_VIDEO=1; else ED_IS_VIDEO=0; fi
    say ''
    say "[EDIT] File: ${ED_SRC##*/}"
    ed_menu
    ED_LAST=''
    case "$ED_CHOICE" in
      0|'') break ;;
      1) ed_trim ;;
      2) ed_compress ;;
      3) ed_extract_audio ;;
      4) ed_gif ;;
      5) ed_cover ;;
      6) ed_speed ;;
      7) ed_frame ;;
      8) ed_loudness ;;
      9) ed_mute ;;
      10) ed_fix_sound ;;
      11) ed_burn_subs ;;
      *) err 'Wrong number.'; continue ;;
    esac
    ed_ok=$?
    if [ "$ed_ok" -ne 0 ] || [ -z "$ED_LAST" ] || [ ! -s "$ED_LAST" ]; then
      [ -z "$ED_LAST" ] || rm -f "$ED_LAST" 2>/dev/null || true
      err 'Edit failed. Original file untouched.'
      continue
    fi
    say ''
    say "DONE: $ED_LAST"
    ed_results="${ed_results}$ED_LAST
"
    case "$ED_LAST" in
      *.mp4|*.gif|*.jpg)
        printf 'Open it now (Save to Photos)? / فتح للحفظ في الصور؟ [Y/n]: '
        IFS= read -r eo_yn || eo_yn=''
        case "$eo_yn" in
          n|N|no|NO) ;;
          *) if have open; then open "$ED_LAST" >/dev/null 2>&1 || say "Open manually: $ED_LAST"
             elif have view; then view "$ED_LAST" >/dev/null 2>&1 || true; fi ;;
        esac
        ;;
    esac
    case "$ED_LAST" in
      *.jpg|*.gif) ;;
      *)
        printf 'Edit this RESULT again? / تعديل النتيجة كمان؟ [y/N]: '
        IFS= read -r again || again=''
        case "$again" in y|Y|yes|YES) ED_SRC=$ED_LAST ;; esac
        ;;
    esac
  done

  if [ -n "$ed_results" ]; then
    say ''
    say '========================================'
    say '[EDIT] Ready / الملفات الجاهزة:'
    printf '%s' "$ed_results" | sed '/^$/d; s/^/  /'
    say "[EDIT] Folder: $ED_OD"
    say '========================================'
  fi
  return 0
}

edit_pick_local() {
  ep_list="$STATE_DIR/edit_pick.txt"
  mkdir -p "$STATE_DIR" "$DOWNLOAD_DIR" 2>/dev/null || true
  : > "$ep_list"
  say ''
  say 'Pick a file (newest first) / اختر ملف:'
  say '----------------------------------------'
  ep_n=0
  for ep_dir in "$DOWNLOAD_DIR" "$DOWNLOAD_DIR/$EDIT_DIR_NAME" "$DOWNLOAD_DIR/Audio_Lab"; do
    [ -d "$ep_dir" ] || continue
    ls -1t "$ep_dir" > "$STATE_DIR/.ep_ls.txt" 2>/dev/null || continue
    ep_total=$(wc -l < "$STATE_DIR/.ep_ls.txt" | tr -d ' ')
    ep_i=0
    while [ "$ep_i" -lt "$ep_total" ]; do
      ep_i=$((ep_i + 1))
      ep_name=$(sed -n "${ep_i}p" "$STATE_DIR/.ep_ls.txt")
      f="$ep_dir/$ep_name"
      [ -f "$f" ] || continue
      case "$f" in
        *.mp4|*.MP4|*.m4v|*.mov|*.MOV|*.mkv|*.webm|*.m4a|*.M4A|*.mp3|*.MP3|*.wav|*.WAV|*.aac|*.opus|*.ogg|*.flac) ;;
        *) continue ;;
      esac
      ep_n=$((ep_n + 1))
      printf '%s\n' "$f" >> "$ep_list"
      say "$(printf '%2d' "$ep_n")) ${f##*/}"
      [ "$ep_n" -lt 40 ] || break
    done
  done
  [ "$ep_n" -gt 0 ] || { err "No media files found in $DOWNLOAD_DIR"; return 1; }
  say ' 0) Cancel'
  say '----------------------------------------'
  printf 'Number: '
  IFS= read -r k || k=''
  case "$k" in ''|0|*[!0-9]*) return 1 ;; esac
  [ "$k" -le "$ep_n" ] || { err 'Wrong number.'; return 1; }
  EDIT_FILE=$(sed -n "${k}p" "$ep_list")
  [ -n "$EDIT_FILE" ] && [ -f "$EDIT_FILE" ]
}

edit_local_flow() {
  have ffmpeg || { err 'Edit Studio needs ffmpeg in a-Shell.'; return 1; }
  if [ -n "$EDIT_FILE" ]; then
    if [ ! -f "$EDIT_FILE" ] && [ -f "$DOWNLOAD_DIR/$EDIT_FILE" ]; then
      EDIT_FILE="$DOWNLOAD_DIR/$EDIT_FILE"
    fi
  else
    edit_pick_local || return 1
  fi
  [ -f "$EDIT_FILE" ] || { err "File not found: $EDIT_FILE"; return 1; }
  edit_studio "$EDIT_FILE"
}

# ---------------- doctor / nightly update ----------------

cinema_doctor() {
  say "Cinema Doctor — $APP $VERSION"
  say '----------------------------------------'
  if find_ytdlp; then
    say "yt-dlp: $("$YTDLP" --version 2>/dev/null || printf '?')"
    if detect_fb_impersonation; then
      say "browser impersonation: $FB_IMPERSONATE"
    else
      say 'browser impersonation: unavailable (not fatal)'
    fi
  else
    say 'yt-dlp: NOT FOUND  -> pip install yt-dlp'
  fi
  if have ffmpeg; then
    say 'ffmpeg: OK'
    mkdir -p "$STATE_DIR" 2>/dev/null || true
    ffmpeg -hide_banner -encoders > "$STATE_DIR/.encoders.txt" 2>/dev/null || true
    for enc in h264_videotoolbox libx264 aac libmp3lame; do
      if grep -q " $enc " "$STATE_DIR/.encoders.txt" 2>/dev/null; then
        say "encoder $enc: OK"
      else
        say "encoder $enc: missing"
      fi
    done
    for flt in volumedetect loudnorm atempo setpts transpose boxblur palettegen paletteuse thumbnail subtitles arnndn; do
      if has_filter "$flt"; then say "filter $flt: OK"; else say "filter $flt: missing"; fi
    done
  else
    say 'ffmpeg: MISSING (Photos SAFE, Sound Guard, Edit Studio and Audio Lab disabled)'
  fi
  if have pbpaste; then say 'clipboard (pbpaste): OK'; else say 'clipboard (pbpaste): missing'; fi
  if have open; then say 'open (Save to Photos): OK'; else say 'open: missing'; fi
  if have curl; then say 'curl: OK'; else say 'curl: missing'; fi
  if mkdir -p "$DOWNLOAD_DIR" 2>/dev/null && : > "$DOWNLOAD_DIR/.write_test" 2>/dev/null; then
    rm -f "$DOWNLOAD_DIR/.write_test"
    say "downloads folder: OK ($DOWNLOAD_DIR)"
  else
    say "downloads folder: NOT writable ($DOWNLOAD_DIR)"
  fi
  if [ "$SOUND_GUARD" -eq 1 ]; then say 'sound guard: ON'; else say 'sound guard: OFF (CINEMA_SOUND_GUARD=0)'; fi
  if [ -s "$HISTORY_FILE" ]; then
    say "history: $(count_lines_file "$HISTORY_FILE") downloads"
  else
    say 'history: empty'
  fi
  say '----------------------------------------'
  return 0
}

update_ytdlp_nightly() {
  say '[C] Installing the newest yt-dlp pre-release...'
  if have pip; then pip install --upgrade --pre yt-dlp && return 0; fi
  if have python3; then python3 -m pip install --upgrade --pre yt-dlp && return 0; fi
  err 'pip not found. In a-Shell run: pip install --upgrade --pre yt-dlp'
  return 1
}

main() {
  parse_args "$@"

  if [ "$INSTALL" -eq 1 ]; then
    install_self
    exit 0
  fi

  if [ "$FB_SETUP_COOKIES" -eq 1 ]; then
    setup_facebook_cookies
    exit 0
  fi

  if [ "$SETUP_AI" -eq 1 ]; then
    setup_ai
    exit 0
  fi

  if [ "$DO_UPDATE" -eq 1 ]; then
    update_ytdlp
    exit $?
  fi

  if [ "$UPDATE_NIGHTLY" -eq 1 ]; then
    update_ytdlp_nightly
    exit $?
  fi

  if [ "$LAB_DOCTOR" -eq 1 ]; then
    lab_doctor
    exit $?
  fi

  if [ "$DO_DOCTOR" -eq 1 ]; then
    cinema_doctor
    exit $?
  fi

  if [ "$SHOW_HISTORY" -eq 1 ]; then
    show_history
    exit 0
  fi

  # Offline: Edit Studio on files already on the iPhone.
  if [ "$EDIT_LOCAL" -eq 1 ]; then
    edit_local_flow
    exit $?
  fi

  # Offline: works on files already on the iPhone, yt-dlp not required.
  if [ "$LAB_LOCAL" -eq 1 ]; then
    lab_local_flow
    exit $?
  fi

  find_ytdlp || {
    err 'yt-dlp not found.'
    exit 1
  }

  if [ "$FB_DOCTOR" -eq 1 ]; then
    facebook_doctor
    exit $?
  fi

  if [ "$DO_AGAIN" -eq 1 ]; then
    load_last_url || exit 1
  fi

  [ -z "$BATCH_FILE" ] || load_batch_file

  prompt_url

  if [ "$PLAYLIST" -eq 1 ]; then
    expand_playlist || exit 1
  fi

  if [ "$(url_count)" -gt 1 ]; then
    batch_flow
    exit $?
  fi

  if is_facebook_profile_url; then
    facebook_profile_flow
    exit $?
  fi

  while :; do
    show_menu
    printf 'Number: '
    IFS= read -r choice || choice=''
    [ "$choice" = '15' ] || break
    show_info
  done

  case "$choice" in
    0)
      exit 0
      ;;
    1)
      choose_destination video
      say '[C] Downloading BEST...'
      sel=$(best_selector)
      run_download "$sel" merge || exit 1
      ;;
    2|3|4|5|6)
      case "$choice" in
        2) h=2160; label='2160p' ;;
        3) h=1440; label='1440p' ;;
        4) h=1080; label='1080p' ;;
        5) h=720;  label='720p' ;;
        6) h=480;  label='480p' ;;
      esac
      choose_destination video
      say "[C] Downloading $label or best lower quality..."
      sel=$(selector_for_height "$h")
      run_download "$sel" merge || exit 1
      ;;
    7)
      choose_destination video
      say '[C] Downloading FAST MP4...'
      run_download "b[ext=mp4][vcodec~='^(avc1|h264)'][format_note!*=?watermark]/b[ext=mp4]/best" none || exit 1
      ;;
    8)
      choose_destination audio
      say '[C] Downloading AUDIO M4A...'
      if have ffmpeg; then
        run_download 'bestaudio' m4a || exit 1
      else
        run_download 'bestaudio[ext=m4a]/bestaudio' none || exit 1
      fi
      ;;
    9)
      choose_destination audio
      say '[C] Downloading AUDIO MP3...'
      run_download 'bestaudio' mp3 || exit 1
      ;;
    10)
      show_exact_formats || exit 1
      ;;
    11)
      lab_url_flow
      exit $?
      ;;
    12)
      say '[C] Downloading BEST for Edit Studio...'
      run_download "$(best_selector)" merge || exit 1
      edit_studio "$OUTPUT_FILE"
      exit $?
      ;;
    13)
      download_thumbnail
      exit $?
      ;;
    14)
      download_subtitles
      exit $?
      ;;
    *)
      err 'Wrong number.'
      exit 1
      ;;
  esac

  finish
}

main "$@"
