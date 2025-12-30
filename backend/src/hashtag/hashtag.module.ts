import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HashtagController } from './hashtag.controller';
import { HashtagService } from './hashtag.service';
import { Hashtag, HashtagSchema } from './entities/hashtag.entity';
import { HashtagMapping, HashtagMappingSchema } from './entities/hashtag-mapping.entity';
import { HashtagStats, HashtagStatsSchema } from './entities/hashtag-stats.entity';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Hashtag.name, schema: HashtagSchema },
            { name: HashtagMapping.name, schema: HashtagMappingSchema },
            { name: HashtagStats.name, schema: HashtagStatsSchema },
        ]),
    ],
    controllers: [HashtagController],
    providers: [HashtagService],
    exports: [HashtagService], // Export để PostModule và CommentModule có thể sử dụng
})
export class HashtagModule { }
