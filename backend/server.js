import { fileURLToPath } from "node:url";
import { connectToMongo } from "./database/mongo.js";
import { createApp } from "./app.js";

const app = createApp();

const port = Number(process.env.PORT || 4000);

const __filename = fileURLToPath(import.meta.url);

connectToMongo()
  .then(() => {
    app.listen(port, () => {
      console.log(`Rally Forge API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize storage", error);
    app.listen(port, () => {
      console.log(`Rally Forge API listening on port ${port}`);
    });
  });
