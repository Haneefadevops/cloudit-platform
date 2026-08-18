import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { DatabaseService } from "../database/database.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { SlugService } from "../common/lib/slug.service";
import { RedisService } from "../redis/redis.service";

describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [AuthController],
      providers: [
        AuthService,
        SessionService,
        OrganizationsService,
        SlugService,
        {
          provide: DatabaseService,
          useValue: {
            query: jest.fn(),
            connect: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            client: {
              pipeline: jest.fn(() => ({
                set: jest.fn().mockReturnThis(),
                sadd: jest.fn().mockReturnThis(),
                expire: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([]),
                get: jest.fn().mockResolvedValue(null),
              })),
              get: jest.fn().mockResolvedValue(null),
              expire: jest.fn().mockResolvedValue(1),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
