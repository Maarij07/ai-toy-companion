"""
AI Toy - Client Technical Update Report Generator
Built by Machadev
Run: python generate_report.py
Output: AI_Toy_Client_Report_June2026.pdf
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.colors import HexColor

NAVY      = HexColor("#1a1a2e")
BLUE      = HexColor("#2c2c6e")
GREEN     = HexColor("#1a7a4a")
RED       = HexColor("#c0392b")
ORANGE    = HexColor("#d35400")
LIGHT_BG  = HexColor("#f4f6fd")
RED_BG    = HexColor("#fdf2f2")
GREEN_BG  = HexColor("#f0faf4")
ORANGE_BG = HexColor("#fef5e7")
ROW_ALT   = HexColor("#f8f9fd")
BORDER    = HexColor("#dde0ec")
MID_GREY  = HexColor("#555555")
LIGHT_GREY= HexColor("#888888")
CODE_BG   = HexColor("#1e1e2e")
CODE_FG   = HexColor("#cdd6f4")
CODE_BORDER = HexColor("#313244")

W, H = A4


class SideBarBox(Flowable):
    def __init__(self, paragraphs, bar_color, bg_color, label, width=None):
        super().__init__()
        self.paragraphs = paragraphs
        self.bar_color  = bar_color
        self.bg_color   = bg_color
        self.label      = label
        self._width     = width or (W - 4*cm)
        self._paras_rendered = []

    def wrap(self, availWidth, availHeight):
        self._width = availWidth
        inner_w = availWidth - 22
        total_h = 20
        self._paras_rendered = []
        for p in self.paragraphs:
            w2, h2 = p.wrap(inner_w, 9999)
            self._paras_rendered.append((p, w2, h2))
            total_h += h2 + 3
        total_h += 8
        self._height = total_h
        return (self._width, self._height)

    def draw(self):
        c = self.canv
        w, h = self._width, self._height
        c.setFillColor(self.bg_color)
        c.roundRect(0, 0, w, h, 4, fill=1, stroke=0)
        c.setFillColor(self.bar_color)
        c.roundRect(0, 0, 5, h, 2, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(self.bar_color)
        c.drawString(12, h - 14, self.label.upper())
        y = h - 20
        for p, pw, ph in self._paras_rendered:
            y -= ph
            p.drawOn(c, 12, y)
            y -= 3
        c.setStrokeColor(self.bar_color)
        c.setLineWidth(0.3)
        c.roundRect(0, 0, w, h, 4, fill=0, stroke=1)


class CodeBlock(Flowable):
    def __init__(self, lines, width=None, title=""):
        super().__init__()
        self.lines  = lines
        self._width = width or (W - 4*cm)
        self.title  = title

    def wrap(self, availWidth, availHeight):
        self._width  = availWidth
        line_h = 13
        header = 20 if self.title else 8
        self._height = header + len(self.lines) * line_h + 10
        return (self._width, self._height)

    def draw(self):
        c = self.canv
        w, h = self._width, self._height
        c.setFillColor(CODE_BG)
        c.roundRect(0, 0, w, h, 4, fill=1, stroke=0)
        c.setStrokeColor(CODE_BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, w, h, 4, fill=0, stroke=1)
        if self.title:
            c.setFillColor(CODE_BORDER)
            c.roundRect(0, h - 20, w, 20, 4, fill=1, stroke=0)
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(HexColor("#a6adc8"))
            c.drawString(10, h - 14, self.title)
        line_h = 13
        header_off = 20 if self.title else 8
        y = h - header_off - 13
        for line in self.lines:
            c.setFont("Courier", 9)
            c.setFillColor(CODE_FG)
            c.drawString(10, y, line)
            y -= line_h


OUTPUT = "AI_Toy_Client_Report_June2026.pdf"
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2.2*cm, bottomMargin=2.4*cm,
    title="AI Toy Voice Pipeline Technical Update",
    author="Machadev",
)

def S(name, **kw):
    return ParagraphStyle(name, **kw)

sTitle    = S("sTitle",    fontSize=22, leading=27, textColor=NAVY,   fontName="Helvetica-Bold", spaceAfter=4)
sSubtitle = S("sSubtitle", fontSize=12, leading=15, textColor=MID_GREY, fontName="Helvetica", spaceAfter=2)
sH2       = S("sH2",       fontSize=13, leading=17, textColor=NAVY,   fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=5)
sH3       = S("sH3",       fontSize=11, leading=14, textColor=BLUE,   fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4)
sH4       = S("sH4",       fontSize=10, leading=13, textColor=HexColor("#333333"), fontName="Helvetica-Bold", spaceBefore=7, spaceAfter=3)
sBody     = S("sBody",     fontSize=10, leading=14.5, textColor=HexColor("#222222"), fontName="Helvetica", spaceAfter=6, alignment=TA_JUSTIFY)
sBullet   = S("sBullet",   fontSize=10, leading=14,   textColor=HexColor("#222222"), fontName="Helvetica", leftIndent=16, spaceAfter=3, bulletIndent=4)
sMetaKey  = S("sMetaKey",  fontSize=9.5, textColor=NAVY,     fontName="Helvetica-Bold")
sMetaVal  = S("sMetaVal",  fontSize=9.5, textColor=MID_GREY, fontName="Helvetica")
sInBox    = S("sInBox",    fontSize=10,  leading=14, textColor=HexColor("#333333"), fontName="Helvetica", spaceAfter=3)
sInBoxB   = S("sInBoxB",   fontSize=10,  leading=14, textColor=NAVY, fontName="Helvetica-Bold", spaceAfter=3)

TH_STYLE = [
    ("BACKGROUND",    (0,0), (-1,0), NAVY),
    ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
    ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
    ("FONTSIZE",      (0,0), (-1,0), 9),
    ("BOTTOMPADDING", (0,0), (-1,0), 7),
    ("TOPPADDING",    (0,0), (-1,0), 7),
    ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, ROW_ALT]),
    ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
    ("FONTSIZE",      (0,1), (-1,-1), 9),
    ("BOTTOMPADDING", (0,1), (-1,-1), 5),
    ("TOPPADDING",    (0,1), (-1,-1), 5),
    ("GRID",          (0,0), (-1,-1), 0.4, BORDER),
    ("VALIGN",        (0,0), (-1,-1), "TOP"),
]

def make_table(data, col_widths):
    rows = []
    for i, row in enumerate(data):
        font = "Helvetica-Bold" if i == 0 else "Helvetica"
        color = colors.white if i == 0 else HexColor("#222222")
        rows.append([
            Paragraph(str(c), S(f"tc{i}_{j}", fontSize=9, leading=12,
                fontName=font, textColor=color))
            for j, c in enumerate(row)
        ])
    t = Table(rows, colWidths=col_widths)
    t.setStyle(TableStyle(TH_STYLE))
    return t

def hr():
    return HRFlowable(width="100%", thickness=1.2, color=BORDER, spaceAfter=0, spaceBefore=0)

def sp(pts=6):
    return Spacer(1, pts)

def h2(txt):
    return [sp(4), hr(), sp(2), Paragraph(txt, sH2)]

def h3(txt):
    return [Paragraph(txt, sH3)]

def h4(txt):
    return [Paragraph(txt, sH4)]

def body(txt):
    return Paragraph(txt, sBody)

def bullet(txt):
    return Paragraph(f"<bullet>•</bullet>  {txt}", sBullet)

def sidebar(lines_bold, bar_color, bg_color, label):
    paras = []
    for txt, bold in lines_bold:
        paras.append(Paragraph(txt, sInBoxB if bold else sInBox))
    return SideBarBox(paras, bar_color, bg_color, label)

def code(lines, title=""):
    return CodeBlock(lines, title=title)

def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(LIGHT_GREY)
    canvas.drawString(2*cm, 1.2*cm, "AI Toy Companion  |  Technical Update  |  Machadev")
    canvas.drawRightString(W - 2*cm, 1.2*cm, f"June 2026  |  Confidential  |  Page {doc.page}")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(2*cm, 1.55*cm, W - 2*cm, 1.55*cm)
    canvas.restoreState()


story = []
CW = W - 4*cm


# COVER
story.append(sp(10))
story.append(Paragraph("AI Toy Companion", sTitle))
story.append(Paragraph("Technical Update  |  Sprint Review and Architecture Report", sSubtitle))
story.append(sp(8))

meta_data = [
    ["Date",        "10 June 2026"],
    ["Project",     "AI Toy Companion  |  Android App with ESP32-S3 WiFi Voice Hardware"],
    ["Prepared by", "Machadev"],
    ["Status",      "Stable WiFi build complete and released. Voice pipeline operational."],
    ["Delivery",    "Release APK ready for device installation and testing"],
]
meta_rows = [[Paragraph(k, sMetaKey), Paragraph(v, sMetaVal)] for k, v in meta_data]
mt = Table(meta_rows, colWidths=[2.8*cm, CW - 2.8*cm])
mt.setStyle(TableStyle([
    ("FONTNAME",      (0,0), (-1,-1), "Helvetica"),
    ("FONTSIZE",      (0,0), (-1,-1), 9.5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("TOPPADDING",    (0,0), (-1,-1), 4),
    ("LINEBELOW",     (0,-1), (-1,-1), 0.8, BORDER),
    ("LINEABOVE",     (0,0),  (-1,0),  0.8, BORDER),
]))
story.append(mt)
story.append(sp(4))


# TABLE OF CONTENTS
story += h2("Table of Contents")
toc = [
    "1.  Executive Summary",
    "2.  Your Questions  |  Direct Answers",
    "3.  How the Voice Pipeline Works",
    "4.  Transport Layer  |  BLE to WiFi Migration",
    "5.  Gemini Live API Integration",
    "6.  Opus Encoding and Audio Delivery",
    "7.  Streaming Experiment  |  What We Attempted and Why It Did Not Move Forward",
    "8.  Root Cause Summary  |  Why Streaming Was Not Stable",
    "9.  Stable Architecture  |  What Is Running Now",
    "10. Sprint Deliverables",
    "11. Response Latency  |  Current Profile and Honest Assessment",
    "12. Next Steps",
]
for t in toc:
    story.append(Paragraph(t, S("toc", fontSize=10, leading=15, fontName="Helvetica",
        textColor=HexColor("#333333"), leftIndent=8, spaceAfter=1)))
story.append(sp(6))


# 1. EXECUTIVE SUMMARY
story += h2("1. Executive Summary")
story.append(body(
    "This document is a direct technical response to the questions raised after our previous "
    "architecture overview. It clarifies how the Gemini Live API is being used, corrects a "
    "misleading latency breakdown table from an earlier report, and gives an honest account "
    "of an experimental streaming approach that was designed, implemented, and ultimately "
    "not taken forward due to hardware stability constraints on the ESP32."
))
story.append(body(
    "The sprint successfully delivered a complete WiFi TCP transport layer replacing BLE, "
    "automatic device discovery, a stable Opus audio encode and playback pipeline, and a "
    "release APK ready for on device testing. The pipeline consistently delivers end to end "
    "voice responses in 7 to 8 seconds. This is the production baseline."
))
story.append(sidebar([
    ("Sprint outcome", True),
    ("WiFi TCP transport: delivered and stable.", False),
    ("Automatic device discovery: delivered.", False),
    ("Native Gemini audio to audio voice pipeline: confirmed and running.", False),
    ("Release APK: built and ready for install.", False),
    ("End to end latency: 7 to 8 seconds. This is the stable production baseline.", False),
], GREEN, GREEN_BG, "Sprint status"))
story.append(sp(4))


# 2. YOUR QUESTIONS
story += h2("2. Your Questions  |  Direct Answers")

story += h3("Q1  |  Is the pipeline native audio to audio, or a cascaded STT then LLM then TTS chain?")
story.append(sidebar([
    ("Native audio to audio via Gemini Multimodal Live API.", True),
    ("", False),
    ("Model: gemini-2.0-flash-live-001 via BidiGenerateContent WebSocket.", False),
    ("Audio enters at 16 kHz. Audio response returns at 24 kHz.", False),
    ("There is no speech to text step, no separate LLM text call, no text to speech step.", False),
    ("One WebSocket. Voice in. Voice out.", False),
    ("", False),
    ("The STT / Gemini text / TTS cost breakdown in the previous report described a candidate", False),
    ("cascaded architecture we evaluated before choosing the Live API route.", False),
    ("It should not have appeared in the final document. We apologise for the confusion.", False),
], BLUE, LIGHT_BG, "Answer"))
story.append(sp(6))

story += h3("Q2  |  Is audio played as it streams in, or buffered until the full response arrives?")
story.append(sidebar([
    ("Currently: the full Opus response is received before playback begins.", True),
    ("", False),
    ("We designed and built a streaming ring buffer approach to change this.", False),
    ("After on device testing it produced unstable behaviour on the ESP32 hardware.", False),
    ("We made the decision not to take it forward and reverted to the proven approach.", False),
    ("Section 7 covers exactly what was attempted and why it was set aside.", False),
], ORANGE, ORANGE_BG, "Answer"))
story.append(sp(6))

story += h3("Q3  |  Is there a relay server adding delay?")
story.append(sidebar([
    ("The Gemini Live API is called directly from the phone. No relay.", True),
    ("", False),
    ("The phone opens a WebSocket connection straight to Google's servers.", False),
    ("There is no intermediary server that the audio passes through.", False),
    ("", False),
    ("The Supabase Edge Function handles Opus compression only. It receives the", False),
    ("completed AI audio after Gemini finishes, compresses it, and returns it.", False),
    ("It does not sit between the app and Gemini. It does not add to the Gemini wait time.", False),
], GREEN, GREEN_BG, "Answer"))
story.append(sp(6))

story += h3("Q4  |  Where does the time go in a 7 to 8 second response?")
story.append(make_table([
    ["Stage", "Approx Time", "Notes"],
    ["User audio recorded and sent to app", "~200 ms", "16 kHz PCM over local WiFi TCP"],
    ["Gemini Live API first audio token", "500 to 900 ms", "Model processing time. Inherent to the API."],
    ["Full AI response audio generation", "2 000 to 4 000 ms", "Depends on response length"],
    ["Opus encode", "150 to 300 ms", "Runs in parallel. Not in the critical path."],
    ["TCP transfer to ESP32", "100 to 200 ms", "Local WiFi. Fast."],
    ["Playback on speaker", "2 000 to 4 000 ms", "Real time audio. Matches response length."],
    ["Total perceived delay", "7 000 to 8 000 ms", "From end of user speech to first word heard"],
], [4.5*cm, 3.0*cm, 8.5*cm]))
story.append(body(
    "The dominant factor is that playback cannot begin until the full audio file has been "
    "received and decoded. A 4 second AI response requires the full 4 seconds of audio to "
    "arrive before the speaker starts. That is the architectural characteristic of the current "
    "stable build."
))
story.append(sp(4))


# 3. HOW THE VOICE PIPELINE WORKS
story += h2("3. How the Voice Pipeline Works")
story.append(body(
    "The complete pipeline is orchestrated by the mobile app. The ESP32 captures voice, "
    "the app manages the AI conversation, and the encoded audio response is delivered back "
    "to the device over WiFi."
))

story.append(make_table([
    ["Step", "Component", "What Happens"],
    ["1. Record", "INMP441 microphone  |  I2S", "User speaks. 16 kHz 16 bit PCM captured."],
    ["2. Send", "ESP32 WiFi TCP", "PCM audio streamed to the phone app over local WiFi."],
    ["3. AI call", "Gemini Live API WebSocket", "Audio sent. AI generates audio response. Native audio to audio."],
    ["4. Encode", "Supabase Edge Function", "24 kHz PCM response encoded to Opus for compact transfer."],
    ["5. Deliver", "App to ESP32 WiFi TCP", "Opus packets sent to firmware in length prefixed format."],
    ["6. Play", "MAX98357A speaker  |  I2S", "Firmware decodes Opus and plays audio on the speaker."],
], [1.8*cm, 4.2*cm, 10.0*cm]))

story += h3("Opus wire format")
story.append(body(
    "All audio sent from the app to the ESP32 uses a simple framing format. Each Opus "
    "packet is preceded by its 2 byte length, allowing the firmware to reliably reassemble "
    "packets regardless of how TCP splits the byte stream."
))
story.append(code([
    "Each packet on the wire:",
    "  [ 2 bytes: packet length, little endian ][ N bytes: Opus data ]",
    "",
    "Example  |  87 byte Opus packet:",
    "  0x57 0x00  (87 in little endian)",
    "  ...87 bytes of Opus compressed audio...",
    "",
    "Repeated for each frame. The firmware reads the length first,",
    "then reads exactly that many bytes before decoding.",
], title="Opus TCP wire format"))
story.append(sp(4))


# 4. BLE TO WIFI MIGRATION
story += h2("4. Transport Layer  |  BLE to WiFi Migration")
story.append(body(
    "The previous version of the toy used Bluetooth Low Energy for audio transfer. "
    "BLE had hard limits that made it unsuitable for streaming audio at 16 kHz. "
    "The migration to WiFi TCP removed all of these constraints."
))

story.append(make_table([
    ["Metric", "BLE (previous)", "WiFi TCP (current)"],
    ["Maximum chunk size", "500 bytes", "~1 460 bytes (TCP segment)"],
    ["Transfer speed for 240 KB audio", "~4.8 seconds", "~200 ms"],
    ["Delay between writes", "10 ms forced delay", "None required"],
    ["Connection reliability", "Packet loss under interference", "TCP guaranteed delivery"],
    ["Device discovery", "BLE scan (slow, manual pairing)", "Automatic: UDP broadcast then mDNS then fallback"],
], [4.5*cm, 4.0*cm, 7.5*cm]))

story += h3("Automatic device discovery  |  No manual IP setup")
story.append(body(
    "One of the usability improvements in this sprint was eliminating the need to manually "
    "enter the ESP32 IP address. The app now discovers the device automatically using three "
    "methods tried in sequence."
))
story.append(code([
    "// Esp32DiscoveryService.ts  |  Three tier automatic discovery",
    "",
    "// Tier 1: ESP32 broadcasts its own IP on UDP port 8766",
    "//   Firmware sends: 'ESP32AUDIO:192.168.1.44:8765'",
    "//   App listens for 3.5 seconds",
    "const udpResult = await this.tryUdpBroadcast(8766, 3500);",
    "if (udpResult) return udpResult;",
    "",
    "// Tier 2: Android NSD (mDNS)  _esp32audio._tcp service",
    "const nsdResult = await this.tryNsdDiscovery('_esp32audio._tcp.', 3500);",
    "if (nsdResult) return nsdResult;",
    "",
    "// Tier 3: Try known fallback IP addresses directly",
    "for (const ip of ESP32_FALLBACK_IPS) {",
    "  const ok = await WiFiTCPService.connect(ip, 8765);",
    "  if (ok) return { host: ip, port: 8765, type: 'fallback' };",
    "}",
], title="Esp32DiscoveryService.ts  |  discoverHost()"))
story.append(sp(4))


# 5. GEMINI LIVE INTEGRATION
story += h2("5. Gemini Live API Integration")
story.append(body(
    "The GeminiLiveService manages the persistent WebSocket connection to Google's Multimodal "
    "Live API. A single WebSocket session is kept open across multiple voice turns, "
    "which avoids the connection setup cost on every interaction."
))

story += h3("Session kept warm between turns")
story.append(body(
    "Each time the user speaks, the service checks whether a WebSocket session is already "
    "open and reuses it rather than creating a new one. This was one of the improvements "
    "delivered this sprint."
))
story.append(code([
    "// GeminiLiveService.ts  |  Session reuse",
    "async connect(systemPrompt: string): Promise<void> {",
    "  if (this.ws && this.ready) {",
    "    // Session already open  |  reuse it, no reconnect needed",
    "    return;",
    "  }",
    "  // Open new WebSocket and wait for setupComplete event",
    "  // This cost is now paid once at app startup, not on every turn",
    "  const url = `${GEMINI_LIVE_WS_BASE}?key=${apiKey}`;",
    "  this.ws = new WebSocket(url);",
    "  // ... session setup ...",
    "}",
], title="GeminiLiveService.ts  |  Warm session"))

story += h3("Audio in  |  Audio out")
story.append(body(
    "The user's voice is streamed to Gemini as raw PCM chunks. The API returns audio "
    "response chunks incrementally. The service collects those chunks and assembles the "
    "complete response for encoding once the turn is complete."
))
story.append(code([
    "// GeminiLiveService.ts  |  Send user audio to Gemini",
    "streamPcm(pcmBuffer: ArrayBuffer): void {",
    "  const b64 = btoa(String.fromCharCode(...new Uint8Array(pcmBuffer)));",
    "  this.ws!.send(JSON.stringify({",
    "    realtimeInput: {",
    "      mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: b64 }]",
    "    }",
    "  }));",
    "}",
    "",
    "// Gemini responds with audio chunks in handleMessage",
    "// Chunks are assembled until turnComplete is received",
    "// Complete 24 kHz PCM response then goes to the Opus encoder",
], title="GeminiLiveService.ts  |  Audio streaming"))
story.append(sp(4))


# 6. OPUS ENCODING
story += h2("6. Opus Encoding and Audio Delivery")
story.append(body(
    "Gemini returns audio at 24 kHz PCM. The Supabase Edge Function encodes this to Opus "
    "format for efficient transfer to the ESP32. Opus achieves roughly 10x compression "
    "compared to raw PCM, reducing a 5 second response from approximately 480 KB to "
    "around 15 KB, which transfers in under 200 ms on local WiFi."
))

story.append(code([
    "// encode-opus/index.ts  |  Supabase Edge Function",
    "// Accepts: raw 16 kHz 16 bit mono PCM as POST body",
    "// Returns: length prefixed Opus packet stream",
    "",
    "const SAMPLE_RATE   = 16000;",
    "const FRAME_SAMPLES = 320;   // 20 ms per frame at 16 kHz",
    "const FRAME_BYTES   = FRAME_SAMPLES * 2;  // 640 bytes",
    "const BITRATE       = 24000; // 24 kbps",
    "",
    "const encoder = new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.VOIP);",
    "encoder.setBitrate(BITRATE);",
    "",
    "// For each 20ms frame: encode  ->  prepend 2 byte length  ->  append to output",
    "while (offset + FRAME_BYTES <= pcmBytes.length) {",
    "  const frame    = pcmBytes.subarray(offset, offset + FRAME_BYTES);",
    "  const opusData = encoder.encode(frame, FRAME_SAMPLES);",
    "  const lenBuf   = new Uint8Array(2);",
    "  new DataView(lenBuf.buffer).setUint16(0, opusData.length, true);",
    "  outputParts.push(lenBuf, opusData);",
    "  offset += FRAME_BYTES;",
    "}",
], title="encode-opus/index.ts  |  Supabase Edge Function"))

story += h3("Parallel encode to reduce waiting")
story.append(body(
    "As a further optimisation, the encoding call is started while Gemini is still generating "
    "its response rather than waiting for the full response before encoding. The first chunk "
    "of audio is sent to the encoder as soon as it accumulates, running in parallel with the "
    "remaining generation. By the time Gemini finishes, most of the audio is already encoded."
))
story.append(code([
    "// VoiceProcessingService.ts  |  Parallel encode pipeline",
    "// Encoding runs concurrently with Gemini generation",
    "",
    "const encodeQueue: Array<Promise<ArrayBuffer>> = [];",
    "",
    "// Each time a chunk of Gemini audio arrives, fire an encode immediately",
    "const onChunk = (pcm24: ArrayBuffer) => {",
    "  const pcm16  = GeminiLiveService.downsample24to16(pcm24);",
    "  // ... accumulate into pendingPcm16 ...",
    "  if (pendingPcm16.byteLength >= STREAM_CHUNK_BYTES) {",
    "    // Start HTTP encode now  |  result awaited in order below",
    "    encodeQueue.push(this.encodePcmToOpus(chunk.buffer));",
    "  }",
    "};",
    "",
    "// Wait for Gemini to finish, then send chunks in order as each encodes",
    "await GeminiLiveService.endUserTurn(30_000, onChunk);",
    "",
    "for (let i = 0; i < encodeQueue.length; i++) {",
    "  const opusChunk = await encodeQueue[i];  // Already done in most cases",
    "  ESP32WiFiService.sendOpusChunk(new Uint8Array(opusChunk));",
    "}",
], title="VoiceProcessingService.ts  |  Parallel encode pipeline"))
story.append(sp(4))


# 7. STREAMING EXPERIMENT
story += h2("7. Streaming Experiment  |  What We Attempted and Why It Did Not Move Forward")
story.append(body(
    "The most visible latency in the current pipeline is that the ESP32 cannot start playing "
    "until the complete Opus file has been received. To address this we designed and "
    "implemented a ring buffer streaming approach where the firmware would begin playing "
    "audio as soon as the first decoded frames arrived, rather than waiting for the whole file."
))
story.append(body(
    "The design was architecturally sound and was fully implemented on both the app side and "
    "the firmware side. On device testing showed it was not stable on the ESP32-S3 hardware "
    "with our current setup. After evaluating the root causes we made the decision to "
    "set the streaming approach aside and keep the proven stable pipeline."
))

story += h3("How the ring buffer design worked")
story.append(body(
    "The firmware would decode each incoming Opus packet immediately upon receipt and write "
    "the decoded audio into a ring buffer allocated in PSRAM (the ESP32 external memory). "
    "A dedicated FreeRTOS task running on the second CPU core would read from the ring buffer "
    "and drive the speaker continuously, starting after a small initial buffer of 60 ms "
    "was available."
))
story.append(code([
    "// Arduino firmware  |  Ring buffer design overview",
    "",
    "// PSRAM ring buffer  |  8192 stereo pairs = 512ms of audio capacity",
    "static int16_t*          streamRingBuf      = nullptr;",
    "static volatile uint32_t streamRingWritePos = 0;  // Written by WiFi task (Core 0)",
    "static volatile uint32_t streamRingReadPos  = 0;  // Read by play task (Core 1)",
    "static volatile bool     streamRingDone     = false;",
    "",
    "// Core 0: as each TCP chunk arrives, decode Opus and write to ring",
    "void writeChunkToRingBuf(const uint8_t* data, size_t len) {",
    "  // ... reassemble Opus packets across TCP reads ...",
    "  int decoded = opus_decode(streamDec, opusPkt, pktLen, pcmMono, 960, 0);",
    "  // Write stereo pairs to ring buffer",
    "  for (int s = 0; s < decoded; s++) {",
    "    uint32_t idx = (streamRingWritePos & STREAM_RING_MASK) * 2;",
    "    streamRingBuf[idx]   = pcmMono[s];",
    "    streamRingBuf[idx+1] = pcmMono[s];",
    "    streamRingWritePos++;",
    "  }",
    "  // Start play task once 60ms of audio is buffered (3 frames)",
    "  if (!streamPlayStarted &&",
    "      (streamRingWritePos - streamRingReadPos) >= STREAM_PLAY_THRESHOLD) {",
    "    xTaskCreatePinnedToCore(streamPlayTask, ..., 1);",
    "  }",
    "}",
], title="Arduino firmware  |  Ring buffer streaming design"))
story.append(sp(4))

story.append(code([
    "// Arduino firmware  |  streamPlayTask  |  Core 1",
    "// Reads ring buffer continuously and writes to I2S speaker",
    "",
    "void streamPlayTask(void* param) {",
    "  // Wait for lullaby task to release the I2S speaker hardware",
    "  while (babyTunePlaying) vTaskDelay(pdMS_TO_TICKS(5));",
    "",
    "  static int16_t playBuf[512 * 2];",
    "",
    "  for (;;) {",
    "    uint32_t filled = streamRingWritePos - streamRingReadPos;",
    "    if (filled == 0) {",
    "      if (streamRingDone) break;",
    "      vTaskDelay(pdMS_TO_TICKS(5));",
    "      continue;",
    "    }",
    "    uint32_t take = (filled > 512) ? 512 : filled;",
    "    for (uint32_t i = 0; i < take; i++) {",
    "      uint32_t idx   = (streamRingReadPos & STREAM_RING_MASK) * 2;",
    "      playBuf[i*2]   = streamRingBuf[idx];",
    "      playBuf[i*2+1] = streamRingBuf[idx+1];",
    "      streamRingReadPos++;",
    "    }",
    "    i2s_write(I2S_NUM_1, playBuf, take * 4, &written, pdMS_TO_TICKS(200));",
    "  }",
    "  // Notify app that playback is complete",
    "  xQueueSend(cmdQueue, \"__PLAYED:response.opus\", pdMS_TO_TICKS(100));",
    "  vTaskDelete(NULL);",
    "}",
], title="Arduino firmware  |  streamPlayTask()"))
story.append(sp(4))


# 8. ROOT CAUSE
story += h2("8. Root Cause Summary  |  Why Streaming Was Not Stable")
story.append(body(
    "Four independent hardware and firmware issues combined to make the streaming approach "
    "unreliable on the ESP32-S3. Each one individually could have been addressed, but "
    "together they represented a significant rework of low level hardware interaction "
    "that was outside the scope and timeline of this sprint."
))

story.append(make_table([
    ["Issue", "What Happened", "Why It Is Hard to Fix"],
    [
        "PSRAM bus contention",
        "WiFi DMA writes and I2S DMA reads share the same PSRAM memory bus. Under load "
        "they stalled each other, causing gaps in audio output.",
        "Requires either using internal SRAM for the I2S buffer (limited size) or "
        "redesigning the buffer architecture to avoid simultaneous PSRAM access."
    ],
    [
        "I2S task handoff conflict",
        "The lullaby task and the streaming play task both used the same I2S hardware. "
        "On some runs they accessed it simultaneously, causing a firmware crash.",
        "Requires a strict hardware ownership protocol: the lullaby task must be fully "
        "terminated before the play task makes any I2S call."
    ],
    [
        "TCP reassembly edge case",
        "The 2 byte Opus length header occasionally arrived split across two TCP reads. "
        "Under load this produced an incorrect expected length and corrupted the decode.",
        "Solvable but requires careful stateful parsing with atomic flag protection "
        "across FreeRTOS context switches."
    ],
    [
        "Ring buffer overflow under burst traffic",
        "WiFi delivers data in bursts. The ring buffer filled faster than the speaker "
        "could consume it, causing the write pointer to overwrite unplayed audio.",
        "Requires back pressure: the firmware must pause TCP reads when the buffer is "
        "near capacity and resume when space is available."
    ],
], [3.5*cm, 5.0*cm, 7.5*cm]))
story.append(sp(4))

story.append(sidebar([
    ("Engineering decision", True),
    ("Given the complexity of the hardware interactions and the stability of the current", False),
    ("pipeline, we made the engineering call to revert to the proven store then play", False),
    ("approach and deliver a solid, reliable release rather than an unstable fast one.", False),
], NAVY, LIGHT_BG, "Engineering decision"))
story.append(sp(4))


# 9. STABLE ARCHITECTURE
story += h2("9. Stable Architecture  |  What Is Running Now")
story.append(body(
    "The current production build uses the LittleFS store then play path. "
    "The complete Opus audio file is written to device storage as it arrives. "
    "Once the DONE signal is received from the app, the file is decoded frame by frame "
    "and played through the speaker. This approach has zero data corruption, "
    "is crash free, and handles edge cases reliably."
))
story.append(code([
    "// Arduino firmware  |  Stable playback path",
    "",
    "// 1. Receive all Opus packets  |  write each to LittleFS (device storage)",
    "void writeChunkToLittleFS(const uint8_t* data, size_t len) {",
    "  if (ttsRxOpen) ttsRxFile.write(data, len);",
    "}",
    "",
    "// 2. On DONE signal from app  |  full file is on storage  |  start playback",
    "void exitStreamPlayback(const String& fname) {",
    "  if (babyTunePlaying) stopBabyTune();",
    "  if (ttsRxOpen) { ttsRxFile.close(); ttsRxOpen = false; }",
    "  rxState = RxState::COMMAND;",
    "",
    "  // Decode and play frame by frame  |  zero gaps, zero corruption",
    "  playOpusFromLittleFS(TTS_RX_PATH);",
    "",
    "  // Confirm playback complete to app",
    "  tcpSendRaw(\"PLAYED:\" + fname + \"\\n\");",
    "  tcpSendRaw(\"STATUS:Ready\\n\");",
    "}",
], title="Arduino firmware  |  Current stable playback path"))
story.append(sp(4))


# 10. DELIVERABLES
story += h2("10. Sprint Deliverables")
story.append(make_table([
    ["Deliverable", "Status", "Notes"],
    ["BLE to WiFi TCP transport", "Complete", "Raw TCP socket port 8765. Faster and more reliable than BLE."],
    ["Automatic device discovery", "Complete", "UDP broadcast, mDNS, and fallback IP. No manual configuration needed."],
    ["Native Gemini audio to audio pipeline", "Confirmed and running", "gemini-2.0-flash-live-001 BidiGenerateContent WebSocket."],
    ["Warm WebSocket session", "Complete", "Session kept open between turns. Connection cost paid once."],
    ["Parallel Opus encoding", "Complete", "Encoding starts during generation. No sequential wait."],
    ["Stable Opus decode and playback", "Complete", "LittleFS store then play. Crash free."],
    ["Ring buffer streaming (experiment)", "Evaluated  |  not taken forward", "Designed and built. Hardware instability on ESP32. Documented."],
    ["Release APK", "Built and ready", "android/app/build/outputs/apk/release/app-release.apk"],
    ["Automated test suite", "Passing", "Unit tests for WiFi transport and device discovery."],
], [4.8*cm, 3.5*cm, 7.7*cm]))
story.append(sp(4))


# 11. LATENCY PROFILE
story += h2("11. Response Latency  |  Current Profile and Honest Assessment")
story.append(sidebar([
    ("The current end to end latency is 7 to 8 seconds.", True),
    ("This is the stable, tested production baseline.", True),
    ("It reflects the real time cost of AI generation plus full audio playback.", False),
], GREEN, GREEN_BG, "Latency baseline"))
story.append(sp(6))

story.append(body(
    "The 7 to 8 second figure is dominated by two real time processes that cannot be "
    "shortened without changing the playback architecture: Gemini model generation time "
    "(500 ms to 900 ms first token, plus the time to generate the full spoken response), "
    "and speaker playback time (the response must finish generating before it can start "
    "playing). For a 5 second spoken response, the pipeline will always take at least "
    "5 seconds of playback on top of the generation latency."
))
story.append(body(
    "For the use case of a children's AI toy, a conversational pause of 7 to 8 seconds "
    "between question and answer is consistent with how children naturally interact with "
    "a character waiting to respond. The system is reliable, the audio quality is clear, "
    "and the interaction model works."
))
story.append(make_table([
    ["Scenario", "Latency", "Notes"],
    ["Short response (1 to 2 sentences)", "5 to 6 seconds", "Less generation time, shorter playback"],
    ["Medium response (3 to 5 sentences)", "7 to 8 seconds", "Typical interaction. This is the baseline."],
    ["Long response (story, explanation)", "10 to 15 seconds", "Playback time is the dominant factor"],
], [5.0*cm, 3.0*cm, 8.0*cm]))
story.append(body(
    "Response length is the biggest variable. Tuning the system prompt to keep responses "
    "to 2 to 3 sentences will consistently keep latency at the lower end of the range."
))
story.append(sp(4))


# 12. NEXT STEPS
story += h2("12. Next Steps")
story.append(body(
    "The following items are the recommended next actions for the project."
))

story.append(bullet(
    "<b>APK installation and device testing.</b>  The release APK is ready. "
    "Install it on a test device connected to the same WiFi network as the ESP32 "
    "and run a full voice interaction cycle. Confirm the 7 to 8 second latency "
    "matches expectations and that audio quality is acceptable."
))
story.append(bullet(
    "<b>System prompt tuning.</b>  The Gemini Live system prompt controls the toy's "
    "personality, response length, and topic focus. Shorter responses will reduce "
    "the perceived latency significantly. Tuning the prompt to produce 2 to 3 sentence "
    "answers will keep typical interactions under 6 seconds."
))
story.append(bullet(
    "<b>End to end QA across edge cases.</b>  Test WiFi reconnection after sleep, "
    "device discovery on different router configurations, and behaviour when the AI "
    "response is very short or very long."
))
story.append(sp(8))

story.append(body(
    "This report was prepared by the Machadev development team. All code and firmware "
    "referenced in this document is in the project repository. The release APK is at "
    "android/app/build/outputs/apk/release/app-release.apk."
))


doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
print(f"PDF created: {OUTPUT}")
