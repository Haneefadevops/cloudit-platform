import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { authHeaders, tomorrowISO } from "./test-helpers";

describe("Hospitality API (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;

  const unique = Date.now().toString();
  let propertyId: string;
  let roomTypeId: string;
  let roomId: string;
  let guestId: string;
  let reservationId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    authToken = jwtService.sign({ sub: `e2e-user-${unique}` });

    // Seed the test organization property
    const propertyRes = await request(app.getHttpServer())
      .post("/api/properties")
      .set(authHeaders(authToken))
      .send({
        name: `E2E Property ${unique}`,
        address: "123 Test Lane, Colombo",
        phone: "+94123456789",
        email: "test@property.lk",
        taxId: "TAX-123456",
      })
      .expect(201);
    propertyId = propertyRes.body.data.id;

    const roomTypeRes = await request(app.getHttpServer())
      .post("/api/room-types")
      .set(authHeaders(authToken))
      .send({
        name: `Deluxe E2E ${unique}`,
        description: "E2E test room type",
        basePrice: 10000,
        maxOccupancy: 2,
        propertyId,
      })
      .expect(201);
    roomTypeId = roomTypeRes.body.data.id;

    const roomRes = await request(app.getHttpServer())
      .post("/api/rooms")
      .set(authHeaders(authToken))
      .send({
        roomNumber: `E2E-${unique.slice(-6)}`,
        floor: "2",
        propertyId,
        roomTypeId,
      })
      .expect(201);
    roomId = roomRes.body.data.id;

    const guestRes = await request(app.getHttpServer())
      .post("/api/guests")
      .set(authHeaders(authToken))
      .send({
        firstName: "Test",
        lastName: `Guest ${unique.slice(-6)}`,
        email: `guest-${unique}@example.com`,
        phone: "+94771234567",
        nationality: "Sri Lankan",
      })
      .expect(201);
    guestId = guestRes.body.data.id;
  });

  afterAll(async () => {
    if (prisma) {
      try {
        if (propertyId) {
          await prisma.property.delete({ where: { id: propertyId } });
        }
      } catch (e) {
        console.warn("Failed to cleanup property:", e);
      }
      try {
        if (guestId) {
          await prisma.guest.delete({ where: { id: guestId } });
        }
      } catch (e) {
        console.warn("Failed to cleanup guest:", e);
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe("Health & Auth", () => {
    it("/api/health (GET) should be public and report ok", () => {
      return request(app.getHttpServer())
        .get("/api/health")
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBeDefined();
          expect(res.body.service).toBe("hospitality-api");
        });
    });

    it("should reject unauthenticated requests", () => {
      return request(app.getHttpServer())
        .get("/api/properties")
        .set("X-Organization-Id", "any-org")
        .expect(401);
    });
  });

  describe("Full booking lifecycle", () => {
    it("should create a reservation", async () => {
      const checkIn = tomorrowISO(1);
      const checkOut = tomorrowISO(3);

      const res = await request(app.getHttpServer())
        .post("/api/reservations")
        .set(authHeaders(authToken))
        .send({
          propertyId,
          roomId,
          guestId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: 2,
          children: 0,
          totalAmount: 20000,
          paidAmount: 5000,
          source: "direct",
          notes: "E2E reservation",
        })
        .expect(201);

      reservationId = res.body.data.id;
      expect(res.body.data.reservationNumber).toMatch(/^RES-/);
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.guest.id).toBe(guestId);
      expect(res.body.data.room.id).toBe(roomId);
    });

    it("should confirm the reservation", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/reservations/${reservationId}`)
        .set(authHeaders(authToken))
        .send({ status: "confirmed" })
        .expect(200);

      expect(res.body.data.status).toBe("confirmed");
    });

    it("should check in the guest and occupy the room", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/reservations/${reservationId}/check-in`)
        .set(authHeaders(authToken))
        .send({ notes: "Guest arrived" })
        .expect(200);

      expect(res.body.data.status).toBe("checked_in");

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      expect(room?.status).toBe("occupied");
    });

    it("should check out the guest, create an invoice, and free the room for cleaning", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/reservations/${reservationId}/check-out`)
        .set(authHeaders(authToken))
        .send({ finalAmount: 22000, notes: "Checked out" })
        .expect(200);

      expect(res.body.data.status).toBe("checked_out");
      expect(Number(res.body.data.totalAmount)).toBe(22000);

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      expect(room?.status).toBe("cleaning");

      const invoice = await prisma.invoice.findFirst({
        where: { reservationId },
      });
      expect(invoice).not.toBeNull();
      invoiceId = invoice!.id;
    });

    it("should allow previewing and marking the invoice as paid", async () => {
      const previewRes = await request(app.getHttpServer())
        .get(`/api/invoices/${invoiceId}/preview`)
        .set(authHeaders(authToken))
        .expect(200);

      expect(previewRes.body.data.invoiceNumber).toMatch(/^INV-/);
      expect(Number(previewRes.body.data.totalAmount)).toBeGreaterThan(0);
      expect(previewRes.body.data.taxBreakdown).toBeInstanceOf(Array);

      const paidRes = await request(app.getHttpServer())
        .post(`/api/invoices/${invoiceId}/mark-paid`)
        .set(authHeaders(authToken))
        .expect(200);

      expect(paidRes.body.data.status).toBe("paid");
      expect(Number(paidRes.body.data.paidAmount)).toBe(
        Number(paidRes.body.data.totalAmount),
      );
    });
  });

  describe("Reports", () => {
    it("should return occupancy report", async () => {
      const start = tomorrowISO(0);
      const end = tomorrowISO(5);

      const res = await request(app.getHttpServer())
        .get(
          `/api/reports/occupancy?propertyId=${propertyId}&startDate=${start}&endDate=${end}`,
        )
        .set(authHeaders(authToken))
        .expect(200);

      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.byDate).toBeInstanceOf(Array);
    });

    it("should return revenue report", async () => {
      const start = tomorrowISO(0);
      const end = tomorrowISO(5);

      const res = await request(app.getHttpServer())
        .get(
          `/api/reports/revenue?propertyId=${propertyId}&startDate=${start}&endDate=${end}`,
        )
        .set(authHeaders(authToken))
        .expect(200);

      expect(res.body.data.summary.totalRevenue).toBeDefined();
      expect(res.body.data.taxBreakdown).toBeInstanceOf(Array);
    });

    it("should return guest report", async () => {
      const start = tomorrowISO(0);
      const end = tomorrowISO(5);

      const res = await request(app.getHttpServer())
        .get(
          `/api/reports/guests?propertyId=${propertyId}&startDate=${start}&endDate=${end}`,
        )
        .set(authHeaders(authToken))
        .expect(200);

      expect(res.body.data.summary.totalGuests).toBeGreaterThanOrEqual(1);
      expect(res.body.data.topNationalities).toBeInstanceOf(Array);
    });

    it("should return reservation report", async () => {
      const start = tomorrowISO(0);
      const end = tomorrowISO(5);

      const res = await request(app.getHttpServer())
        .get(
          `/api/reports/reservations?propertyId=${propertyId}&startDate=${start}&endDate=${end}`,
        )
        .set(authHeaders(authToken))
        .expect(200);

      expect(res.body.data.summary.totalReservations).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byStatus).toBeInstanceOf(Array);
      expect(res.body.data.bySource).toBeInstanceOf(Array);
    });
  });
});
