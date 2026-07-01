import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(_organizationId: string) {
    return [];
  }
}
