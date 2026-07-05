import { api } from "./api-client";

export interface WhiteLabelSettings {
  logoUrl?: string;
  primaryColor?: string;
  faviconUrl?: string;
  dateFormat?: string;
  currency?: string;
  supportEmail?: string;
}

const WHITE_LABEL_KEYS = [
  "white_label.logo_url",
  "white_label.primary_color",
  "white_label.favicon_url",
  "white_label.date_format",
  "white_label.currency",
  "white_label.support_email",
];

export function parseWhiteLabelSettings(settings: Record<string, unknown>): WhiteLabelSettings {
  return {
    logoUrl: (settings["white_label.logo_url"] as string) || "",
    primaryColor: (settings["white_label.primary_color"] as string) || "",
    faviconUrl: (settings["white_label.favicon_url"] as string) || "",
    dateFormat: (settings["white_label.date_format"] as string) || "DD/MM/YYYY",
    currency: (settings["white_label.currency"] as string) || "LKR",
    supportEmail: (settings["white_label.support_email"] as string) || "",
  };
}

export function serializeWhiteLabelSettings(values: WhiteLabelSettings): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  WHITE_LABEL_KEYS.forEach((key) => {
    const shortKey = key.replace("white_label.", "") as keyof WhiteLabelSettings;
    const value = values[shortKey];
    if (value !== undefined && value !== "") {
      payload[key] = value;
    }
  });
  return payload;
}

export const whiteLabelApi = {
  get: (orgId: string) => api.get<Record<string, unknown>>(`/settings?orgId=${orgId}`),

  update: (orgId: string, values: WhiteLabelSettings) =>
    api.patch<Record<string, unknown>>(`/settings?orgId=${orgId}`, serializeWhiteLabelSettings(values)),
};
