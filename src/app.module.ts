import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { TemplateDispatchModule } from './modules/template-dispatch/template-dispatch.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    TemplateDispatchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
