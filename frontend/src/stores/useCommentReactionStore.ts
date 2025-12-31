import { create } from 'zustand';

export type CommentReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';

interface CommentReactionState {
    totalLikes: number;
    userReaction: CommentReactionType | null;
    // Track if user has EVER interacted with this comment locally
    hasInteracted: boolean;
    // Track if initial API data has been loaded
    apiLoaded: boolean;
}

interface CommentReactionStore {
    // Map commentId -> { totalLikes, userReaction, ... }
    commentReactions: Record<string, CommentReactionState>;

    // Update reaction for a comment (from user interaction - optimistic)
    setCommentReaction: (commentId: string, state: Partial<CommentReactionState>) => void;

    // Get reaction state for a comment
    getCommentReaction: (commentId: string) => CommentReactionState | undefined;

    // Initialize from comment data (only if not exists)
    initCommentReaction: (commentId: string, totalLikes: number, userReaction?: CommentReactionType | null) => void;

    // Set from API - ONLY on initial load, NEVER after user interaction
    setFromApi: (commentId: string, userReaction: CommentReactionType | null) => void;

    // Set from server socket response (updates totalLikes)
    setFromServer: (commentId: string, totalLikes: number) => void;
}

export const useCommentReactionStore = create<CommentReactionStore>((set, get) => ({
    commentReactions: {},

    setCommentReaction: (commentId, state) => {
        set(prev => ({
            commentReactions: {
                ...prev.commentReactions,
                [commentId]: {
                    ...prev.commentReactions[commentId],
                    ...state,
                    // Ensure totalLikes never goes below 0
                    totalLikes: Math.max(0, state.totalLikes ?? prev.commentReactions[commentId]?.totalLikes ?? 0),
                    // Mark as interacted - this NEVER goes back to false
                    hasInteracted: true,
                    apiLoaded: prev.commentReactions[commentId]?.apiLoaded ?? false
                }
            }
        }));
    },

    getCommentReaction: (commentId) => {
        return get().commentReactions[commentId];
    },

    initCommentReaction: (commentId, totalLikes, userReaction = null) => {
        const current = get().commentReactions[commentId];
        // Only init if not exists
        if (!current) {
            set(prev => ({
                commentReactions: {
                    ...prev.commentReactions,
                    [commentId]: {
                        totalLikes: Math.max(0, totalLikes),
                        userReaction,
                        hasInteracted: false,
                        apiLoaded: false
                    }
                }
            }));
        }
    },

    // Set from API - ONLY if user has NEVER interacted AND API not loaded yet
    setFromApi: (commentId, userReaction) => {
        const current = get().commentReactions[commentId];

        // NEVER overwrite if user has interacted with this comment
        if (current?.hasInteracted) {
            return;
        }

        // Only set once (prevent stale cache from overwriting)
        if (current?.apiLoaded) {
            return;
        }

        set(prev => ({
            commentReactions: {
                ...prev.commentReactions,
                [commentId]: {
                    ...prev.commentReactions[commentId],
                    userReaction,
                    hasInteracted: false,
                    apiLoaded: true
                }
            }
        }));
    },

    // Set from server socket response - only updates totalLikes
    setFromServer: (commentId, totalLikes) => {
        set(prev => {
            const current = prev.commentReactions[commentId];
            return {
                commentReactions: {
                    ...prev.commentReactions,
                    [commentId]: {
                        ...current,
                        totalLikes: Math.max(0, totalLikes),
                        // Keep all other flags unchanged
                        hasInteracted: current?.hasInteracted ?? false,
                        apiLoaded: current?.apiLoaded ?? false
                    }
                }
            };
        });
    }
}));
