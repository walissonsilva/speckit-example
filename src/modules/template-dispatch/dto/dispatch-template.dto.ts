import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class DispatchTemplateDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/)
  clientPhoneNumber: string;
}
