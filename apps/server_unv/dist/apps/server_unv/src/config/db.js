import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../../../../packages/db-schema";
import dotenv from "dotenv";
dotenv.config();
// Gunakan password "ALMA_password" sesuai docker-compose Anda
const connectionString = process.env.DATABASE_URL ||
    "postgres://postgres:ALMA_password@localhost:5432/ALMA_erp";
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
export const db = drizzle(pool, { schema });
