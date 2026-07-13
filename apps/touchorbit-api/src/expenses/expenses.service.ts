import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ExpensesService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(_organizationId: string) {
    return [];
  }
}
