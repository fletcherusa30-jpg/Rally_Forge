import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";

const app = createApp();

test("GET /api/health returns ok", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.status, "ok");
  assert.ok(response.headers["x-request-id"]);
});

test("Unknown API route returns structured 404", async () => {
  const response = await request(app).get("/api/unknown");
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "not_found");
});
