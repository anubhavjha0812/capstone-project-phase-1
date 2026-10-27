// Must be the first import: app.js reads process.env (e.g. CORS_ORIGIN) when it loads
import "dotenv/config";
import connectDB from "./db/index.js";
import { app } from "./app.js";

const port = process.env.PORT || 8080;

// Start accepting requests immediately; controllers fall back to local file
// storage until (or unless) MongoDB connects.
const server = app.listen(port, () => {
  console.log(`Server is running at port : ${port}`);
});

// When nodemon restarts the server, the previous process can still be holding
// the port for a moment. Retry for up to ~10 seconds instead of crashing.
const MAX_PORT_RETRIES = 10;
let portRetries = 0;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && portRetries < MAX_PORT_RETRIES) {
    portRetries += 1;
    console.warn(`Port ${port} is busy, retrying (${portRetries}/${MAX_PORT_RETRIES})...`);
    setTimeout(() => server.listen(port), 1000);
    return;
  }
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Please terminate the process using it.`);
  } else {
    console.error("Server error:", error);
  }
  // Exit so nodemon reports the crash instead of leaving a process that isn't listening
  process.exit(1);
});

connectDB();

const shutdown = () => {
  server.close(() => process.exit(0));
  // Don't wait forever on open keep-alive connections
  setTimeout(() => process.exit(0), 2000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
