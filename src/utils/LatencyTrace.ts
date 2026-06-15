/**
 * LatencyTrace — per-turn latency instrumentation.
 *
 * One trace per voice turn, started at the moment the user stops speaking
 * (STREAM_END from the firmware / button release). Every pipeline stage calls
 * mark() and the trace emits a `LAT|` log line with the millisecond offset
 * from turn start. finish() emits a single-line summary so an on-device test
 * run produces a stage-by-stage timing table straight from the logs.
 *
 * Expected stages per turn:
 *   turn_start            user released the button (STREAM_END received)
 *   activity_end_sent     end-of-speech signal sent to Gemini
 *   gemini_first_audio    first audio chunk back from Gemini (model TTFT)
 *   first_opus_sent       first encoded chunk handed to the ESP32
 *   gemini_turn_complete  Gemini finished generating
 *   done_sent             end-of-stream sentinel sent to the ESP32
 *   played_received       firmware confirmed playback complete
 */
class LatencyTrace {
  private t0 = 0;
  private marks: Array<{ stage: string; ms: number }> = [];
  private active = false;

  /** Begin a new turn. Resets any in-flight trace. */
  start(): void {
    this.t0 = Date.now();
    this.marks = [];
    this.active = true;
    console.log('LAT|turn_start +0ms');
  }

  /** Record a stage. No-op when no turn is active or stage already marked. */
  mark(stage: string): void {
    if (!this.active) return;
    if (this.marks.some(m => m.stage === stage)) return;
    const ms = Date.now() - this.t0;
    this.marks.push({ stage, ms });
    console.log(`LAT|${stage} +${ms}ms`);
  }

  /** Mark the final stage and emit the one-line summary for this turn. */
  finish(finalStage = 'played_received'): void {
    if (!this.active) return;
    this.mark(finalStage);
    const summary = this.marks.map(m => `${m.stage}=${m.ms}ms`).join(' ');
    console.log(`LAT|summary ${summary}`);
    this.active = false;
  }

  /** Abandon the current turn (error/abort paths). */
  cancel(reason: string): void {
    if (!this.active) return;
    console.log(`LAT|cancelled +${Date.now() - this.t0}ms reason=${reason}`);
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }
}

export default new LatencyTrace();
