"use client";

import React, { useState } from "react";
import { Stack, TextField, Button, InputAdornment, IconButton, CircularProgress } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { motion } from "framer-motion";

interface ResetPasswordStepProps {
    onSubmit: (password: string) => void;
    loading: boolean;
}

export const ResetPasswordStep = ({ onSubmit, loading }: ResetPasswordStepProps) => {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [newPasswordError, setNewPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let hasError = false;

        if (!newPassword) {
            setNewPasswordError("Vui lòng nhập mật khẩu mới");
            hasError = true;
        } else if (newPassword.length < 6) {
            setNewPasswordError("Mật khẩu phải có ít nhất 6 ký tự");
            hasError = true;
        }

        if (!confirmPassword) {
            setConfirmPasswordError("Vui lòng xác nhận mật khẩu");
            hasError = true;
        } else if (newPassword !== confirmPassword) {
            setConfirmPasswordError("Mật khẩu không trùng khớp");
            hasError = true;
        }

        if (hasError) return;

        // Reset errors
        setNewPasswordError("");
        setConfirmPasswordError("");
        onSubmit(newPassword);
    };

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
                <TextField
                    label="Mật khẩu mới"
                    type={showPassword ? "text" : "password"}
                    fullWidth
                    value={newPassword}
                    onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (newPasswordError) setNewPasswordError("");
                    }}
                    disabled={loading}
                    autoFocus
                    error={!!newPasswordError}
                    helperText={newPasswordError}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />

                <TextField
                    label="Xác nhận mật khẩu"
                    type={showConfirmPassword ? "text" : "password"}
                    fullWidth
                    value={confirmPassword}
                    onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (confirmPasswordError) setConfirmPasswordError("");
                    }}
                    disabled={loading}
                    error={!!confirmPasswordError}
                    helperText={confirmPasswordError}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
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
                    sx={{ py: 1.5, fontWeight: 700, textTransform: 'none', bgcolor: '#1877f2' }}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Đổi mật khẩu"}
                </Button>
            </Stack>
        </form>
    );
};
