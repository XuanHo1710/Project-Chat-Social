'use client';
import {
    Box, Typography, IconButton, Divider,
} from '@mui/material';
import {

    ThumbUp as ThumbUpIcon,
    ChatBubbleOutline as CommentIcon,
    Share as ShareIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { getAuthorName } from '@/utils/formatPost';
import ReactionButton from '@/components/posts/ReactionButton';
import CommentSection from '@/components/posts/CommentSection';
import { PostType } from '@/types/post';
import { useState, useEffect } from 'react';
import { HashtagContent } from '@/utils/hashtagParser';
import { useReactionStore } from '@/stores/useReactionStore';

interface CommentContentModalProps {
    setOpenCommentModal: React.Dispatch<React.SetStateAction<boolean>>;
    commentingPost: PostType | null;
    renderPostMedia: (post: PostType) => React.ReactNode;
    handleOpenShare: (post: PostType) => void;
}

export default function CommentContentModal({
    setOpenCommentModal,
    commentingPost,
    renderPostMedia,
    handleOpenShare
}: CommentContentModalProps) {
    const [totalComments, setTotalComments] = useState<number>(commentingPost?.totalComments || 0);


    // Use global store for reaction state
    const { postReactions, initPostReaction } = useReactionStore();
    const reactionState = commentingPost ? postReactions[commentingPost._id] : null;

    // Get totalReacts from global store
    const displayTotalReacts = reactionState?.totalReacts ?? commentingPost?.totalReacts ?? 0;

    // Initialize store with post data on mount
    useEffect(() => {
        if (commentingPost) {
            initPostReaction(commentingPost._id, commentingPost.totalReacts);
        }
    }, [commentingPost, initPostReaction]);

    return (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 700, maxHeight: '90vh', bgcolor: 'white', borderRadius: 2, boxShadow: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, borderBottom: '1px solid #e4e6eb', position: 'relative' }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#050505' }}>Bài viết của {commentingPost ? getAuthorName(commentingPost) : ''}</Typography>
                <IconButton onClick={() => setOpenCommentModal(false)} sx={{ position: 'absolute', right: 12, bgcolor: '#e4e6eb', '&:hover': { bgcolor: '#d8dadf' } }}><CloseIcon /></IconButton>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {commentingPost && renderPostMedia(commentingPost)}
                {commentingPost && !commentingPost.media?.length && (
                    <Typography sx={{ mb: 2, fontSize: 15, color: '#050505' }}>
                        <HashtagContent content={commentingPost?.content || ''} />
                    </Typography>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ThumbUpIcon sx={{ fontSize: 12, color: 'white' }} /></Box>
                        <Typography sx={{ fontSize: 15, color: '#65676b' }}>{displayTotalReacts}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 15, color: '#65676b' }}>{totalComments} bình luận · {commentingPost?.totalShares} lượt chia sẻ</Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
                    {commentingPost && (
                        <ReactionButton
                            post={commentingPost}
                            initialTotalReacts={commentingPost.totalReacts}
                        />
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', flex: 1, justifyContent: 'center', py: 1, borderRadius: 2, '&:hover': { bgcolor: '#f0f2f5' } }}><CommentIcon sx={{ fontSize: 20, color: '#65676b' }} /><Typography sx={{ color: '#65676b', fontWeight: 600, fontSize: 15 }}>Bình luận</Typography></Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', flex: 1, justifyContent: 'center', py: 1, borderRadius: 2, '&:hover': { bgcolor: '#f0f2f5' } }} onClick={() => commentingPost && handleOpenShare(commentingPost)}><ShareIcon sx={{ fontSize: 20, color: '#65676b' }} /><Typography sx={{ color: '#65676b', fontWeight: 600, fontSize: 15 }}>Chia sẻ</Typography></Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Comment Section */}
                {commentingPost && (
                    <CommentSection onChangeTotalComments={setTotalComments} postId={commentingPost._id} />
                )}
            </Box>
        </Box>
    );
}