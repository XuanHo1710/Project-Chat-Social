'use client';
import {
    Box, Card, CardContent, Avatar, Typography, IconButton, Divider,
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
import { PostType } from '@/types/post';
import { HashtagContent } from '@/utils/hashtagParser';
import { useReactionStore } from '@/stores/useReactionStore';
import { useEffect } from 'react';




export default function PostItem({ post, handleOpenMenu, handleOpenComments, handleOpenShare, renderPostMedia, PrivacyIconComponent }:
    {
        post: PostType, handleOpenMenu: (
            e: React.MouseEvent<HTMLElement>, post: PostType) => void,
        handleOpenComments: (post: PostType) => void, handleOpenShare: (post: PostType) => void,
        renderPostMedia: (post: PostType) => React.ReactNode,
        PrivacyIconComponent: React.ElementType
    }) {

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

    return (
        <Card key={post._id} sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            <CardContent sx={{ p: 2 }}>
                {/* Post Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ width: 40, height: 40, mr: 1.5 }} src={post.userId?.avatar} />
                    <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#050505' }}>{getAuthorName(post)}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '13px', color: '#65676b' }}>{formatPostTime(post.createdAt)}</Typography>
                            <Typography sx={{ fontSize: '13px', color: '#65676b' }}> · </Typography>
                            <PrivacyIconComponent sx={{ fontSize: '12px', color: '#65676b' }} />
                        </Box>
                    </Box>
                    <IconButton onClick={(e) => handleOpenMenu(e, post)}><MoreIcon /></IconButton>
                    <IconButton><CloseIcon /></IconButton>
                </Box>

                {/* Post Content with Hashtag Highlighting */}
                {post.background ? (
                    <Box sx={{ background: post.background, borderRadius: 2, p: 4, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                        <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'white', textAlign: 'center' }}>
                            <HashtagContent content={post.content || ''} onHashtagClick={handleHashtagClick} />
                        </Typography>
                    </Box>
                ) : (
                    <Typography sx={{ mb: 2, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#050505' }}>
                        <HashtagContent content={post.content || ''} onHashtagClick={handleHashtagClick} />
                    </Typography>
                )}

                {/* Render media */}
                {renderPostMedia(post)}

                {/* Like/Comment Count */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ThumbUpIcon sx={{ fontSize: 12, color: 'white' }} />
                        </Box>
                        <Typography sx={{ fontSize: 15, color: '#65676b' }}>{displayTotalReacts}</Typography>
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
                    <ReactionButton
                        postId={post._id}
                        initialTotalReacts={post.totalReacts}
                    />

                    <Box onClick={() => handleOpenComments(post)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, flex: 1, justifyContent: 'center', '&:hover': { bgcolor: '#f0f2f5' } }}>
                        <CommentIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                        <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Bình luận</Typography>
                    </Box>

                    <Box onClick={() => handleOpenShare(post)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, flex: 1, justifyContent: 'center', '&:hover': { bgcolor: '#f0f2f5' } }}>
                        <ShareIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                        <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Chia sẻ</Typography>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    )
}