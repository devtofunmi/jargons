import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const installationStatus = pgEnum('installation_status', [
  'active',
  'suspended',
  'deleted',
])

export const repositoryStatus = pgEnum('repository_status', [
  'watching',
  'needs_setup',
  'paused',
])

export const reviewRunStatus = pgEnum('review_run_status', [
  'queued',
  'running',
  'complete',
  'failed',
])

export const findingSeverity = pgEnum('finding_severity', [
  'critical',
  'high',
  'medium',
  'low',
  'note',
])

export const scanStatus = pgEnum('scan_status', [
  'queued',
  'running',
  'complete',
  'failed',
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    githubId: text('github_id').notNull(),
    username: text('username').notNull(),
    name: text('name'),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    githubIdIdx: uniqueIndex('users_github_id_idx').on(table.githubId),
  }),
)

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const workspaceSettings = pgTable('workspace_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  reviewPullRequests: boolean('review_pull_requests').notNull().default(true),
  reviewSecurity: boolean('review_security').notNull().default(true),
  reviewCodebaseScans: boolean('review_codebase_scans')
    .notNull()
    .default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const githubInstallations = pgTable(
  'github_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    installationId: text('installation_id').notNull(),
    accountLogin: text('account_login').notNull(),
    accountType: text('account_type').notNull(),
    status: installationStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    installationIdx: uniqueIndex('github_installations_installation_id_idx').on(
      table.installationId,
    ),
  }),
)

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    githubRepoId: text('github_repo_id').notNull(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    defaultBranch: text('default_branch').notNull().default('main'),
    language: text('language'),
    status: repositoryStatus('status').notNull().default('watching'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceRepoIdx: uniqueIndex('repositories_workspace_repo_idx').on(
      table.workspaceId,
      table.githubRepoId,
    ),
  }),
)

export const pullRequests = pgTable('pull_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  repositoryId: uuid('repository_id')
    .notNull()
    .references(() => repositories.id, { onDelete: 'cascade' }),
  githubPullRequestId: text('github_pull_request_id').notNull(),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  authorLogin: text('author_login').notNull(),
  headSha: text('head_sha').notNull(),
  baseSha: text('base_sha').notNull(),
  branch: text('branch').notNull(),
  isOpen: boolean('is_open').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const reviewRuns = pgTable(
  'review_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pullRequestId: uuid('pull_request_id')
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    headSha: text('head_sha'),
    status: reviewRunStatus('status').notNull().default('queued'),
    filesChanged: integer('files_changed').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // One review run per commit: repeated or concurrent webhook deliveries for
    // the same head SHA collide here instead of spawning duplicate reviews.
    pullRequestShaIdx: uniqueIndex('review_runs_pull_request_sha_idx').on(
      table.pullRequestId,
      table.headSha,
    ),
  }),
)

export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewRunId: uuid('review_run_id')
    .notNull()
    .references(() => reviewRuns.id, { onDelete: 'cascade' }),
  severity: findingSeverity('severity').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  filePath: text('file_path').notNull(),
  lineNumber: integer('line_number'),
  suggestion: text('suggestion'),
  metadata: jsonb('metadata'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const codebaseScans = pgTable('codebase_scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  repositoryId: uuid('repository_id')
    .notNull()
    .references(() => repositories.id, { onDelete: 'cascade' }),
  status: scanStatus('status').notNull().default('queued'),
  scannedFiles: integer('scanned_files').notNull().default(0),
  summary: jsonb('summary'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
