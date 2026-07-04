import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class SetFeatureFlagDto {
  @IsString()
  @IsNotEmpty()
  product!: string;

  @IsString()
  @IsNotEmpty()
  featureKey!: string;

  @IsBoolean()
  enabled!: boolean;
}
