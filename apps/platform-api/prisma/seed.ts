import { PrismaClient } from '@prisma/client-platform';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cloudit.lk' },
    update: {},
    create: {
      email: 'admin@cloudit.lk',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
      isActive: true,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-organization' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-organization',
      plan: 'free',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_orgId: {
        userId: admin.id,
        orgId: org.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      orgId: org.id,
      role: 'ADMIN',
    },
  });

  console.log('Seed completed:');
  console.log(`  Admin user: ${admin.email}`);
  console.log(`  Demo org: ${org.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
