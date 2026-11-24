-- Additive upgrade for an existing database originally managed with `db push`.
-- Review/verify the target before execution. Do not use a destructive reset.
BEGIN;
CREATE TABLE IF NOT EXISTS "UploadIngestion" (
  "key" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "ownerToken" TEXT NOT NULL,
  "leaseUntil" TIMESTAMP(3) NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'processing',
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "metAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadIngestion_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "UploadIngestion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UploadIngestion_documentId_key" ON "UploadIngestion"("documentId");
CREATE INDEX IF NOT EXISTS "UploadIngestion_state_leaseUntil_idx" ON "UploadIngestion"("state", "leaseUntil");
COMMIT;
