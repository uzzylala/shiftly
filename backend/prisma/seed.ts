import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma.js";

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Acme Retail",
    },
  });

  const passwordHash = await bcrypt.hash("password123", 10);
  const manager = await prisma.user.upsert({
    where: { email: "manager@shiftly.dev" },
    update: {},
    create: {
      email: "manager@shiftly.dev",
      passwordHash,
      name: "Morgan Manager",
      role: "manager",
      organizationId: organization.id,
    },
  });

  console.log("Seeded organization:", organization.name);
  console.log("Seeded manager login: manager@shiftly.dev / password123");
  console.log("Manager id:", manager.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
