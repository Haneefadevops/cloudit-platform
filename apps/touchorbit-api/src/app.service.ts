import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getRoot() {
    return {
      name: "CloudIT TouchOrbit HR API",
      version: "1.0.0",
      docs: "/api/docs",
      health: "/api/health",
    };
  }
}
