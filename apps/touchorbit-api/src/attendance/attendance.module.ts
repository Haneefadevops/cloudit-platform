import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { IpVerificationService } from "./ip-verification.service";

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, IpVerificationService],
  exports: [AttendanceService, IpVerificationService],
})
export class AttendanceModule {}
