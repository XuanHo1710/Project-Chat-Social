
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThemeService } from './theme.service';
import { ThemeController } from './theme.controller';
import { Theme, ThemeSchema } from './schemas/theme.schema';

@Module({
    imports: [MongooseModule.forFeature([{ name: Theme.name, schema: ThemeSchema }])],
    controllers: [ThemeController],
    providers: [ThemeService],
    exports: [ThemeService]
})
export class ThemeModule { }
