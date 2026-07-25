import test from "node:test";
import assert from "node:assert/strict";
import { verifySocketAuth } from "../src/routes/middleware.js";

test("verifySocketAuth accepts the demo token", async () => {
  const identity = await verifySocketAuth("demo");
  assert.ok(identity, "demo token should resolve to an authenticated identity");
  assert.equal(identity.firebaseUid, "demo");
  assert.ok(Number.isInteger(identity.userId));
});
