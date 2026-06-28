import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, RoomStatus } from '@prisma/client-hospitality';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateProperty(organizationId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
  }

  async occupancy(
    organizationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    await this.validateProperty(organizationId, propertyId);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const totalRooms = await this.prisma.room.count({ where: { propertyId } });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { not: ReservationStatus.cancelled },
        checkInDate: { lte: end },
        checkOutDate: { gte: start },
      },
      select: {
        checkInDate: true,
        checkOutDate: true,
        totalAmount: true,
      },
    });

    const days: Record<string, { date: string; occupiedRooms: number; revenue: number }> = {};
    const current = new Date(start);
    while (current <= end) {
      const key = current.toISOString().split('T')[0];
      days[key] = { date: key, occupiedRooms: 0, revenue: 0 };
      current.setDate(current.getDate() + 1);
    }

    let totalRevenue = 0;
    for (const reservation of reservations) {
      const nights = Math.max(
        1,
        Math.ceil(
          (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const nightlyRate = Number(reservation.totalAmount) / nights;

      const day = new Date(reservation.checkInDate);
      while (day < reservation.checkOutDate) {
        const key = day.toISOString().split('T')[0];
        if (days[key]) {
          days[key].occupiedRooms += 1;
          days[key].revenue += nightlyRate;
        }
        day.setDate(day.getDate() + 1);
      }
      totalRevenue += Number(reservation.totalAmount);
    }

    const totalDays = Object.keys(days).length;
    const totalOccupied = Object.values(days).reduce(
      (sum, d) => sum + d.occupiedRooms,
      0,
    );
    const occupancyRate =
      totalRooms > 0 && totalDays > 0
        ? (totalOccupied / (totalRooms * totalDays)) * 100
        : 0;

    return {
      summary: {
        totalRooms,
        occupiedRooms: Math.round(totalOccupied / totalDays) || 0,
        occupancyRate: Number(occupancyRate.toFixed(2)),
        revenue: Number(totalRevenue.toFixed(2)),
      },
      byDate: Object.values(days).map((d) => ({
        ...d,
        revenue: Number(d.revenue.toFixed(2)),
      })),
    };
  }

  async revenue(
    organizationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    await this.validateProperty(organizationId, propertyId);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        propertyId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        subtotal: true,
        totalAmount: true,
        paidAmount: true,
        taxBreakdown: true,
        status: true,
        reservation: {
          select: {
            room: {
              select: {
                roomType: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    let totalRevenue = 0;
    let totalSubtotal = 0;
    let totalPaid = 0;
    const taxTotals: Record<string, number> = {};
    const byRoomType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const invoice of invoices) {
      totalRevenue += Number(invoice.totalAmount);
      totalSubtotal += Number(invoice.subtotal);
      totalPaid += Number(invoice.paidAmount);

      for (const tax of invoice.taxBreakdown as any[]) {
        taxTotals[tax.name] = (taxTotals[tax.name] || 0) + tax.amount;
      }

      const roomTypeName = invoice.reservation?.room?.roomType?.name || 'Unknown';
      byRoomType[roomTypeName] =
        (byRoomType[roomTypeName] || 0) + Number(invoice.totalAmount);

      byStatus[invoice.status] =
        (byStatus[invoice.status] || 0) + Number(invoice.totalAmount);
    }

    return {
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalSubtotal: Number(totalSubtotal.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        outstanding: Number((totalRevenue - totalPaid).toFixed(2)),
      },
      taxBreakdown: Object.entries(taxTotals).map(([name, amount]) => ({
        name,
        amount: Number(amount.toFixed(2)),
      })),
      byRoomType: Object.entries(byRoomType).map(([name, amount]) => ({
        name,
        amount: Number(amount.toFixed(2)),
      })),
      byStatus: Object.entries(byStatus).map(([status, amount]) => ({
        status,
        amount: Number(amount.toFixed(2)),
      })),
    };
  }

  async guests(
    organizationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    await this.validateProperty(organizationId, propertyId);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        checkInDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        guestId: true,
        guest: {
          select: {
            nationality: true,
          },
        },
      },
    });

    const guestIds = reservations.map((r) => r.guestId);
    const totalGuests = guestIds.length;
    const uniqueGuests = new Set(guestIds).size;
    const newGuests = uniqueGuests; // Simplified: treat unique guests in period as new
    const returningGuests = Math.max(0, totalGuests - uniqueGuests);

    const nationalityCounts: Record<string, number> = {};
    for (const reservation of reservations) {
      const nationality = reservation.guest.nationality || 'Unknown';
      nationalityCounts[nationality] = (nationalityCounts[nationality] || 0) + 1;
    }

    const topNationalities = Object.entries(nationalityCounts)
      .map(([nationality, count]) => ({ nationality, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      summary: {
        totalGuests,
        uniqueGuests,
        newGuests,
        returningGuests,
      },
      topNationalities,
    };
  }

  async reservations(
    organizationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    await this.validateProperty(organizationId, propertyId);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        checkInDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        status: true,
        source: true,
        totalAmount: true,
      },
    });

    const totalReservations = reservations.length;
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalRevenue = 0;
    let cancelled = 0;
    let noShow = 0;

    for (const reservation of reservations) {
      byStatus[reservation.status] = (byStatus[reservation.status] || 0) + 1;
      bySource[reservation.source] = (bySource[reservation.source] || 0) + 1;
      totalRevenue += Number(reservation.totalAmount);

      if (reservation.status === ReservationStatus.cancelled) cancelled++;
      if (reservation.status === ReservationStatus.no_show) noShow++;
    }

    return {
      summary: {
        totalReservations,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        cancellationRate:
          totalReservations > 0
            ? Number(((cancelled / totalReservations) * 100).toFixed(2))
            : 0,
        noShowRate:
          totalReservations > 0
            ? Number(((noShow / totalReservations) * 100).toFixed(2))
            : 0,
      },
      byStatus: Object.entries(byStatus).map(([status, count]) => ({
        status,
        count,
      })),
      bySource: Object.entries(bySource).map(([source, count]) => ({
        source,
        count,
      })),
    };
  }
}
