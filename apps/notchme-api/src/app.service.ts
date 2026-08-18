import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getRoot() {
    return {
      name: "NotchMe API",
      version: "1.0.0",
      docs: "/api/docs",
      health: "/api/health",
    };
  }
}
