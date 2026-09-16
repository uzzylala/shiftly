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

  const hr = await prisma.user.upsert({
    where: { email: "hr@shiftly.dev" },
    update: {},
    create: {
      email: "hr@shiftly.dev",
      passwordHash,
      name: "Harper Reyes",
      role: "hr",
      organizationId: organization.id,
    },
  });

  const aliceUser = await prisma.user.upsert({
    where: { email: "alice@shiftly.dev" },
    update: {},
    create: {
      email: "alice@shiftly.dev",
      passwordHash,
      name: "Alice Nguyen",
      role: "employee",
      organizationId: organization.id,
    },
  });
  const benUser = await prisma.user.upsert({
    where: { email: "ben@shiftly.dev" },
    update: {},
    create: {
      email: "ben@shiftly.dev",
      passwordHash,
      name: "Ben Okafor",
      role: "employee",
      organizationId: organization.id,
    },
  });

  const [alice, ben] = await Promise.all([
    prisma.employee.upsert({
      where: { id: "00000000-0000-0000-0000-000000000010" },
      update: { userId: aliceUser.id },
      create: {
        id: "00000000-0000-0000-0000-000000000010",
        name: "Alice Nguyen",
        organizationId: organization.id,
        userId: aliceUser.id,
      },
    }),
    prisma.employee.upsert({
      where: { id: "00000000-0000-0000-0000-000000000011" },
      update: { userId: benUser.id },
      create: {
        id: "00000000-0000-0000-0000-000000000011",
        name: "Ben Okafor",
        organizationId: organization.id,
        userId: benUser.id,
      },
    }),
  ]);

  await prisma.availabilityWindow.deleteMany({
    where: { employeeId: { in: [alice.id, ben.id] } },
  });
  await prisma.availabilityWindow.createMany({
    data: [
      // Mon, Thu — covers alice's seeded shifts below
      { employeeId: alice.id, dayOfWeek: 0, startTime: "08:00", endTime: "18:00" },
      { employeeId: alice.id, dayOfWeek: 3, startTime: "06:00", endTime: "15:00" },
      // Tue, Fri — covers ben's seeded shifts below
      { employeeId: ben.id, dayOfWeek: 1, startTime: "10:00", endTime: "22:00" },
      { employeeId: ben.id, dayOfWeek: 4, startTime: "08:00", endTime: "20:00" },
    ],
  });

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  function atDay(dayOffset: number, hour: number, minute = 0): Date {
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date;
  }

  await prisma.shift.deleteMany({ where: { organizationId: organization.id } });
  await prisma.shift.createMany({
    data: [
      {
        organizationId: organization.id,
        employeeId: alice.id,
        startTime: atDay(0, 9),
        endTime: atDay(0, 17),
        location: "Front counter",
        status: "scheduled",
      },
      {
        organizationId: organization.id,
        employeeId: ben.id,
        startTime: atDay(1, 12),
        endTime: atDay(1, 20),
        location: "Warehouse B",
        status: "scheduled",
      },
      {
        organizationId: organization.id,
        employeeId: alice.id,
        startTime: atDay(3, 8),
        endTime: atDay(3, 14),
        location: "Front counter",
        status: "completed",
      },
      {
        organizationId: organization.id,
        employeeId: ben.id,
        startTime: atDay(4, 9, 30),
        endTime: atDay(4, 18),
        location: "Loading dock",
        status: "cancelled",
        note: "Covering for Alice",
      },
    ],
  });

  const aliceMonday = await prisma.shift.findFirst({
    where: { employeeId: alice.id, startTime: atDay(0, 9) },
  });

  await prisma.swapRequest.deleteMany({
    where: { organizationId: organization.id },
  });
  if (aliceMonday) {
    await prisma.swapRequest.create({
      data: {
        organizationId: organization.id,
        shiftId: aliceMonday.id,
        requesterId: alice.id,
        coworkerId: ben.id,
        status: "requested",
      },
    });
  }

  console.log("Seeded organization:", organization.name);
  console.log("All logins use password: password123");
  console.log("  manager@shiftly.dev (manager)", manager.id);
  console.log("  hr@shiftly.dev (hr)", hr.id);
  console.log("  alice@shiftly.dev (employee) ->", alice.name, alice.id);
  console.log("  ben@shiftly.dev (employee) ->", ben.name, ben.id);
  console.log("Seeded 4 shifts, 4 availability windows, and 1 pending swap request");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
