'use client';
import {
    Box, Card, CardContent, Avatar, Typography, IconButton, Divider, keyframes
} from '@mui/material';
import {
    MoreHoriz as MoreIcon,
    ThumbUp as ThumbUpIcon,
    ChatBubbleOutline as CommentIcon,
    Share as ShareIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { formatPostTime, getAuthorName } from '@/utils/formatPost';
import ReactionButton from '@/components/posts/ReactionButton';
import ReactionListDialog from '@/components/posts/ReactionListDialog';
import SharedPostPreview from '@/components/posts/SharedPostPreview';
import { PostType } from '@/types/post';
import { HashtagContent } from '@/utils/hashtagParser';
import { useReactionStore } from '@/stores/useReactionStore';
import { useEffect, useState, forwardRef } from 'react';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';

// Highlight animation
const highlightPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(24, 119, 242, 0); }
  50% { box-shadow: 0 0 0 4px rgba(24, 119, 242, 0.3); }
`;

interface PostItemProps {
    post: PostType;
    userId: string;
    handleOpenMenu: (e: React.MouseEvent<HTMLElement>, post: PostType) => void;
    handleOpenComments: (post: PostType) => void;
    handleOpenShare: (post: PostType) => void;
    renderPostMedia: (post: PostType) => React.ReactNode;
    PrivacyIconComponent: React.ElementType;
    isHighlighted?: boolean;
    isGroupPost?: boolean;
    groupName?: string;
    groupAvatar?: string;
    groupId?: string;
}

const PostItem = forwardRef<HTMLDivElement, PostItemProps>(function PostItem({
    post,
    userId,
    handleOpenMenu,
    handleOpenComments,
    handleOpenShare,
    renderPostMedia,
    PrivacyIconComponent,
    isHighlighted = false,
    isGroupPost = false,
    groupName,
    groupAvatar,
    groupId,
}, ref) {
    const router = useRouter();
    const [reactionListOpen, setReactionListOpen] = useState(false);

    // Use global store for reaction state
    const { postReactions, initPostReaction } = useReactionStore();
    const reactionState = postReactions[post._id];

    // Get totalReacts from global store, fallback to post data
    const displayTotalReacts = reactionState?.totalReacts ?? post.totalReacts;

    // Initialize store with post data on mount
    useEffect(() => {
        initPostReaction(post._id, post.totalReacts);
    }, [post._id, post.totalReacts, initPostReaction]);

    const handleHashtagClick = (hashtag: string) => {
        // TODO: Navigate to hashtag search page
        console.log('Clicked hashtag:', hashtag);
        // router.push(`/search?q=%23${hashtag}`);
    };

    const handleProfileClick = () => {
        if (post.userId?.username) {
            router.push(CLIENT_PATH.PROFILE_BY_USERNAME(post.userId.username));
        }
    };

    const handleGroupClick = () => {
        if (groupId) {
            router.push(`/groups/${groupId}`);
        }
    };

    return (
        <Card
            ref={ref}
            sx={{
                mb: 2,
                borderRadius: 2,
                bgcolor: 'white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                ...(isHighlighted && {
                    border: '2px solid #1877f2',
                    animation: `${highlightPulse} 1.5s ease-in-out 3`,
                })
            }}
        >
            <CardContent sx={{ p: 2 }}>
                {/* Post Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    {/* Avatar container - Group post shows group avatar with user avatar overlay */}
                    {isGroupPost ? (
                        <Box sx={{ position: 'relative', mr: 1.5 }}>
                            {/* Group Avatar - main */}
                            <Avatar
                                sx={{
                                    width: 40,
                                    height: 40,
                                    cursor: 'pointer',
                                    '&:hover': { opacity: 0.9 },
                                    bgcolor: '#e4e6eb',
                                }}
                                src={groupAvatar}
                                onClick={handleGroupClick}
                            />
                            {/* User Avatar - small overlay at bottom right */}
                            <Avatar
                                sx={{
                                    width: 24,
                                    height: 24,
                                    position: 'absolute',
                                    bottom: -4,
                                    right: -4,
                                    border: '2px solid white',
                                    cursor: post.isAnonymous ? 'default' : 'pointer',
                                    '&:hover': { opacity: post.isAnonymous ? 1 : 0.8 },
                                    bgcolor: post.isAnonymous ? '#65676b' : undefined,
                                    fontSize: 10,
                                }}
                                src={post.isAnonymous ? undefined : post.userId?.avatar}
                                onClick={post.isAnonymous ? undefined : handleProfileClick}
                            >
                                {post.isAnonymous ? '?' : undefined}
                            </Avatar>
                        </Box>
                    ) : (
                        <Avatar
                            sx={{
                                width: 40,
                                height: 40,
                                mr: 1.5,
                                cursor: post.isAnonymous ? 'default' : 'pointer',
                                '&:hover': { opacity: post.isAnonymous ? 1 : 0.8 },
                                bgcolor: post.isAnonymous ? '#65676b' : undefined,
                            }}
                            src={post.isAnonymous ? undefined : post.userId?.avatar}
                            onClick={post.isAnonymous ? undefined : handleProfileClick}
                        >
                            {post.isAnonymous ? '?' : undefined}
                        </Avatar>
                    )}

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* Group post: Show group name first, then user name below */}
                        {isGroupPost && groupName ? (
                            <>
                                <Typography
                                    sx={{
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        color: '#050505',
                                        cursor: 'pointer',
                                        '&:hover': { textDecoration: 'underline' },
                                        lineHeight: 1.2,
                                    }}
                                    onClick={handleGroupClick}
                                >
                                    {groupName}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: '#65676b',
                                            cursor: post.isAnonymous ? 'default' : 'pointer',
                                            '&:hover': { textDecoration: post.isAnonymous ? 'none' : 'underline' },
                                        }}
                                        onClick={post.isAnonymous ? undefined : handleProfileClick}
                                    >
                                        {post.isAnonymous ? 'Thành viên ẩn danh' : getAuthorName(post)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '13px', color: '#65676b' }}>·</Typography>
                                    <Typography sx={{ fontSize: '13px', color: '#65676b' }}>{formatPostTime(post.createdAt)}</Typography>
                                    <Typography sx={{ fontSize: '13px', color: '#65676b' }}>·</Typography>
                                    <PrivacyIconComponent sx={{ fontSize: '12px', color: '#65676b' }} />
                                </Box>
                            </>
                        ) : (
                            <>
                                <Typography
                                    sx={{
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        color: '#050505',
                                        cursor: post.isAnonymous ? 'default' : 'pointer',
                                        '&:hover': { textDecoration: post.isAnonymous ? 'none' : 'underline' }
                                    }}
                                    onClick={post.isAnonymous ? undefined : handleProfileClick}
                                >
                                    {post.isAnonymous ? 'Thành viên ẩn danh' : getAuthorName(post)}
                                    {/* Show shared indicator */}
                                    {post.sharedPostId && (
                                        <Typography component="span" sx={{ fontWeight: 400, color: '#65676b', fontSize: '14px' }}>
                                            {' đã chia sẻ một bài viết'}
                                        </Typography>
                                    )}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography sx={{ fontSize: '13px', color: '#65676b' }}>{formatPostTime(post.createdAt)}</Typography>
                                    <Typography sx={{ fontSize: '13px', color: '#65676b' }}> · </Typography>
                                    <PrivacyIconComponent sx={{ fontSize: '12px', color: '#65676b' }} />
                                </Box>
                            </>
                        )}
                    </Box>
                    <IconButton onClick={(e) => handleOpenMenu(e, post)} sx={{ mt: -0.5 }}><MoreIcon /></IconButton>
                    <IconButton sx={{ mt: -0.5 }}><CloseIcon /></IconButton>
                </Box>

                {/* Post Content with Hashtag Highlighting - Only show if not a share or has caption */}
                {!post.sharedPostId ? (
                    // Normal post content
                    post.background ? (
                        <Box sx={{ background: post.background, borderRadius: 2, p: 4, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                            <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'white', textAlign: 'center' }}>
                                <HashtagContent content={post.content || ''} onHashtagClick={handleHashtagClick} />
                            </Typography>
                        </Box>
                    ) : (
                        <Typography sx={{ mb: 2, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#050505' }}>
                            <HashtagContent content={post.content || ''} onHashtagClick={handleHashtagClick} />
                        </Typography>
                    )
                ) : (
                    // Shared post - show caption if exists, then shared content
                    <>
                        {post.content && (
                            <Typography sx={{ mb: 2, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#050505' }}>
                                <HashtagContent content={post.content} onHashtagClick={handleHashtagClick} />
                            </Typography>
                        )}
                        <Box sx={{ mb: 2 }}>
                            {post && post.sharedPostId &&
                                <SharedPostPreview
                                    sharedPost={post.sharedPostId}
                                    onHashtagClick={handleHashtagClick}
                                    renderPostMedia={renderPostMedia}
                                    onClick={() => handleOpenComments(post.sharedPostId as PostType)}
                                />
                            }
                        </Box>
                    </>
                )}

                {/* Render media - only for non-shared posts */}
                {!post.sharedPostId && renderPostMedia(post)}

                {/* Like/Comment Count */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: displayTotalReacts > 0 ? 'pointer' : 'default',
                            '&:hover': displayTotalReacts > 0 ? { textDecoration: 'underline' } : {}
                        }}
                        onClick={() => displayTotalReacts > 0 && setReactionListOpen(true)}
                    >
                        {/* Show top 3 reaction types */}
                        {post.topReactions && post.topReactions.length > 0 ? (
                            <Box sx={{ display: 'flex', ml: -0.5 }}>
                                {post.topReactions.slice(0, 3).map((reaction, index) => {
                                    const reactionEmoji: Record<string, { emoji: string; bg: string }> = {
                                        LIKE: { emoji: '👍', bg: '#1877f2' },
                                        LOVE: { emoji: '❤️', bg: '#f33e58' },
                                        HAHA: { emoji: '😆', bg: '#f7b125' },
                                        WOW: { emoji: '😮', bg: '#f7b125' },
                                        SAD: { emoji: '😢', bg: '#f7b125' },
                                        ANGRY: { emoji: '😡', bg: '#e9710f' },
                                    };
                                    const reactionData = reactionEmoji[reaction.type] || { emoji: '👍', bg: '#1877f2' };
                                    return (
                                        <Box
                                            key={reaction.type}
                                            sx={{
                                                width: 25,
                                                height: 25,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 20,
                                                ml: index > 0 ? -0.5 : 0,
                                                zIndex: 3 - index,
                                            }}
                                        >
                                            {reactionData.emoji}
                                        </Box>
                                    );
                                })}
                            </Box>
                        ) : displayTotalReacts > 0 ? (
                            <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ThumbUpIcon sx={{ fontSize: 12, color: 'white' }} />
                            </Box>
                        ) : null}
                        {displayTotalReacts > 0 && (
                            <Typography sx={{ fontSize: 15, color: '#65676b' }}>{displayTotalReacts}</Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Typography sx={{ fontSize: 15, color: '#65676b', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleOpenComments(post)}>{post.totalComments} bình luận</Typography>
                        <Typography sx={{ fontSize: 15, color: '#65676b' }}>{post.totalShares} lượt chia sẻ</Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Post Actions with Reaction Picker */}
                <Box sx={{ display: 'flex', justifyContent: 'space-around', position: 'relative' }}>
                    {/* Reaction Button - uses global store automatically */}
                    {post.allowReactions !== false ? (
                        <ReactionButton
                            post={post}
                            initialTotalReacts={post.totalReacts}
                        />
                    ) : (
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 1,
                            px: 2,
                            flex: 1,
                            justifyContent: 'center',
                            opacity: 0.5,
                            cursor: 'not-allowed'
                        }}>
                            <ThumbUpIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Thích</Typography>
                        </Box>
                    )}

                    <Box
                        onClick={() => post.allowComments !== false && handleOpenComments(post)}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 1,
                            px: 2,
                            cursor: post.allowComments !== false ? 'pointer' : 'not-allowed',
                            borderRadius: 2,
                            flex: 1,
                            justifyContent: 'center',
                            opacity: post.allowComments !== false ? 1 : 0.5,
                            '&:hover': { bgcolor: post.allowComments !== false ? '#f0f2f5' : 'transparent' }
                        }}
                    >
                        <CommentIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                        <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Bình luận</Typography>
                    </Box>

                    <Box
                        onClick={() => post.allowShares !== false && handleOpenShare(post)}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 1,
                            px: 2,
                            cursor: post.allowShares !== false ? 'pointer' : 'not-allowed',
                            borderRadius: 2,
                            flex: 1,
                            justifyContent: 'center',
                            opacity: post.allowShares !== false ? 1 : 0.5,
                            '&:hover': { bgcolor: post.allowShares !== false ? '#f0f2f5' : 'transparent' }
                        }}
                    >
                        <ShareIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                        <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Chia sẻ</Typography>
                    </Box>
                </Box>
            </CardContent>

            <ReactionListDialog
                open={reactionListOpen}
                onClose={() => setReactionListOpen(false)}
                postId={post._id}
                userId={userId}
            />
        </Card>
    )
});

export default PostItem;