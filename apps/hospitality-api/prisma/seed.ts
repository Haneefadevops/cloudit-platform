import { PrismaClient, RoomStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const organizationId = 'seed-organization-001';

  // Clean existing seed data (optional, be careful in production)
  await prisma.invoice.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.guest.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.roomType.deleteMany({});
  await prisma.property.deleteMany({});

  const property1 = await prisma.property.create({
    data: {
      name: 'CloudIT Beach Resort',
      address: '123 Beach Road, Colombo, Sri Lanka',
      phone: '+94 11 123 4567',
      email: 'resort@cloudit.lk',
      taxId: 'TAX-123456',
      organizationId,
    },
  });

  const property2 = await prisma.property.create({
    data: {
      name: 'CloudIT City Hotel',
      address: '456 City Center, Kandy, Sri Lanka',
      phone: '+94 81 987 6543',
      email: 'city@cloudit.lk',
      taxId: 'TAX-654321',
      organizationId,
    },
  });

  const deluxe = await prisma.roomType.create({
    data: {
      name: 'Deluxe Room',
      description: 'Spacious room with sea view',
      basePrice: 15000,
      maxOccupancy: 2,
      amenities: ['WiFi', 'AC', 'TV', 'Mini Bar'],
      propertyId: property1.id,
    },
  });

  const standard = await prisma.roomType.create({
    data: {
      name: 'Standard Room',
      description: 'Comfortable room with city view',
      basePrice: 10000,
      maxOccupancy: 2,
      amenities: ['WiFi', 'AC', 'TV'],
      propertyId: property1.id,
    },
  });

  const suite = await prisma.roomType.create({
    data: {
      name: 'Family Suite',
      description: 'Large suite for families',
      basePrice: 25000,
      maxOccupancy: 4,
      amenities: ['WiFi', 'AC', 'TV', 'Kitchen', 'Balcony'],
      propertyId: property2.id,
    },
  });

  const rooms = [];
  for (let i = 1; i <= 5; i++) {
    rooms.push(
      await prisma.room.create({
        data: {
          roomNumber: `10${i}`,
          floor: '1',
          status: RoomStatus.available,
          propertyId: property1.id,
          roomTypeId: i % 2 === 0 ? deluxe.id : standard.id,
        },
      }),
    );
  }
  for (let i = 1; i <= 5; i++) {
    rooms.push(
      await prisma.room.create({
        data: {
          roomNumber: `20${i}`,
          floor: '2',
          status: RoomStatus.available,
          propertyId: property2.id,
          roomTypeId: suite.id,
        },
      }),
    );
  }

  const guests = [];
  const guestData = [
    { firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+94 77 111 1111', nationality: 'USA' },
    { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+94 77 222 2222', nationality: 'UK' },
    { firstName: 'Kamal', lastName: 'Perera', email: 'kamal@example.com', phone: '+94 77 333 3333', nationality: 'Sri Lanka' },
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah@example.com', phone: '+94 77 444 4444', nationality: 'Australia' },
    { firstName: 'Michael', lastName: 'Brown', email: 'michael@example.com', phone: '+94 77 555 5555', nationality: 'Canada' },
  ];

  for (const g of guestData) {
    guests.push(
      await prisma.guest.create({
        data: {
          ...g,
          organizationId,
        },
      }),
    );
  }

  console.log('Seed data created:');
  console.log(`- Properties: 2`);
  console.log(`- Room Types: 3`);
  console.log(`- Rooms: ${rooms.length}`);
  console.log(`- Guests: ${guests.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
