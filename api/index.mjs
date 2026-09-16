// Vercel serverless entry point. Wraps the already-compiled Express app
// (built by `npm run build:backend` as part of the Vercel buildCommand)
// rather than letting Vercel's own bundler compile backend/src/*.ts from
// scratch — this way the exact same dist/ output that `node dist/server.js`
// runs locally is what runs in production, just without the app.listen()
// call (Vercel owns the socket).
import { createApp } from "../backend/dist/app.js";

export default createApp();
