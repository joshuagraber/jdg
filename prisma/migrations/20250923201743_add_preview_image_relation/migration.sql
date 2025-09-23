-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "previewTitle" TEXT,
    "previewDescription" TEXT,
    "previewImageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "authorId" TEXT NOT NULL,
    CONSTRAINT "Post_previewImageId_fkey" FOREIGN KEY ("previewImageId") REFERENCES "PostImage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("authorId", "content", "createdAt", "description", "id", "previewDescription", "previewImageId", "previewTitle", "publishAt", "slug", "title", "updatedAt") SELECT "authorId", "content", "createdAt", "description", "id", "previewDescription", "previewImageId", "previewTitle", "publishAt", "slug", "title", "updatedAt" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX "Post_authorId_updatedAt_idx" ON "Post"("authorId", "updatedAt");
CREATE INDEX "Post_publishAt_idx" ON "Post"("publishAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
