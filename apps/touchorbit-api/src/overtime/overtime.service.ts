import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class OvertimeService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(_organizationId: string) {
    return [];
  }
}
