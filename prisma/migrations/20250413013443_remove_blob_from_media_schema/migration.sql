/*
  Warnings:

  - You are about to drop the column `blob` on the `PostImage` table. All the data in the column will be lost.
  - You are about to drop the column `blob` on the `PostVideo` table. All the data in the column will be lost.
  - Made the column `s3Key` on table `PostImage` required. This step will fail if there are existing NULL values in that column.
  - Made the column `s3Key` on table `PostVideo` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PostImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "title" TEXT,
    "contentType" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PostImage" ("altText", "contentType", "createdAt", "id", "s3Key", "title", "updatedAt") SELECT "altText", "contentType", "createdAt", "id", "s3Key", "title", "updatedAt" FROM "PostImage";
DROP TABLE "PostImage";
ALTER TABLE "new_PostImage" RENAME TO "PostImage";
CREATE TABLE "new_PostVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "title" TEXT,
    "contentType" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PostVideo" ("altText", "contentType", "createdAt", "id", "s3Key", "title", "updatedAt") SELECT "altText", "contentType", "createdAt", "id", "s3Key", "title", "updatedAt" FROM "PostVideo";
DROP TABLE "PostVideo";
ALTER TABLE "new_PostVideo" RENAME TO "PostVideo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
