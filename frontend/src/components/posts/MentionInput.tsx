"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
    Box,
    Avatar,
    Typography,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Paper,
    InputBase,
    CircularProgress,
} from "@mui/material";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDisplayListFriends } from "@/queries/useRelationshipQueries";
import { FriendType } from "@/types/account";

interface MentionUser {
    username: string;
    name: string;
    avatar?: string;
}

interface MentionInputProps {
    value: string;
    onChange: (value: string) => void;
    onMentionSelect?: (user: MentionUser) => void;
    placeholder?: string;
    multiline?: boolean;
    maxRows?: number;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    sx?: object;
}

// Parse raw content to display format
function parseForDisplay(content: string): string {
    return content.replace(/@\[(.+?):([^\]]+)\]/g, '@$2');
}

// Build mapping from display mentions to raw mentions
function buildMentionMap(content: string): Map<string, string> {
    const map = new Map<string, string>();
    const regex = /@\[([a-f0-9]+):([^\]]+)\]/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const displayMention = `@${match[2]}`;
        const rawMention = match[0];
        map.set(displayMention, rawMention);
    }
    return map;
}

export default function MentionInput({
    value,
    onChange,
    onMentionSelect,
    placeholder = "Viết bình luận...",
    multiline = true,
    maxRows = 4,
    inputRef: externalInputRef,
    onKeyDown,
    sx,
}: MentionInputProps) {
    const { user } = useAuthStore();
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const internalInputRef = useRef<HTMLInputElement>(null);
    const inputRef = externalInputRef || internalInputRef;
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Keep track of the mention map from the original value
    const mentionMapRef = useRef<Map<string, string>>(new Map());

    // Initialize mention map from initial value
    useEffect(() => {
        mentionMapRef.current = buildMentionMap(value);
    }, []); // Only on mount

    // Display value (parsed)
    const displayValue = useMemo(() => parseForDisplay(value), [value]);

    // Fetch friends list
    const { data: friendsData, isLoading: isFriendsLoading } = useDisplayListFriends(user?.id || "");
    const friends: FriendType[] = friendsData?.data || [];

    // Filter suggestions based on query
    const filteredSuggestions = useCallback(() => {
        if (!mentionQuery) return friends.slice(0, 10);

        const query = mentionQuery.toLowerCase();
        return friends
            .filter(f => {
                const fullName = `${f.firstName} ${f.lastName}`.toLowerCase();
                return fullName.includes(query) || f.username.toLowerCase().includes(query);
            })
            .slice(0, 10);
    }, [friends, mentionQuery]);

    const suggestions = filteredSuggestions();

    // Convert display value back to raw value (restore existing mentions)
    const displayToRaw = useCallback((displayContent: string): string => {
        let result = displayContent;
        mentionMapRef.current.forEach((rawMention, displayMention) => {
            // Use word boundary to avoid partial matches
            const escapedDisplay = displayMention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedDisplay + '(?![\\w])', 'g');
            result = result.replace(regex, rawMention);
        });
        return result;
    }, []);

    // Handle input change with @ detection
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDisplayValue = e.target.value;
        const cursorPos = e.target.selectionStart || 0;

        // Convert display back to raw format before calling onChange
        const newRawValue = displayToRaw(newDisplayValue);
        onChange(newRawValue);

        // Detect @ symbol for suggestions
        const textBeforeCursor = newDisplayValue.slice(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf("@");

        if (lastAtIndex !== -1) {
            // Check if @ is at start or preceded by space
            const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
            if (charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) {
                const query = textBeforeCursor.slice(lastAtIndex + 1);
                // Only show if no space after @ and doesn't match an existing mention
                if (!query.includes(" ")) {
                    // Check if this @ is already a complete mention in the map
                    const potentialMention = `@${query}`;
                    const isExistingMention = Array.from(mentionMapRef.current.keys()).some(
                        key => key.startsWith(potentialMention) || key === potentialMention
                    );

                    if (!isExistingMention || query.length === 0) {
                        setMentionQuery(query);
                        setMentionStartIndex(lastAtIndex);
                        setShowSuggestions(true);
                        setSelectedIndex(0);
                        return;
                    }
                }
            }
        }

        setShowSuggestions(false);
        setMentionQuery("");
        setMentionStartIndex(-1);
    };

    // Handle selecting a mention
    const handleSelectMention = (friend: FriendType) => {
        if (mentionStartIndex === -1) return;

        const fullName = `${friend.firstName} ${friend.lastName}`.trim();
        const rawMentionText = `@[${friend.username}:${fullName}]`;
        const displayMentionText = `@${fullName}`;

        // Add to mention map
        mentionMapRef.current.set(displayMentionText, rawMentionText);

        // Work with display value
        const beforeMention = displayValue.slice(0, mentionStartIndex);
        const afterMention = displayValue.slice(mentionStartIndex + mentionQuery.length + 1); // +1 for @

        const newDisplayValue = beforeMention + displayMentionText + " " + afterMention;
        const newRawValue = displayToRaw(newDisplayValue);

        onChange(newRawValue);

        setShowSuggestions(false);
        setMentionQuery("");
        setMentionStartIndex(-1);

        // Focus back to input
        inputRef.current?.focus();

        onMentionSelect?.({
            username: friend.username,
            name: fullName,
            avatar: undefined,
        });
    };

    // Handle keyboard navigation in suggestions
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions && suggestions.length > 0) {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev < suggestions.length - 1 ? prev + 1 : 0
                    );
                    return;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev > 0 ? prev - 1 : suggestions.length - 1
                    );
                    return;
                case "Enter":
                    if (suggestions[selectedIndex]) {
                        e.preventDefault();
                        handleSelectMention(suggestions[selectedIndex]);
                        return;
                    }
                    break;
                case "Escape":
                    e.preventDefault();
                    setShowSuggestions(false);
                    return;
                case "Tab":
                    if (suggestions[selectedIndex]) {
                        e.preventDefault();
                        handleSelectMention(suggestions[selectedIndex]);
                        return;
                    }
                    break;
            }
        }

        // Call external onKeyDown if not handled
        onKeyDown?.(e);
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <Box sx={{ position: "relative", flex: 1, ...sx }}>
            <InputBase
                inputRef={inputRef}
                value={displayValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                multiline={multiline}
                maxRows={maxRows}
                sx={{
                    width: "100%",
                    fontSize: 13,
                    color: "#050505",
                }}
            />

            {/* Mention Suggestions Dropdown - only show if has suggestions or loading */}
            {showSuggestions && (isFriendsLoading || suggestions.length > 0) && (
                <Paper
                    ref={suggestionsRef}
                    elevation={8}
                    sx={{
                        position: "absolute",
                        bottom: "100%",
                        left: 0,
                        right: 0,
                        mb: 1,
                        maxHeight: 300,
                        overflow: "auto",
                        zIndex: 1500,
                        borderRadius: 2,
                    }}
                >
                    {isFriendsLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                            <CircularProgress size={20} />
                        </Box>
                    ) : (
                        <List dense sx={{ py: 0.5 }}>
                            {suggestions.map((friend, index) => {
                                const fullName = `${friend.firstName} ${friend.lastName}`.trim();
                                return (
                                    <ListItem
                                        key={friend._id}
                                        onClick={() => handleSelectMention(friend)}
                                        sx={{
                                            cursor: "pointer",
                                            bgcolor: index === selectedIndex ? "#e7f3ff" : "transparent",
                                            "&:hover": { bgcolor: "#f0f2f5" },
                                            py: 1,
                                            px: 2,
                                        }}
                                    >
                                        <ListItemAvatar sx={{ minWidth: 40 }}>
                                            <Avatar sx={{ width: 32, height: 32 }}>
                                                {friend.firstName?.[0] || "U"}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                                                    {fullName}
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography sx={{ fontSize: 12, color: "#65676b" }}>
                                                    @{friend.username}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </Paper>
            )}
        </Box>
    );
}
