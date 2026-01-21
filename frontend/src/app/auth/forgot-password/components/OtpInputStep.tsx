"use client";

import React, { useState, useEffect, useRef } from "react";
import { Stack, TextField, Button, Box, Typography, Link as MuiLink, CircularProgress } from "@mui/material";
import { motion } from "framer-motion";

interface OtpInputStepProps {
    email: string;
    onSubmit: (otp: string) => void;
    onResend: () => void;
    loading: boolean;
    apiError?: string;
}

export const OtpInputStep = ({ email, onSubmit, onResend, loading, apiError }: OtpInputStepProps) => {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [error, setError] = useState("");
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown logic moved here for self-containment or passed via props?
    // Let's keep logic simple inside here
    const [timeLeft, setTimeLeft] = useState(60);
    const [canResend, setCanResend] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else {
            setCanResend(true);
        }
        return () => clearInterval(timer);
    }, [timeLeft]);

    const handleResendClick = () => {
        if (!canResend) return;
        onResend();
        setTimeLeft(60);
        setCanResend(false);
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
    };

    const handleOtpChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (error) setError("");

        // Auto focus next
        if (value !== "" && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && index > 0 && otp[index] === "") {
            otpRefs.current[index - 1]?.focus();
        }
        if (e.key === "Enter" && index === 5 && otp.every((v) => v !== "")) {
            handleSubmit();
        }
    };

    const handlePasteOtp = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
        if (pastedData.some(char => isNaN(Number(char)))) return;

        const newOtp = [...otp];
        pastedData.forEach((char, index) => {
            if (index < 6) newOtp[index] = char;
        });
        setOtp(newOtp);
        otpRefs.current[Math.min(pastedData.length, 5)]?.focus();
        if (error) setError("");
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        const otpValue = otp.join("");
        if (otpValue.length !== 6) {
            setError("Vui lòng nhập đủ 6 số xác thực");
            return;
        }
        setError("");
        onSubmit(otpValue);
    };

    // Auto focus on mount
    useEffect(() => {
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }, []);

    return (
        <form onSubmit={handleSubmit}>
            <Stack spacing={3} alignItems="center">
                <Box sx={{ width: '100%' }}>
                    <Stack direction="row" spacing={1} justifyContent="center" onPaste={handlePasteOtp}>
                        {otp.map((digit, index) => (
                            <TextField
                                key={index}
                                inputRef={(el) => (otpRefs.current[index] = el)}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                disabled={loading}
                                error={!!error}
                                inputProps={{
                                    maxLength: 1,
                                    style: { textAlign: "center", fontSize: "1.5rem", fontWeight: "bold", padding: "8px" },
                                }}
                                sx={{ width: 45, height: 50, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                        ))}
                    </Stack>
                    {error && (
                        <Typography color="error" variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                            {error}
                        </Typography>
                    )}
                </Box>

                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        Chưa nhận được mã?{' '}
                        {canResend ? (
                            <MuiLink
                                component="button"
                                variant="body2"
                                onClick={handleResendClick}
                                type="button" // Important preventing submit
                                sx={{ fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
                            >
                                Gửi lại
                            </MuiLink>
                        ) : (
                            <Typography component="span" fontWeight={600} color="primary">
                                {timeLeft}s
                            </Typography>
                        )}
                    </Typography>
                </Box>

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
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Xác nhận"}
                </Button>
            </Stack>
        </form>
    );
};
