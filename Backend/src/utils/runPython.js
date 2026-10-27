import { spawn } from "child_process";

/**
 * Runs a Python script and resolves once it exits.
 * Never rejects: spawn failures (e.g. python not installed) are reported as code -1.
 * stderr is collected separately, because libraries such as TensorFlow write
 * warnings there even when the script succeeds.
 */
export const runPython = (scriptPath, args = [], options = {}) =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (code) => {
      if (settled) return;
      settled = true;
      stdout = stdout.trim();
      resolve({
        code,
        stdout,
        // Scripts print their result last; earlier lines may be library noise
        lastLine: stdout.split(/\r?\n/).pop().trim(),
        stderr: stderr.trim(),
      });
    };

    // "python" on Windows, "python3" elsewhere; set PYTHON to use a specific interpreter (e.g. a venv)
    const pythonCmd = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
    const python = spawn(pythonCmd, [scriptPath, ...args], options);

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("error", (err) => {
      stderr += `\nFailed to start python: ${err.message}`;
      finish(-1);
    });

    python.on("close", (code) => finish(code));
  });
