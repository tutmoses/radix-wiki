-- A deleted page and its revisions, kept so its history can restore it.
CREATE TABLE "deleted_pages" (
    "id" TEXT NOT NULL,
    "tag_path" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "page" JSONB NOT NULL,
    "revisions" JSONB NOT NULL,
    "deleted_by" TEXT,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_pages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deleted_pages_tag_path_slug_deleted_at_idx" ON "deleted_pages"("tag_path", "slug", "deleted_at");
