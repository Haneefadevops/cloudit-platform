import { Module } from "@nestjs/common";
import { ProductModulesService } from "./modules.service";

@Module({
  providers: [ProductModulesService],
  exports: [ProductModulesService],
})
export class ProductModulesModule {}
