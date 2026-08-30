// File: apps/server_unv/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load .env dari root maupun lokal
dotenv.config({ path: "../../.env" });
dotenv.config();

export default defineConfig({
  schema: [
    "../../packages/db-schema/index.ts",
    "../../modules/*/src/server/schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
