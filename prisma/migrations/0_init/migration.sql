-- Baseline of the production schema as it stood on 2026-11-23, marked applied
-- with `prisma migrate resolve --applied 0_init` rather than run: every table,
-- index and constraint below already existed. Verified with
-- `prisma migrate diff --from-config-datasource --to-schema` emitting only the
-- phantom `ALTER COLUMN "search_tsv" DROP DEFAULT` that a generated column
-- always produces. search_tsv is built with `npx fts-ddl '"WikiPage"'`. Later
-- changes are tracked migrations applied with `npm run db:migrate`.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "View" (
    "id" BIGSERIAL NOT NULL,
    "siteId" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL,
    "source" TEXT,
    "country" TEXT,
    "device" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "engaged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "View_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" BIGSERIAL NOT NULL,
    "siteId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "path" TEXT,
    "props" JSONB NOT NULL DEFAULT '{}',
    "visitor" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDay" (
    "siteId" TEXT NOT NULL DEFAULT '',
    "day" DATE NOT NULL,
    "visitor" TEXT NOT NULL,
    "bot" TEXT,
    "ua" TEXT NOT NULL,
    "country" TEXT,
    "entry" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "tools" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AgentDay_pkey" PRIMARY KEY ("siteId","day","visitor")
);

-- CreateTable
CREATE TABLE "Salt" (
    "day" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Salt_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "ViewDay" (
    "siteId" TEXT NOT NULL DEFAULT '',
    "day" DATE NOT NULL,
    "visitors" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "visits" INTEGER NOT NULL,
    "bounces" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "pages" JSONB NOT NULL DEFAULT '{}',
    "entryPages" JSONB NOT NULL DEFAULT '{}',
    "sources" JSONB NOT NULL DEFAULT '{}',
    "countries" JSONB NOT NULL DEFAULT '{}',
    "devices" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ViewDay_pkey" PRIMARY KEY ("siteId","day")
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "transports" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasskeyToken" (
    "hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "passkeyId" TEXT,

    CONSTRAINT "PasskeyToken_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "radix_address" TEXT,
    "persona_address" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_passkeys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL,
    "transports" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "page_id" TEXT,
    "chat_message_id" INTEGER,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "tag_path_filter" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY['page.created', 'page.updated']::TEXT[],
    "tag_path" TEXT NOT NULL DEFAULT '',
    "page_slug" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_days" (
    "day" DATE NOT NULL,
    "transactions" INTEGER NOT NULL,
    "active_accounts" INTEGER NOT NULL,
    "new_accounts" INTEGER NOT NULL,
    "new_components" INTEGER NOT NULL,
    "new_resources" INTEGER NOT NULL,
    "nfts_minted" INTEGER NOT NULL,
    "fees_xrd" DOUBLE PRECISION NOT NULL,
    "burned_xrd" DOUBLE PRECISION NOT NULL,
    "royalties_xrd" DOUBLE PRECISION NOT NULL,
    "state_version" INTEGER,

    CONSTRAINT "ledger_days_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image" TEXT,
    "reply_to_id" INTEGER,
    "refs" JSONB NOT NULL DEFAULT '{}',
    "author_weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hidden_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "cleared_at" TIMESTAMP(3),
    "retracted" BOOLEAN NOT NULL DEFAULT false,
    "moderated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "page_id" TEXT,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_flags" (
    "id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "siteId" TEXT NOT NULL DEFAULT '',
    "tagPath" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "authorId" TEXT,
    "lastVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_tsv" tsvector,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiRevision" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "message" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "View_siteId_createdAt_idx" ON "View"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_siteId_name_createdAt_idx" ON "Event"("siteId", "name", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_radix_address_key" ON "users"("radix_address");

-- CreateIndex
CREATE INDEX "user_passkeys_user_id_idx" ON "user_passkeys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_challenge_key" ON "challenges"("challenge");

-- CreateIndex
CREATE INDEX "challenges_expires_at_idx" ON "challenges"("expires_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at");

-- CreateIndex
CREATE INDEX "webhooks_active_idx" ON "webhooks"("active");

-- CreateIndex
CREATE INDEX "telegram_links_active_idx" ON "telegram_links"("active");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_user_id_tag_path_page_slug_key" ON "telegram_links"("user_id", "tag_path", "page_slug");

-- CreateIndex
CREATE INDEX "chat_messages_page_id_id_idx" ON "chat_messages"("page_id", "id");

-- CreateIndex
CREATE INDEX "chat_messages_author_id_hidden_at_idx" ON "chat_messages"("author_id", "hidden_at");

-- CreateIndex
CREATE INDEX "chat_messages_moderated_at_idx" ON "chat_messages"("moderated_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_flags_message_id_user_id_key" ON "chat_flags"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "WikiPage_siteId_tagPath_updatedAt_idx" ON "WikiPage"("siteId", "tagPath", "updatedAt");

-- CreateIndex
CREATE INDEX "WikiPage_siteId_updatedAt_idx" ON "WikiPage"("siteId", "updatedAt");

-- CreateIndex
CREATE INDEX "WikiPage_search_tsv_idx" ON "WikiPage" USING GIN ("search_tsv");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_siteId_tagPath_slug_key" ON "WikiPage"("siteId", "tagPath", "slug");

-- CreateIndex
CREATE INDEX "WikiRevision_pageId_createdAt_idx" ON "WikiRevision"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "WikiRevision_authorId_createdAt_idx" ON "WikiRevision"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "PasskeyToken" ADD CONSTRAINT "PasskeyToken_passkeyId_fkey" FOREIGN KEY ("passkeyId") REFERENCES "Passkey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_passkeys" ADD CONSTRAINT "user_passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_flags" ADD CONSTRAINT "chat_flags_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_flags" ADD CONSTRAINT "chat_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiRevision" ADD CONSTRAINT "WikiRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

