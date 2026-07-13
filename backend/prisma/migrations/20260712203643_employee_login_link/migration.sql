-- Optional 1:1 login account for an employee (email = login username).

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "userId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
