import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../../../../packages/db-schema/index.js";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();
// Gunakan password "ALMA_password" sesuai docker-compose Anda
const connectionString = process.env.DATABASE_URL ||
    "postgres://postgres:alma_password@localhost:5432/alma_erp";
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
export const db = drizzle(pool, { schema });
