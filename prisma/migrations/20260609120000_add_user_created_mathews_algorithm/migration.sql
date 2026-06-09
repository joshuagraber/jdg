-- CreateTable
CREATE TABLE "UserCreatedMathewsAlgorithm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "table" TEXT NOT NULL,
    "shiftPasses" INTEGER NOT NULL,
    "sessionUpdatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCreatedMathewsAlgorithm_sessionId_key" ON "UserCreatedMathewsAlgorithm"("sessionId");
