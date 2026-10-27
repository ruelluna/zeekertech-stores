export async function register() {
  // Only the Node.js server runs the background worker (not the edge runtime or the build).
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startWorker } = await import("./lib/worker");
    startWorker();
  }
}
