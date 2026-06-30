import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  imports: [EventsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
