import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class ConversationService {
  constructor(@InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>) { }

  async create(createConversationDto: CreateConversationDto) {
    const converstation = await this.conversationModel.create(createConversationDto);
    return await converstation.save();
  }

  async findAll() {
    return await this.conversationModel.find().exec();
  }

  async findById(id: string) {
    return await this.conversationModel.findById(id)
      .populate('participants.user', 'firstName lastName username avatar status lastActive')
      .exec();
  }

  async findConversationByUserId(userId: string) {
    const conversation = await this.conversationModel.find({
      "participants.user": userId
    })
      .populate('participants.user', 'firstName lastName username avatar status lastActive')
      .populate('lastMessage', 'content type createdAt')
      .exec();
    return conversation;
  }


  async updateLastMessage(id: string, lastMessage: string) {
    return await this.conversationModel.updateOne({ _id: id }, { $set: { lastMessage: lastMessage, lastMessageAt: new Date() } }).exec();
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    return await this.conversationModel.findByIdAndUpdate(id, updateConversationDto, { new: true }).exec();
  }

  async remove(id: string) {
    return await this.conversationModel.findByIdAndDelete(id).exec();
  }

  // ============ CHAT FEATURES ============

  // Kiểm tra user có phải admin không
  async isUserAdmin(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) return false;

    const participant = conversation.participants.find(
      p => p.user.toString() === userId
    );
    return participant?.isAdmin ?? false;
  }

  // Kiểm tra user có trong conversation không
  async isUserInConversation(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) return false;

    return conversation.participants.some(p => p.user.toString() === userId);
  }

  // 1. Thay đổi Quick Reaction
  async updateQuickReaction(conversationId: string, userId: string, emoji: string) {
    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của cuộc trò chuyện này');
    }

    return await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $set: { quickReaction: emoji } },
      { new: true }
    ).exec();
  }

  // 2. Thay đổi Nickname của member trong conversation
  async updateMemberNickname(conversationId: string, userId: string, targetUserId: string, nickname: string) {
    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của cuộc trò chuyện này');
    }

    return await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, 'participants.user': targetUserId },
      { $set: { 'participants.$.nickname': nickname } },
      { new: true }
    ).populate('participants.user', 'firstName lastName username avatar').exec();
  }

  // 3. Thay đổi tên nhóm (nickname của conversation)
  async updateGroupName(conversationId: string, userId: string, name: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể đổi tên cho nhóm chat');
    }

    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của nhóm này');
    }

    return await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $set: { nickname: name } },
      { new: true }
    ).exec();
  }

  // 4. Thay đổi avatar nhóm
  async updateGroupAvatar(conversationId: string, userId: string, avatarUrl: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể đổi avatar cho nhóm chat');
    }

    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của nhóm này');
    }

    return await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $set: { avatar: avatarUrl } },
      { new: true }
    ).exec();
  }

  // 5. Thêm thành viên vào nhóm
  async addMember(conversationId: string, adminUserId: string, newUserId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể thêm thành viên vào nhóm chat');
    }

    const isAdmin = await this.isUserAdmin(conversationId, adminUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Chỉ admin mới có thể thêm thành viên');
    }

    // Kiểm tra user đã trong nhóm chưa
    const alreadyExists = conversation.participants.some(
      p => p.user.toString() === newUserId
    );
    if (alreadyExists) {
      throw new BadRequestException('Người dùng đã là thành viên của nhóm');
    }

    return await this.conversationModel.findByIdAndUpdate(
      conversationId,
      {
        $push: {
          participants: {
            user: new Types.ObjectId(newUserId),
            joinedAt: new Date(),
            isAdmin: false,
            nickname: ''
          }
        }
      },
      { new: true }
    ).populate('participants.user', 'firstName lastName username avatar').exec();
  }

  // 6. Kick thành viên khỏi nhóm
  async removeMember(conversationId: string, adminUserId: string, targetUserId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể kick thành viên từ nhóm chat');
    }

    const isAdmin = await this.isUserAdmin(conversationId, adminUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Chỉ admin mới có thể kick thành viên');
    }

    // Không thể kick creator
    if (conversation.creator?.toString() === targetUserId) {
      throw new ForbiddenException('Không thể kick người tạo nhóm');
    }

    return await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $pull: { participants: { user: new Types.ObjectId(targetUserId) } } },
      { new: true }
    ).populate('participants.user', 'firstName lastName username avatar').exec();
  }

  // 7. Phân quyền admin (tối đa 3 người)
  async updateAdminStatus(conversationId: string, adminUserId: string, targetUserId: string, isAdmin: boolean) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể phân quyền trong nhóm chat');
    }

    const currentUserIsAdmin = await this.isUserAdmin(conversationId, adminUserId);
    if (!currentUserIsAdmin) {
      throw new ForbiddenException('Chỉ admin mới có thể phân quyền');
    }

    // Đếm số admin hiện tại
    if (isAdmin) {
      const currentAdminCount = conversation.participants.filter(p => p.isAdmin).length;
      if (currentAdminCount >= 3) {
        throw new BadRequestException('Đã đạt giới hạn tối đa 3 admin');
      }
    }

    // Không thể tự bỏ quyền admin của creator
    if (!isAdmin && conversation.creator?.toString() === targetUserId) {
      throw new ForbiddenException('Không thể bỏ quyền admin của người tạo nhóm');
    }

    return await this.conversationModel.findOneAndUpdate(
      { _id: conversationId, 'participants.user': targetUserId },
      { $set: { 'participants.$.isAdmin': isAdmin } },
      { new: true }
    ).populate('participants.user', 'firstName lastName username avatar').exec();
  }

  // 8. Rời nhóm
  async leaveGroup(conversationId: string, userId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể rời khỏi nhóm chat');
    }

    // Nếu là creator và còn thành viên, chuyển quyền creator cho admin khác
    if (conversation.creator?.toString() === userId) {
      const otherAdmins = conversation.participants.filter(
        p => p.isAdmin && p.user.toString() !== userId
      );

      if (otherAdmins.length > 0) {
        // Chuyển creator cho admin đầu tiên
        await this.conversationModel.findByIdAndUpdate(conversationId, {
          $set: { creator: otherAdmins[0].user }
        });
      } else if (conversation.participants.length > 1) {
        // Nếu không có admin khác, chuyển cho thành viên đầu tiên
        const otherMembers = conversation.participants.filter(
          p => p.user.toString() !== userId
        );
        if (otherMembers.length > 0) {
          await this.conversationModel.findByIdAndUpdate(conversationId, {
            $set: { creator: otherMembers[0].user },
            $addToSet: { 'participants.$[elem].isAdmin': true }
          }, {
            arrayFilters: [{ 'elem.user': otherMembers[0].user }]
          });
        }
      }
    }

    return await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $pull: { participants: { user: new Types.ObjectId(userId) } } },
      { new: true }
    ).exec();
  }
}
