import { Controller, Get, Sse, UseGuards, MessageEvent } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Observable, fromEvent } from "rxjs";
import { map } from "rxjs/operators";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { AuthContext } from "../auth/types";

@ApiTags("events")
@Controller("events")
@UseGuards(SessionAuthGuard)
export class EventsController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Get("stream")
  @Sse("stream")
  @ApiOperation({ summary: "Server-sent events stream for realtime updates" })
  stream(@AuthUser("id") userId: string): Observable<MessageEvent> {
    const orgChannel = `org:*`;
    const userChannel = `user:${userId}`;

    return fromEvent(
      this.eventEmitter,
      orgChannel,
      (payload: unknown) => payload,
    ).pipe(
      map((payload) => ({
        data: JSON.stringify(payload),
      })),
    );
  }
}
