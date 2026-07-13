import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class MeService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(_organizationId: string) {
    return [];
  }
}
