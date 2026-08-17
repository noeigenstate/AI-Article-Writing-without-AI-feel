import { createServer } from "node:net";

const preferredPort = Number(process.argv[2] ?? "51773");
const maxPort = preferredPort + 100;

function isAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

for (let port = preferredPort; port <= maxPort; port += 1) {
  if (await isAvailable(port)) {
    console.log(port);
    process.exit(0);
  }
}

console.error(`No available frontend port between ${preferredPort} and ${maxPort}.`);
process.exit(1);
