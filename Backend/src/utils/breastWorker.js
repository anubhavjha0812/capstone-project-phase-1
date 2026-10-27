import { spawn } from "child_process";

/**
 * Keeps one Python process alive for the breast model, so the 330 MB ViT is loaded once
 * (at the first request) instead of on every upload. Requests are answered one at a time.
 */
export const createWorker = (scriptPath, { timeoutMs = 180000 } = {}) => {
  let proc = null;
  let buffer = "";
  let pending = null; // { resolve, timer }
  let chain = Promise.resolve();
  let lastStderr = "";

  const pythonCmd = () => process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

  const settle = (value) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const { resolve } = pending;
    pending = null;
    resolve(value);
  };

  const start = () => {
    proc = spawn(pythonCmd(), [scriptPath, "--serve"]);
    buffer = "";
    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // library noise on stdout
        }
        if ("ready" in msg) continue; // startup line, not an answer
        settle(msg);
      }
    });
    proc.stderr.on("data", (d) => {
      lastStderr = (lastStderr + d.toString()).slice(-2000);
    });
    const onGone = () => {
      proc = null;
      settle({ error: "worker_failed", detail: lastStderr });
    };
    proc.on("error", onGone);
    proc.on("close", onGone);
  };

  const ask = (imagePath) =>
    new Promise((resolve) => {
      if (!proc) start();
      const timer = setTimeout(() => {
        proc?.kill();
        settle({ error: "worker_failed", detail: "timeout" });
      }, timeoutMs);
      pending = { resolve, timer };
      proc.stdin.write(`${imagePath}\n`);
    });

  // Never rejects; resolves to the JSON object printed by the script
  return (imagePath) => {
    const run = chain.then(() => ask(imagePath));
    chain = run.catch(() => {});
    return run;
  };
};
