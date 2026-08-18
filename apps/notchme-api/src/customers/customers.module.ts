import { Module, forwardRef } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { CrmModule } from "../crm/crm.module";

@Module({
  imports: [forwardRef(() => CrmModule)],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
