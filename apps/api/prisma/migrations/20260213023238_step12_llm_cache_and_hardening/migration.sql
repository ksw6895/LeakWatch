-- CreateTable
CREATE TABLE "LlmCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVer" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LlmCache_cacheKey_key" ON "LlmCache"("cacheKey");

-- CreateIndex
CREATE INDEX "LlmCache_expiresAt_idx" ON "LlmCache"("expiresAt");
