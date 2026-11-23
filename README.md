# VideoDL — Linux Terminal Video Downloader

**VideoDL** is a Linux command-line video downloader with an interactive Terminal User Interface (TUI) and a direct Command-Line Interface (CLI), built with TypeScript, Node.js, Ink (React), `yt-dlp`, FFmpeg, and SQLite.

Both the interactive dashboard and CLI subcommands share the same modular application core for queuing, metadata extraction, format selection, persistence, and process management.

---

## Features

- **Interactive TUI Dashboard (`videodl`)**: Full-screen terminal interface with Home overview, New Download form, scrollable Download Queue with live progress bars/speed/ETA, Download History, interactive Settings editor, and System Dependency Status.
- **Direct CLI Mode**: Download videos or playlists, inspect history, manage settings, and check system dependencies directly from scripts or shell commands.
- **Video & Audio Formats**: Defaults to `1080p` max video quality with best available audio merged into `MKV`, with configurable resolution (`best`, `2160p`–`360p`), output container (`mkv`, `mp4`, `webm`), and audio-only extraction (`mp3`, `m4a`, `flac`, `opus`).
- **Playlist Support**: Automatically detects playlist URLs, fetches metadata via `--flat-playlist`, and queues playlist items with progress tracking.
- **Queue Management**: Configurable concurrent download limit (1–5), duplicate active URL prevention, and full **pause**, **resume**, **cancel**, and **retry** support.
- **Persistent SQLite Storage**: Stores settings, queue state (with automatic recovery of interrupted jobs into `paused` state), and download history locally via Node's built-in `node:sqlite`.
- **System Dependency Health Check**: Detects `Node.js`, `yt-dlp`, `FFmpeg`, and JS runtimes (`deno`/`node`) and displays Fedora Linux installation hints if anything is missing.

---

## System Requirements

VideoDL targets **Fedora Linux** (and works on other Linux distributions with the same dependencies):

- **Node.js** `>= 22.5.0` (tested on Node 24)
- **pnpm**
- **yt-dlp**
- **FFmpeg**

### Installing Prerequisites on Fedora Linux

```bash
sudo dnf install nodejs yt-dlp ffmpeg-free
# Or, if you have RPM Fusion enabled:
# sudo dnf install ffmpeg
```

If you don't already have `pnpm`:

```bash
corepack enable
# or: npm install -g pnpm
```

---

## Installation

1. **Clone or open the repository and install dependencies:**

```bash
cd /path/to/downloader
pnpm install
```

2. **Build the TypeScript project:**

```bash
pnpm build
```

3. **Make `videodl` available globally on your `PATH`:**

**Option A — Symlink to `~/.local/bin` (recommended for development; always uses your latest `pnpm build`):**

```bash
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/videodl.js" ~/.local/bin/videodl
```

Make sure `~/.local/bin` is in your `PATH`.

**Option B — Install globally via pnpm:**

```bash
pnpm add -g link:.
```

4. **Verify installation and system dependencies:**

```bash
videodl --version
videodl doctor
```

---

## Usage

### 1. Interactive TUI Mode

Launch the full-screen terminal dashboard:

```bash
videodl
```

#### Keyboard Shortcuts

| Scope | Key | Action |
| --- | --- | --- |
| **Global** | `1` – `6` | Switch screen (Home, New Download, Queue, History, Settings, Dependencies) |
| **Global** | `n` | Jump to New Download |
| **Global** | `q` | Quit VideoDL gracefully |
| **New Download** | `↑` / `↓` / `Tab` | Move between form fields |
| **New Download** | `←` / `→` / `Space` | Cycle mode, resolution, container, or playlist behavior |
| **New Download** | `Enter` | Submit and add to queue |
| **New Download** | `Esc` | Exit text input mode |
| **Queue** | `↑` / `↓` or `j` / `k` | Select and scroll through queue items (`PageUp`/`PageDown` for fast scroll) |
| **Queue** | `p` | Pause or resume the selected download |
| **Queue** | `c` | Cancel the selected download (without quitting) |
| **Queue** | `r` | Retry a failed or cancelled download |
| **Queue** | `d` | Remove a non-active job from the queue |
| **Queue** | `x` | Clear all finished (completed, failed, cancelled) jobs |
| **History** | `↑` / `↓` / `PageUp` / `PageDown` | Browse history records |
| **History** | `r` | Re-queue the selected item |
| **History** | `c` | Clear download history |
| **Settings** | `↑` / `↓` | Select preference |
| **Settings** | `←` / `→` / `Enter` | Change value (or edit download directory path) |
| **Settings** | `Shift+R` | Reset all settings to defaults |
| **Dependencies** | `r` | Re-run dependency checks |

---

### 2. Command-Line Interface (CLI)

#### Download a Single Video

```bash
videodl download "https://example.com/watch?v=VIDEO_ID"
```

Options:
- `-r, --resolution <res>` — Max resolution (`best`, `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`)
- `-c, --container <ext>` — Output container (`mkv`, `mp4`, `webm`)
- `-d, --dir <path>` — Output directory
- `-a, --audio-only` — Extract audio only
- `--audio-format <fmt>` — Audio format (`best`, `mp3`, `m4a`, `flac`, `opus`)

#### Download a Playlist

```bash
videodl playlist "https://example.com/playlist?list=PLAYLIST_ID"
```

Supports all `download` options plus:
- `-l, --limit <n>` — Limit the number of playlist items queued

#### View or Clear History

```bash
videodl history
videodl history --limit 50
videodl history --json
videodl history --clear
```

#### Manage Settings

```bash
videodl settings
videodl settings --get maxResolution
videodl settings --set maxResolution=1080p
videodl settings --set outputContainer=mkv
videodl settings --set maxConcurrentDownloads=2
videodl settings --set browserCookies=firefox
videodl settings --reset
```

Valid setting keys:
- `downloadDir`
- `maxResolution` (`best`, `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`)
- `outputContainer` (`mkv`, `mp4`, `webm`)
- `audioFormat` (`best`, `mp3`, `m4a`, `flac`, `opus`)
- `audioQuality` (`best`, `320k`, `256k`, `192k`, `128k`)
- `maxConcurrentDownloads` (`1`–`5`)
- `browserCookies` (`none`, `firefox`, `chromium`, `chrome`, `brave`, `edge`)

#### Check System Dependencies

```bash
videodl doctor
# alias: videodl status
```

---

## Data Storage & XDG Paths

VideoDL follows the XDG Base Directory specification:

- **SQLite Database** (settings, queue, history): `~/.local/share/videodl/videodl.db` (or `$XDG_DATA_HOME/videodl/videodl.db`)
- **Default Download Folder**: `~/Videos/VideoDL` (falls back to `~/Downloads/VideoDL` if `~/Videos` does not exist)
- Set `VIDEODL_DATA_DIR=/custom/path` to override the data directory (useful for isolated testing).

---

## Security & Privacy

- External processes (`yt-dlp`, `ffmpeg`, `which`) are launched exclusively with `child_process.spawn(..., { shell: false })` and explicit argument arrays, using `--` before positional URLs to prevent option/shell injection.
- URLs are strictly validated and restricted to `http://` and `https://` schemes.
- Optional browser cookie integration (`--cookies-from-browser`) stays completely local to `yt-dlp`, is never uploaded, and is redacted from diagnostic argument output.
- VideoDL respects platform access controls and DRM protections and does not implement DRM circumvention.

---

## Development & Testing

```bash
# Run in dev mode with tsx
pnpm dev

# Type-check with TypeScript strict mode
pnpm typecheck

# Run unit tests (Vitest)
pnpm test

# Compile to dist/
pnpm build
```
