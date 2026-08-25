import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';

loadEnvConfig(process.cwd());

function normalizeUrl(value: string | undefined, { direct = false } = {}) {
  const url = value?.trim().replace(/^['"]|['"]$/g, '');

  if (!url) {
    throw new Error('DATABASE_URL is required for Drizzle.');
  }

  return direct ? url.replace('-pooler.', '.') : url;
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: normalizeUrl(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL, {
      direct: !process.env.DATABASE_URL_UNPOOLED,
    }),
  },
  strict: true,
  verbose: true,
});
