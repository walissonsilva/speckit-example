import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { DispatchAcceptedDto } from '../dto/dispatch-accepted.dto';
import { DispatchTemplateDto } from '../dto/dispatch-template.dto';
import { TemplateDispatchService } from '../services/template-dispatch.service';

@Controller('template-dispatches')
export class TemplateDispatchController {
  constructor(
    private readonly templateDispatchService: TemplateDispatchService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async dispatch(
    @Body() dto: DispatchTemplateDto,
  ): Promise<DispatchAcceptedDto> {
    const dispatchId = await this.templateDispatchService.dispatch(dto);
    return { dispatchId };
  }
}
