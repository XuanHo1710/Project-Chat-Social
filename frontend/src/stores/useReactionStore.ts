import { create } from 'zustand';

export type ReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';

interface PostReactionState {
    totalReacts: number;
    userReaction: ReactionType | null;
    // Track if user has EVER interacted with this post locally
    // Once true, API responses will NEVER overwrite userReaction
    hasInteracted: boolean;
    // Track if initial API data has been loaded
    apiLoaded: boolean;
}

interface ReactionStore {
    // Map postId -> { totalReacts, userReaction, ... }
    postReactions: Record<string, PostReactionState>;

    // Update reaction for a post (from user interaction - optimistic)
    setPostReaction: (postId: string, state: Partial<PostReactionState>) => void;

    // Get reaction state for a post
    getPostReaction: (postId: string) => PostReactionState | undefined;

    // Initialize from post data (only if not exists)
    initPostReaction: (postId: string, totalReacts: number, userReaction?: ReactionType | null) => void;

    // Set from API - ONLY on initial load, NEVER after user interaction
    setFromApi: (postId: string, userReaction: ReactionType | null) => void;

    // Set from server socket response (updates totalReacts)
    setFromServer: (postId: string, totalReacts: number) => void;

    // Restore initial state
    reset: () => void;
}

export const useReactionStore = create<ReactionStore>((set, get) => ({
    postReactions: {},

    reset: () => set({ postReactions: {} }),

    setPostReaction: (postId, state) => {
        set(prev => ({
            postReactions: {
                ...prev.postReactions,
                [postId]: {
                    ...prev.postReactions[postId],
                    ...state,
                    // Ensure totalReacts never goes below 0
                    totalReacts: Math.max(0, state.totalReacts ?? prev.postReactions[postId]?.totalReacts ?? 0),
                    // Mark as interacted - this NEVER goes back to false
                    hasInteracted: true,
                    apiLoaded: prev.postReactions[postId]?.apiLoaded ?? false
                }
            }
        }));
    },

    getPostReaction: (postId) => {
        return get().postReactions[postId];
    },

    initPostReaction: (postId, totalReacts, userReaction = null) => {
        const current = get().postReactions[postId];
        // Only init if not exists
        if (!current) {
            set(prev => ({
                postReactions: {
                    ...prev.postReactions,
                    [postId]: {
                        totalReacts: Math.max(0, totalReacts),
                        userReaction,
                        hasInteracted: false,
                        apiLoaded: false
                    }
                }
            }));
        }
    },

    // Set from API - ONLY if user has NEVER interacted AND API not loaded yet
    setFromApi: (postId, userReaction) => {
        const current = get().postReactions[postId];

        // NEVER overwrite if user has interacted with this post
        if (current?.hasInteracted) {
            return;
        }

        // Only set once (prevent stale cache from overwriting)
        if (current?.apiLoaded) {
            return;
        }

        set(prev => ({
            postReactions: {
                ...prev.postReactions,
                [postId]: {
                    ...prev.postReactions[postId],
                    userReaction,
                    hasInteracted: false,
                    apiLoaded: true
                }
            }
        }));
    },

    // Set from server socket response - only updates totalReacts
    setFromServer: (postId, totalReacts) => {
        set(prev => {
            const current = prev.postReactions[postId];
            return {
                postReactions: {
                    ...prev.postReactions,
                    [postId]: {
                        ...current,
                        totalReacts: Math.max(0, totalReacts),
                        // Keep all other flags unchanged
                        hasInteracted: current?.hasInteracted ?? false,
                        apiLoaded: current?.apiLoaded ?? false
                    }
                }
            };
        });
    }
}));
