import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from '@/db/schema';

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim().replace(/^['"]|['"]$/g, '');

  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }

  return url;
}

const client = neon(getDatabaseUrl());

export const db = drizzle(client, { schema });
