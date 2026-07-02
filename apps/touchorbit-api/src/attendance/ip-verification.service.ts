import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { DatabaseService } from "../database/database.service";

interface IpGeoResult {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isProxy?: boolean;
  is_proxy?: boolean;
}

@Injectable()
export class IpVerificationService {
  private readonly logger = new Logger(IpVerificationService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  getClientIp(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    const forwarded = headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    const cf = headers["cf-connecting-ip"];
    if (typeof cf === "string") return cf;
    const real = headers["x-real-ip"];
    if (typeof real === "string") return real;
    return null;
  }

  async verifyClockEvent(
    eventId: string,
    claimedLat: number,
    claimedLng: number,
    clientIp: string | null,
  ): Promise<{
    distanceKm: number | null;
    flags: string[];
    ipChecked: boolean;
  }> {
    if (!clientIp) {
      await this.updateClockEvent(
        eventId,
        null,
        null,
        null,
        null,
        null,
        false,
        ["no_client_ip"],
      );
      return { distanceKm: null, flags: ["no_client_ip"], ipChecked: false };
    }

    let geo = await this.getCachedGeo(clientIp);
    if (!geo) {
      geo = await this.lookupIp(clientIp);
      if (geo) {
        await this.cacheGeo(clientIp, geo);
      }
    }

    if (!geo || geo.latitude == null || geo.longitude == null) {
      await this.updateClockEvent(
        eventId,
        clientIp,
        geo?.country ?? null,
        geo?.city ?? null,
        null,
        null,
        geo?.isProxy ?? false,
        ["ip_lookup_failed"],
      );
      return {
        distanceKm: null,
        flags: ["ip_lookup_failed"],
        ipChecked: false,
      };
    }

    const distanceKm = this.haversine(
      claimedLat,
      claimedLng,
      geo.latitude,
      geo.longitude,
    );

    const flags: string[] = [];
    if (distanceKm > 50) {
      flags.push("ip_distance_mismatch");
    }
    if (geo.isProxy) {
      flags.push("ip_proxy_detected");
    }

    const adminReviewStatus = flags.length > 0 ? "flagged" : "none";

    await this.updateClockEvent(
      eventId,
      clientIp,
      geo.country ?? null,
      geo.city ?? null,
      geo.latitude,
      geo.longitude,
      geo.isProxy ?? false,
      flags,
      distanceKm,
      adminReviewStatus,
    );

    return { distanceKm, flags, ipChecked: true };
  }

  private async getCachedGeo(ip: string): Promise<IpGeoResult | null> {
    const result = await this.databaseService.query<
      IpGeoResult & { fetched_at: Date }
    >(
      `SELECT country, city, latitude, longitude, is_proxy, fetched_at
       FROM ip_geo_cache
       WHERE ip = $1::inet AND fetched_at > now() - interval '24 hours'`,
      [ip],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      country: row.country,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
      isProxy: row.is_proxy,
    };
  }

  private async cacheGeo(ip: string, geo: IpGeoResult): Promise<void> {
    await this.databaseService.query(
      `INSERT INTO ip_geo_cache (ip, country, city, latitude, longitude, is_proxy, fetched_at)
       VALUES ($1::inet, $2, $3, $4, $5, $6, now())
       ON CONFLICT (ip) DO UPDATE SET
         country = EXCLUDED.country,
         city = EXCLUDED.city,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         is_proxy = EXCLUDED.is_proxy,
         fetched_at = EXCLUDED.fetched_at`,
      [
        ip,
        geo.country ?? null,
        geo.city ?? null,
        geo.latitude ?? null,
        geo.longitude ?? null,
        geo.isProxy ?? false,
      ],
    );
  }

  private async lookupIp(ip: string): Promise<IpGeoResult | null> {
    try {
      const response = await axios.get<Record<string, unknown>>(
        `https://ipapi.co/${ip}/json/`,
        { timeout: 5000 },
      );
      const data = response.data;
      return {
        country: data.country_name as string | undefined,
        city: data.city as string | undefined,
        latitude: data.latitude as number | undefined,
        longitude: data.longitude as number | undefined,
        isProxy: (data.proxy as boolean) || (data.vpn as boolean) || false,
      };
    } catch {
      this.logger.warn(`ipapi.co failed for ${ip}, trying ip-api.com`);
    }

    try {
      const response = await axios.get<Record<string, unknown>>(
        `http://ip-api.com/json/${ip}`,
        { timeout: 5000 },
      );
      const data = response.data;
      if (data.status !== "success") return null;
      return {
        country: data.country as string | undefined,
        city: data.city as string | undefined,
        latitude: data.lat as number | undefined,
        longitude: data.lon as number | undefined,
        isProxy: data.proxy as boolean | undefined,
      };
    } catch (error) {
      this.logger.error(`IP lookup failed for ${ip}`, error);
      return null;
    }
  }

  private async updateClockEvent(
    eventId: string,
    ip: string | null,
    country: string | null,
    city: string | null,
    ipLat: number | null,
    ipLng: number | null,
    isProxy: boolean,
    flags: string[],
    distanceKm: number | null = null,
    adminReviewStatus: string | null = null,
  ): Promise<void> {
    await this.databaseService.query(
      `UPDATE clock_events
       SET client_ip = $1::inet,
           ip_country = $2,
           ip_city = $3,
           ip_lat = $4,
           ip_lng = $5,
           ip_proxy_detected = $6,
           suspicious_flags = COALESCE(suspicious_flags, '{}') || $7::text[],
           ip_distance_km = COALESCE($8, ip_distance_km),
           admin_review_status = COALESCE($9, admin_review_status),
           ip_check_status = 'completed'
       WHERE id = $10::uuid`,
      [
        ip,
        country,
        city,
        ipLat,
        ipLng,
        isProxy,
        flags,
        distanceKm,
        adminReviewStatus,
        eventId,
      ],
    );
  }

  private haversine(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
