'use client';
import {
    Box, Typography, IconButton, Divider, useTheme,
} from '@mui/material';
import {
    ThumbUp as ThumbUpIcon,
    ChatBubbleOutline as CommentIcon,
    Share as ShareIcon,
    Close as CloseIcon,
    Lock as LockIcon,
} from '@mui/icons-material';
import { getAuthorName } from '@/utils/formatPost';
import ReactionButton from '@/components/posts/ReactionButton';
import CommentSection from '@/components/posts/CommentSection';
import { PostType } from '@/types/post';
import { useState, useEffect } from 'react';
import { HashtagContent } from '@/utils/hashtagParser';
import { useReactionStore } from '@/stores/useReactionStore';
import ReactionListDialog from '@/components/posts/ReactionListDialog';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTranslation } from 'react-i18next';

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
    const { user } = useAuthStore();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const [totalComments, setTotalComments] = useState<number>(commentingPost?.totalComments || 0);
    const { t } = useTranslation();

    const [reactionListOpen, setReactionListOpen] = useState(false);


    // Use global store for reaction state
    const { postReactions, initPostReaction } = useReactionStore();
    const reactionState = commentingPost ? postReactions[commentingPost._id] : null;

    // Get totalReacts from global store
    const displayTotalReacts = reactionState?.totalReacts ?? commentingPost?.totalReacts ?? 0;

    // Check if features are allowed
    const allowComments = commentingPost?.allowComments !== false;
    const allowShares = commentingPost?.allowShares !== false;
    const allowReactions = commentingPost?.allowReactions !== false;

    // Initialize store with post data on mount
    useEffect(() => {
        if (commentingPost) {
            initPostReaction(commentingPost._id, commentingPost.totalReacts);
        }
    }, [commentingPost, initPostReaction]);

    return (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 700, maxHeight: '90vh', bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, borderBottom: `1px solid ${theme.palette.divider}`, position: 'relative' }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>{t('post.post_by', { name: commentingPost ? getAuthorName(commentingPost) : '' })}</Typography>
                <IconButton onClick={() => setOpenCommentModal(false)} sx={{ position: 'absolute', right: 12, bgcolor: hoverBg, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.15)' : '#d8dadf' } }}><CloseIcon /></IconButton>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {commentingPost && renderPostMedia(commentingPost)}
                {commentingPost && !commentingPost.media?.length && (
                    <Typography sx={{ mb: 2, fontSize: 15, color: 'text.primary' }}>
                        <HashtagContent content={commentingPost?.content || ''} />
                    </Typography>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, cursor: displayTotalReacts > 0 ? 'pointer' : 'default',
                        '&:hover': displayTotalReacts > 0 ? { textDecoration: 'underline' } : {}
                    }}
                        onClick={() => displayTotalReacts > 0 && setReactionListOpen(true)}
                    >
                        {/* Show top 3 reactions */}
                        {commentingPost?.topReactions && commentingPost.topReactions.length > 0 ? (
                            <Box sx={{ display: 'flex', ml: -0.5 }}>
                                {commentingPost.topReactions.slice(0, 3).map((reaction, index) => {
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
                            <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>{displayTotalReacts}</Typography>
                        )}
                    </Box>
                    <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>{totalComments} {t('post.comments_count')} · {commentingPost?.totalShares} {t('post.shares')}</Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
                    {/* Reaction Button - disabled if not allowed */}
                    {commentingPost && allowReactions ? (
                        <ReactionButton
                            post={commentingPost}
                            initialTotalReacts={commentingPost.totalReacts}
                        />
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'center', py: 1, opacity: 0.5 }}>
                            <LockIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                            <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 15 }}>{t('post.disabled')}</Typography>
                        </Box>
                    )}

                    {/* Comment Button - disabled if not allowed */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: allowComments ? 'pointer' : 'default',
                            flex: 1,
                            justifyContent: 'center',
                            py: 1,
                            borderRadius: 2,
                            opacity: allowComments ? 1 : 0.5,
                            '&:hover': { bgcolor: allowComments ? hoverBg : 'transparent' }
                        }}
                    >
                        {allowComments ? (
                            <CommentIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                        ) : (
                            <LockIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                        )}
                        <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 15 }}>
                            {allowComments ? t('post.comment') : t('post.comments_disabled')}
                        </Typography>
                    </Box>

                    {/* Share Button - disabled if not allowed */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: allowShares ? 'pointer' : 'default',
                            flex: 1,
                            justifyContent: 'center',
                            py: 1,
                            borderRadius: 2,
                            opacity: allowShares ? 1 : 0.5,
                            '&:hover': { bgcolor: allowShares ? hoverBg : 'transparent' }
                        }}
                        onClick={() => allowShares && commentingPost && handleOpenShare(commentingPost)}
                    >
                        {allowShares ? (
                            <ShareIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                        ) : (
                            <LockIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                        )}
                        <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 15 }}>
                            {allowShares ? t('post.share') : t('post.shares_disabled')}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Comment Section - only show if comments are allowed */}
                {commentingPost && allowComments ? (
                    <CommentSection onChangeTotalComments={setTotalComments} postId={commentingPost._id} />
                ) : (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        <LockIcon sx={{ fontSize: 48, mb: 1 }} />
                        <Typography>{t('post.owner_disabled_comments')}</Typography>
                    </Box>
                )}
            </Box>
            {commentingPost &&
                <ReactionListDialog
                    open={reactionListOpen}
                    onClose={() => setReactionListOpen(false)}
                    postId={commentingPost._id}
                    userId={user?.id || ""}
                />

            }
        </Box>

    );
}
