import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  AccountsService,
  AccountError,
  type AccountContext,
} from "./accounts.service";
import {
  accountInputSchema,
  connectionResponseSchema,
} from "./accounts.schemas";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { RequireBusinessGuard } from "../common/guards/require-business.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import type { AuthContext } from "../auth/types";

@Controller("v2/accounts")
@RequireModule("orbitone", "business_accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  private getContext(user: AuthContext): AccountContext {
    if (!user.organizationId) {
      throw new AccountError("Business accounts require an organization.", 403);
    }
    return { userId: user.id, organizationId: user.organizationId };
  }

  @Get()
  @UseGuards(RequireBusinessGuard)
  async list(
    @AuthUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const accounts = await this.accountsService.listAccounts(
        this.getContext(user),
      );
      return { ok: true, data: accounts };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Post()
  @UseGuards(RequireBusinessGuard)
  async create(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = accountInputSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid account details." };
    }
    try {
      const account = await this.accountsService.createAccount(
        this.getContext(user),
        input.data,
      );
      res.status(201);
      return { ok: true, data: account };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Get("directory")
  @UseGuards(RequireBusinessGuard)
  async directory(
    @AuthUser() user: AuthContext,
    @Query("search") search: string | undefined,
    @Query("industry") industry: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("offset") offset: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const accounts = await this.accountsService.listDirectory(
        this.getContext(user),
        {
          search,
          industry,
          limit: limit ? Number(limit) : undefined,
          offset: offset ? Number(offset) : undefined,
        },
      );
      return { ok: true, data: accounts };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Get("public/:slug")
  @Public()
  async getPublic(
    @Param("slug") slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const account = await this.accountsService.getPublicAccountBySlug(slug);
    if (!account) {
      res.status(404);
      return { ok: false, error: "Account not found." };
    }
    return { ok: true, data: account };
  }

  @Get(":id")
  @UseGuards(RequireBusinessGuard)
  async get(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.accountsService.getAccountWithContacts(
        this.getContext(user),
        id,
      );
      if (!result) {
        res.status(404);
        return { ok: false, error: "Account not found." };
      }
      return { ok: true, data: result };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Put(":id")
  @UseGuards(RequireBusinessGuard)
  async update(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = accountInputSchema.partial().safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid account details." };
    }
    try {
      const account = await this.accountsService.updateAccount(
        this.getContext(user),
        id,
        input.data,
      );
      if (!account) {
        res.status(404);
        return { ok: false, error: "Account not found." };
      }
      return { ok: true, data: account };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Delete(":id")
  @UseGuards(RequireBusinessGuard)
  async remove(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const deleted = await this.accountsService.deleteAccount(
        this.getContext(user),
        id,
      );
      if (!deleted) {
        res.status(404);
        return { ok: false, error: "Account not found." };
      }
      return { ok: true, data: { deleted: true } };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Post(":id/connect")
  @UseGuards(RequireBusinessGuard)
  async connect(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body("toAccountId") toAccountId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!toAccountId || typeof toAccountId !== "string") {
      res.status(400);
      return { ok: false, error: "Target account ID is required." };
    }
    try {
      const connection = await this.accountsService.requestConnection(
        this.getContext(user),
        id,
        toAccountId,
      );
      res.status(201);
      return { ok: true, data: connection };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Get(":id/connections")
  @UseGuards(RequireBusinessGuard)
  async connections(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const connections = await this.accountsService.listConnections(
        this.getContext(user),
        id,
      );
      return { ok: true, data: connections };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Put("connections/:connectionId")
  @UseGuards(RequireBusinessGuard)
  async respond(
    @AuthUser() user: AuthContext,
    @Param("connectionId") connectionId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = connectionResponseSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid status." };
    }
    try {
      const connection = await this.accountsService.respondConnection(
        this.getContext(user),
        connectionId,
        input.data.status,
      );
      if (!connection) {
        res.status(404);
        return { ok: false, error: "Connection not found." };
      }
      return { ok: true, data: connection };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Put(":id/customers/:customerId")
  @UseGuards(RequireBusinessGuard)
  async linkCustomer(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Param("customerId") customerId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const customer = await this.accountsService.linkCustomerToAccount(
        this.getContext(user),
        customerId,
        id,
      );
      if (!customer) {
        res.status(404);
        return { ok: false, error: "Customer not found." };
      }
      return { ok: true, data: customer };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Delete(":id/customers/:customerId")
  @UseGuards(RequireBusinessGuard)
  async unlinkCustomer(
    @AuthUser() user: AuthContext,
    @Param("customerId") customerId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const customer = await this.accountsService.linkCustomerToAccount(
        this.getContext(user),
        customerId,
        null,
      );
      if (!customer) {
        res.status(404);
        return { ok: false, error: "Customer not found." };
      }
      return { ok: true, data: customer };
    } catch (error) {
      if (error instanceof AccountError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }
}
