import { Module, forwardRef } from "@nestjs/common";
import { BulkController } from "./bulk.controller";
import { BulkService } from "./bulk.service";
import { PipelinesModule } from "../pipelines/pipelines.module";
import { CustomersModule } from "../../customers/customers.module";

@Module({
  imports: [PipelinesModule, forwardRef(() => CustomersModule)],
  controllers: [BulkController],
  providers: [BulkService],
  exports: [BulkService],
})
export class BulkModule {}
