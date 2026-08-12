// Lazily load the Drizzle client, schema, and query helpers together, so server
// functions don't repeat the same three dynamic imports. Everything heavy is
// still imported dynamically here, preserving the lazy-loading the call sites
// relied on.
//
// The returned object spreads drizzle-orm's helpers (eq, and, sql, desc, …) and
// the schema tables/enums, and also exposes `db`, the raw `sqlClient`, and the
// full `schema` namespace — so existing call sites can keep destructuring the
// exact names they already used.
export async function loadDb() {
  const [orm, client, schema] = await Promise.all([
    import('drizzle-orm'),
    import('./client'),
    import('./schema'),
  ])

  return {
    ...orm,
    ...schema,
    schema,
    db: client.db,
    sqlClient: client.sqlClient,
  }
}
