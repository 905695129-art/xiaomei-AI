type TransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.APP_URL;
  if (!apiKey || !from || !appUrl) return null;
  let parsed: URL;
  try { parsed = new URL(appUrl); } catch { return null; }
  if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:")) return null;
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== "/" && parsed.pathname !== "")) return null;
  return { apiKey, from, appUrl: parsed.origin };
}

export function isEmailDeliveryConfigured() {
  return emailConfig() !== null;
}

/** Returns a validated origin for links sent in transactional email. */
export function getPublicAppBaseUrl() {
  const value = process.env.APP_URL;
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.pathname !== "/" && parsed.pathname !== "") return null;
    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:")) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] as string);
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  const config = emailConfig();
  if (!config) throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    // Do not leak provider response bodies or credentials into application logs.
    throw new Error(response.status === 429 ? "EMAIL_PROVIDER_RATE_LIMITED" : "EMAIL_DELIVERY_FAILED");
  }
  return response.json() as Promise<{ id?: string }>;
}
