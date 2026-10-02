CREATE TYPE "StoreMemberRole" AS ENUM ('ADMIN', 'OPERATOR');

ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StoreMember" (
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "role" "StoreMemberRole" NOT NULL DEFAULT 'OPERATOR',
    CONSTRAINT "StoreMember_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "StoreMember_storeId_idx" ON "StoreMember"("storeId");
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
