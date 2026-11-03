// Server-only configuration. Every secret is read from the environment; nothing is hard-coded.

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  tatumKey: () => need("TATUM_API_KEY"),
  memwalKey: () => need("MEMWAL_PRIVATE_KEY"),
  memwalAccountId: () => need("MEMWAL_ACCOUNT_ID"),
  memwalServerUrl: () => process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz",
  telegramToken: () => need("TELEGRAM_BOT_TOKEN"),
  telegramWebhookSecret: () => process.env.TELEGRAM_WEBHOOK_SECRET || "",
  botUsername: () => process.env.TELEGRAM_BOT_USERNAME || "finder_matching_bot",
  appSecret: () => need("APP_SECRET"),
  cronSecret: () => process.env.CRON_SECRET || "",
  appUrl: () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  databaseUrl: () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  publicFeedUser: () => process.env.PUBLIC_FEED_USER || "",
  // Off by default: club crests are club trademarks; turn on only once their use has been cleared.
  officialCrests: () => process.env.OFFICIAL_CRESTS === "1",
};

// Mainnet constants observed on 2026-11-02 (relayer /config and on-chain reads via Tatum).
export const MEMWAL_PACKAGE = "0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5";
export const WALRUS_BLOB_TYPE = "0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob";
