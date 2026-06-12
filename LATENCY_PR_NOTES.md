# Latency PR — Rationale and Staged Test Plan

**Goal:** end of speech → first audible word in **1–2 seconds** (typical ~1.0–1.5s),
independent of response length. No hardware changes — same ESP32-S3 / INMP441 /
MAX98357A.

## Why 7–8s was never the floor

The June report's latency table counts *full response generation* (2–4s) and
*playback duration* (2–4s) inside "delay to first word heard". In a streamed
pipeline those overlap with playback. What the child actually waits for:

| Stage | Time | Basis |
|---|---|---|
| End of speech → Gemini has all audio | ~0 ms | mic stream forwarded live during speech (this PR) |
| Gemini first audio token | 500–900 ms | June report measurement (Q4) |
| First chunk encode + LAN transfer | ~150–350 ms | measured WiFi numbers; first chunk ~6 KB |
| Firmware pre-roll + decode | ~70 ms | 60 ms threshold already in the ring-buffer code |
| **Time to first word** | **~1.0–1.5 s** | independent of response length |

## What changed

### App (works against the current stable firmware — Stage 1)

| Commit | Change | Wait removed |
|---|---|---|
| `LAT\|` instrumentation | per-turn timing marks + one-line summary | — (measurement) |
| Send-as-encoded (`OpusStreamSender`) | chunks go to the ESP32 in order, each the moment its encode resolves — not after `turnComplete`. First chunk threshold 1s → ~320ms | full generation window leaves the delivery path |
| Live mic forwarding | mic PCM forwarded to Gemini in ~125ms slices *during* speech (firmware already streamed it; the app buffered it). Push-to-talk now uses explicit `activityStart`/`activityEnd` (auto-VAD off — see toggle below) | upload backlog after button release |
| End-of-stream sentinel | zero-length packet inside the existing `[len][opus]` framing replaces text `DONE` byte-sniffing | 150ms anti-coalescing gap; kills the framing edge case |

### Firmware (`Arduino_code.md` — Stage 2)

The ring-buffer streaming path already in this repo, with the four June-report
instability causes fixed:

1. **PSRAM bus contention** → ring buffer (32KB) allocates in **internal SRAM**;
   PSRAM only as logged fallback.
2. **I2S handoff crash** → `streamPlayTask` waits synchronously for the lullaby
   task to actually exit (2s cap → clean abort), never force-clears its flags.
3. **Lullaby deferral** → the wait-tune only starts if no audio arrived within
   1.5s; fast turns skip the handoff entirely.
4. **Ring overflow** → reads pause while ring free space is low; TCP flow
   control stalls the phone. Nothing dropped.

The LittleFS store-then-play path (`SENDALL`/WAV) is untouched as fallback.

### Compatibility matrix

| | Old firmware | New firmware |
|---|---|---|
| **Old app** | unchanged | text `DONE:` still detected; in COMMAND mode ignored silently |
| **New app** | sentinel logged as bad length + recovered; legacy `DONE:` line (sent 150ms later) terminates the stream | sentinel ends the stream immediately |

### Toggle / fallback knobs

- `EXPLICIT_ACTIVITY` in `src/services/GeminiLiveService.ts` — set `false` to
  restore auto-VAD + `audioStreamEnd` if the Live API rejects
  `realtimeInputConfig` on your key/model combination.
- Firmware logs `[RING] Internal SRAM ring buffer` on the new allocation path;
  if you ever see the PSRAM fallback warning, tell us — that changes fix #1.

## Staged test plan

Run each stage as **10 voice interactions** (mix of short and long questions) and
send back the `LAT|` lines (visible in the on-screen debug log and Metro/logcat).

**Stage 1 — app only, current stable firmware.** Build the APK from this branch,
run against the firmware you have on devices today.
*Expected: ~6s typical (modest — validates plumbing + pins Gemini TTFT on your
network). Key number to report: `gemini_first_audio`.*

**Stage 2 — streaming firmware.** Flash the updated `Arduino_code.md` sketch,
repeat the same 10 interactions.
*Expected: `played_received` starts ≈ `first_opus_sent` + ~100ms; first word at
**1.0–1.5s** regardless of response length.*

### Reading the logs

```
LAT|turn_start +0ms              ← button released
LAT|activity_end_sent +12ms      ← Gemini told speech is over
LAT|gemini_first_audio +640ms    ← model TTFT (the external dependency)
LAT|first_opus_sent +1010ms      ← first audio handed to the toy
LAT|gemini_turn_complete +2480ms ← generation done (overlaps playback in Stage 2)
LAT|done_sent +2600ms
LAT|played_received +5900ms      ← playback finished (not the wait!)
LAT|summary ...                  ← one line per turn, paste these
```

In Stage 2 the child's perceived wait ≈ `first_opus_sent` + ~100ms.

## Security changes bundled in this PR

- **The hardcoded Gemini API key is removed from `voiceConfig.ts`** and the app
  now fetches it via the `gemini-key` edge function using the signed-in user's
  session token. ⚠️ **The old key is still in this repository's git history**
  (commit `840b2ae`) — it must be treated as compromised: revoke it in Google
  AI Studio / GCP, generate a replacement, and set it only as the
  `GEMINI_LIVE_API_KEY` Supabase secret.
- `gemini-key` and `encode-opus` now require a signed-in user via an explicit
  `auth.getUser()` check. Note: `verify_jwt = true` alone is **not** an auth
  gate — the public anon key is itself a valid JWT and passes it.
- ⚠️ **Deploy pairing:** ship the edge-function changes and the app build from
  this branch together. The new functions reject anon-bearer calls, so an old
  APK against new functions will get 401s on `gemini-key`/`encode-opus`
  (new APK against old functions works fine).
- These changes reduce exposure for the pilot; they don't remove it — any
  signed-in user can still extract the key. The relay server (`relay/`)
  replaces client-side key distribution entirely and remains the production
  requirement before school deployment.

## Out of scope (deliberately)

- Supabase `encode-opus` stays for now — its RTT only touches the first chunk
  (~150–300ms, inside budget). If Stage 2 logs show worse, next step is
  on-device Opus encode.
- Relay server reintegration (`relay/`) — separate milestone before any school
  pilot; as a transparent proxy hop it costs ~10–50ms and doesn't affect this
  budget.
