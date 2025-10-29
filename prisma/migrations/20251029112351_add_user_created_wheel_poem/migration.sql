-- CreateTable
CREATE TABLE "UserCreatedWheelPoem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rotations" TEXT NOT NULL,
    "wheelSize" REAL,
    "sessionUpdatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCreatedWheelPoem_sessionId_key" ON "UserCreatedWheelPoem"("sessionId");
