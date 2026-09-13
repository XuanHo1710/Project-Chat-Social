import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AIServerService } from '../services/ai-server.service';
import {
  InteractionType,
  PostEventDto,
  PostEventType,
  UserInteractionEventDto,
} from './dto/feed-event.dto';
import {
  UserInteraction,
  UserInteractionDocument,
} from './schemas/user-interaction.schema';

const FOLLOW_INTERACTION_TYPES = new Set<string>([
  InteractionType.USER_FOLLOW,
  InteractionType.USER_UNFOLLOW,
]);

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @InjectModel(UserInteraction.name)
    private readonly userInteractionModel: Model<UserInteractionDocument>,
    private readonly aiServerService: AIServerService,
  ) {}

  async handlePostEvent(event: PostEventDto): Promise<void> {
    this.logger.debug(`Processing ${event.eventType} for post ${event.postId}`);

    switch (event.eventType) {
      case PostEventType.POST_CREATED:
      case PostEventType.POST_UPDATED:
        // POST /embed/post replaces the embedding from canonical MongoDB
        // state, so updates re-embed safely without trusting payload copies.
        // Failures throw so the consumer retries and dead-letters instead of
        // committing the offset early.
        await this.aiServerService.embedPost({
          post_id: event.postId,
          content: event.postData?.content || '',
          user_id: event.authorId,
          privacy: event.postData?.privacy || 'PUBLIC',
          group_id: event.postData?.groupId,
          media_type: event.postData?.mediaType || 'TEXT',
          created_at: new Date(event.timestamp).toISOString(),
        });
        return;
      case PostEventType.POST_DELETED:
        await this.aiServerService.deletePostEmbedding(event.postId);
        return;
      case PostEventType.POST_SHARED:
        // The original post is already embedded. The interaction topic records the share signal.
        return;
      default:
        throw new Error(`Unsupported post event: ${String(event.eventType)}`);
    }
  }

  async handleInteractionEvent(
    event: UserInteractionEventDto,
    eventId: string,
  ): Promise<void> {
    const interaction = await this.userInteractionModel
      .findOneAndUpdate(
        { eventId },
        {
          $setOnInsert: {
            eventId,
            userId: new Types.ObjectId(event.userId),
            interactionType: event.interactionType,
            targetId: event.targetId
              ? new Types.ObjectId(event.targetId)
              : undefined,
            targetType: event.targetType,
            metadata: event.metadata,
            eventTimestamp: new Date(event.timestamp),
            aiSynced: false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();

    if (!interaction) {
      throw new Error(`Could not persist interaction ${eventId}`);
    }
    if (interaction.aiSynced) {
      this.logger.debug(`Skipping already processed interaction ${eventId}`);
      return;
    }

    const persistedUserId = interaction.userId.toHexString();
    const persistedTargetId = interaction.targetId?.toHexString();
    if (interaction.targetType === 'POST' && persistedTargetId) {
      await this.aiServerService.trackInteraction(
        persistedUserId,
        persistedTargetId,
        interaction.interactionType,
        eventId,
      );
    }

    await this.userInteractionModel.updateOne(
      { _id: interaction._id, aiSynced: false },
      { $set: { aiSynced: true } },
    );

    if (FOLLOW_INTERACTION_TYPES.has(interaction.interactionType)) {
      this.logger.debug(
        `${interaction.interactionType}: ${persistedUserId} -> ${persistedTargetId || ''}`,
      );
    }
  }
}
