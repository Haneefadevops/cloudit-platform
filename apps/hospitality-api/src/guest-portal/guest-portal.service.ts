import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { ReservationStatus } from "@prisma/client-hospitality";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCheckInLinkDto } from "./dto/create-check-in-link.dto";
import { SubmitCheckInDto } from "./dto/submit-check-in.dto";

@Injectable()
export class GuestPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async createCheckInLink(organizationId: string, dto: CreateCheckInLinkDto) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: dto.reservationId, property: { organizationId } },
      include: { guest: true, property: true, room: true },
    });
    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : this.defaultExpiry(reservation.checkOutDate);
    if (expiresAt <= new Date()) {
      throw new BadRequestException("Expiry must be in the future");
    }

    const session = await this.prisma.guestCheckInSession.create({
      data: {
        token: this.generateToken(),
        expiresAt,
        organizationId,
        reservation: { connect: { id: reservation.id } },
      },
      include: { reservation: { include: { guest: true, property: true, room: true } } },
    });

    return {
      id: session.id,
      token: session.token,
      expiresAt: session.expiresAt,
      url: `/guest/check-in/${session.token}`,
      reservation: this.publicReservation(session.reservation),
    };
  }

  async getPublicSession(token: string) {
    const session = await this.prisma.guestCheckInSession.findUnique({
      where: { token },
      include: {
        reservation: {
          include: {
            guest: true,
            property: true,
            room: { include: { roomType: true } },
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      throw new NotFoundException("Self check-in link not found or expired");
    }

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      submittedAt: session.submittedAt,
      reservation: this.publicReservation(session.reservation),
    };
  }

  async submit(token: string, dto: SubmitCheckInDto) {
    const session = await this.prisma.guestCheckInSession.findUnique({
      where: { token },
      include: { reservation: { include: { guest: true } } },
    });

    if (!session || session.expiresAt <= new Date()) {
      throw new NotFoundException("Self check-in link not found or expired");
    }
    if (session.submittedAt) {
      throw new BadRequestException("Self check-in has already been submitted");
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.guest.update({
        where: { id: session.reservation.guestId },
        data: {
          localPhone: dto.localPhone,
          nicNumber: dto.nicNumber,
          passportNumber: dto.passportNumber,
          nationality: dto.nationality,
          address: dto.address,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
        },
      });

      await tx.reservation.update({
        where: { id: session.reservationId },
        data: {
          status:
            session.reservation.status === ReservationStatus.pending
              ? ReservationStatus.confirmed
              : session.reservation.status,
          notes: [
            session.reservation.notes,
            "Guest self check-in completed.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });

      return tx.guestCheckInSession.update({
        where: { token },
        data: {
          submittedAt: now,
          payload: dto as any,
        },
      });
    });

    return {
      submittedAt: updated.submittedAt,
      status: "submitted",
    };
  }

  private defaultExpiry(checkOutDate: Date) {
    const expiresAt = new Date(checkOutDate);
    expiresAt.setDate(expiresAt.getDate() + 1);
    return expiresAt;
  }

  private generateToken() {
    return randomBytes(24).toString("hex");
  }

  private publicReservation(reservation: any) {
    return {
      id: reservation.id,
      reservationNumber: reservation.reservationNumber,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      status: reservation.status,
      property: {
        name: reservation.property.name,
        address: reservation.property.address,
        phone: reservation.property.phone,
        email: reservation.property.email,
      },
      room: {
        roomNumber: reservation.room.roomNumber,
        roomType: reservation.room.roomType?.name,
      },
      guest: {
        firstName: reservation.guest.firstName,
        lastName: reservation.guest.lastName,
        email: reservation.guest.email,
        phone: reservation.guest.phone,
        localPhone: reservation.guest.localPhone,
        nicNumber: reservation.guest.nicNumber,
        passportNumber: reservation.guest.passportNumber,
        nationality: reservation.guest.nationality,
        address: reservation.guest.address,
        emergencyContactName: reservation.guest.emergencyContactName,
        emergencyContactPhone: reservation.guest.emergencyContactPhone,
      },
    };
  }
}
