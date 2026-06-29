import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULE_KEY = 'required_module';

export interface RequiredModuleMetadata {
  product: string;
  moduleKey: string;
}

export const RequireModule = (product: string, moduleKey: string) =>
  SetMetadata(REQUIRED_MODULE_KEY, { product, moduleKey });
