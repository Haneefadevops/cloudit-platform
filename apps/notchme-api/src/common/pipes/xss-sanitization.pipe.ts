import { PipeTransform, Injectable } from "@nestjs/common";
import { filterXSS } from "xss";

@Injectable()
export class XssSanitizationPipe implements PipeTransform {
  private readonly sensitiveFields = new Set([
    "password",
    "currentPassword",
    "newPassword",
    "token",
    "refreshToken",
    "apiKey",
    "secret",
    "jwt",
  ]);

  transform(value: unknown): unknown {
    return this.sanitize(value);
  }

  private sanitize(value: unknown, key?: string): unknown {
    if (typeof value === "string") {
      if (key && this.sensitiveFields.has(key)) {
        return value;
      }
      return filterXSS(value, {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script"],
      });
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => this.sanitize(item, String(index)));
    }

    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.sanitize(v, k);
      }
      return result;
    }

    return value;
  }
}
