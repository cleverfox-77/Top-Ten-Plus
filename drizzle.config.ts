import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Load local secrets (Neon connection string) for CLI commands.
config({ path: '.env.local' })

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true
})
