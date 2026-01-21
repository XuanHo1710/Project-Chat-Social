"use client";

import React, { useState } from "react";
import { Stack, TextField, Button, InputAdornment, Box, CircularProgress } from "@mui/material";
import { Email } from "@mui/icons-material";
import { motion } from "framer-motion";

interface EmailInputStepProps {
    onSubmit: (email: string) => void;
    loading: boolean;
}

export const EmailInputStep = ({ onSubmit, loading }: EmailInputStepProps) => {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            setError("Vui lòng nhập địa chỉ email");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Địa chỉ email không hợp lệ");
            return;
        }

        setError("");
        onSubmit(email);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        if (error) setError("");
    };

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
                <TextField
                    label="Email"
                    placeholder="example@email.com"
                    fullWidth
                    value={email}
                    onChange={handleChange}
                    disabled={loading}
                    autoFocus
                    error={!!error}
                    helperText={error}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Email color="action" />
                            </InputAdornment>
                        ),
                    }}
                />

                <Button
                    component={motion.button}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading}
                    sx={{
                        py: 1.5,
                        fontWeight: 700,
                        textTransform: 'none',
                        bgcolor: '#1877f2',
                    }}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Gửi mã xác minh"}
                </Button>
            </Stack>
        </form>
    );
};
