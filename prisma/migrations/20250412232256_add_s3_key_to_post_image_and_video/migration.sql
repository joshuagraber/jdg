-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PostImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "title" TEXT,
    "contentType" TEXT NOT NULL,
    "blob" BLOB,
    "s3Key" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PostImage" ("altText", "blob", "contentType", "createdAt", "id", "title", "updatedAt") SELECT "altText", "blob", "contentType", "createdAt", "id", "title", "updatedAt" FROM "PostImage";
DROP TABLE "PostImage";
ALTER TABLE "new_PostImage" RENAME TO "PostImage";
CREATE TABLE "new_PostVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "title" TEXT,
    "contentType" TEXT NOT NULL,
    "blob" BLOB,
    "s3Key" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PostVideo" ("altText", "blob", "contentType", "createdAt", "id", "title", "updatedAt") SELECT "altText", "blob", "contentType", "createdAt", "id", "title", "updatedAt" FROM "PostVideo";
DROP TABLE "PostVideo";
ALTER TABLE "new_PostVideo" RENAME TO "PostVideo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
