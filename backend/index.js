import express from "express";

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

import scannerRoute from "../Scanner/VA SCANNER/backend/scannerRoute.js";
app.use("/api", scannerRoute);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
