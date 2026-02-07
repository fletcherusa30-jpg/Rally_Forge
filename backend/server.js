import { connectToMongo } from "./database/mongo.js";
import { createApp } from "./app.js";

const app = createApp();

const port = Number(process.env.PORT || 4000);

connectToMongo()
  .then(() => {
    app.listen(port, () => {
      console.log(`Rally Forge API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
