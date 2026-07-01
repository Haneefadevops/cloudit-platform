import { Module } from "@nestjs/common";
import { ShiftSwapsController } from "./shift-swaps.controller";
import { ShiftSwapsService } from "./shift-swaps.service";

@Module({
  controllers: [ShiftSwapsController],
  providers: [ShiftSwapsService],
  exports: [ShiftSwapsService],
})
export class ShiftSwapsModule {}
