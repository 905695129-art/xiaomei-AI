import assert from "node:assert/strict";
import { isEmailDeliveryConfigured } from "../src/lib/email.ts";

const original = {
  provider: process.env.EMAIL_PROVIDER,
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
  appUrl: process.env.APP_URL,
  nodeEnv: process.env.NODE_ENV
};

try {
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.EMAIL_FROM = "Heart Studio <hello@example.test>";
  process.env.APP_URL = "https://heart.example.test";
  process.env.NODE_ENV = "test";

  delete process.env.EMAIL_PROVIDER;
  assert.equal(isEmailDeliveryConfigured(), false, "email must remain disabled when provider is not explicitly selected");

  process.env.EMAIL_PROVIDER = "disabled";
  assert.equal(isEmailDeliveryConfigured(), false, "disabled provider must fail closed even with Resend credentials present");

  process.env.EMAIL_PROVIDER = "resend";
  assert.equal(isEmailDeliveryConfigured(), true, "explicit Resend selection with valid settings should configure email");

  process.env.EMAIL_PROVIDER = "unknown-provider";
  assert.equal(isEmailDeliveryConfigured(), false, "unknown providers must fail closed");
  console.log("PASS: transactional email defaults to disabled and only enables an explicitly selected supported provider.");
} finally {
  for (const [key, value] of Object.entries({
    EMAIL_PROVIDER: original.provider,
    RESEND_API_KEY: original.apiKey,
    EMAIL_FROM: original.from,
    APP_URL: original.appUrl,
    NODE_ENV: original.nodeEnv
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
