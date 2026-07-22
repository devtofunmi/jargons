import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { getEnv } from '../server/env'
import * as schema from './schema'

const client = postgres(getEnv('DATABASE_URL'), {
  max: 10,
  prepare: false,
})

// Raw postgres-js client, for the occasional analytical query that is clearer
// as tagged-template SQL than through the ORM.
export const sqlClient = client

export const db = drizzle(client, { schema })
export type Database = typeof db
