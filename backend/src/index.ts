import { createApp } from "./app.js";
import { config } from "./core/config.js";

/** Bootstrap the backend: build the app and listen on the configured port. */
const app = createApp();

app.listen(config.port, () => {
  console.log(`Speak Plainly backend listening on http://localhost:${config.port}`);
});
