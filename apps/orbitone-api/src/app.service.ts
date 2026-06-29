import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getRoot() {
    return {
      name: "CloudIT OrbitOne API",
      version: "1.0.0",
      docs: "/api/docs",
      health: "/api/health",
    };
  }
}
