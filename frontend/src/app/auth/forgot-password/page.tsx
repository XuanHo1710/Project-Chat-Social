"use client";

import React, { useState, useEffect } from "react";
import { Box, Container, Paper, Typography, useTheme } from "@mui/material";
import { LockReset, Email, VpnKey, ArrowBack } from "@mui/icons-material";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CLIENT_PATH } from "@/constants/paths";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { authService } from "@/services/auth.service";

import { SocialParticles } from "./components/SocialParticles";
import { EmailInputStep } from "./components/EmailInputStep";
import { OtpInputStep } from "./components/OtpInputStep";
import { ResetPasswordStep } from "./components/ResetPasswordStep";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    // Steps: 1: Email, 2: OTP, 3: Reset Password
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [apiError, setApiError] = useState("");

    // Mouse Parallax Logic
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseX = useSpring(x, { stiffness: 50, damping: 20 });
    const mouseY = useSpring(y, { stiffness: 50, damping: 20 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const { innerWidth, innerHeight } = window;
            const targetX = (e.clientX - innerWidth / 2) / 30;
            const targetY = (e.clientY - innerHeight / 2) / 30;
            x.set(targetX);
            y.set(targetY);
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [x, y]);

    // Transforms
    const rotateYHeader = useTransform(mouseX, [-20, 20], [-5, 5]);
    const rotateXHeader = useTransform(mouseY, [-20, 20], [5, -5]);

    // Handlers
    const handleEmailSubmit = async (submittedEmail: string) => {
        setEmail(submittedEmail);
        setLoading(true);
        setApiError("");

        try {
            const response = await authService.forgotPassword(submittedEmail);
            if (response.success) {
                setStep(2);
            } else {
                setApiError(response.message || "Có lỗi xảy ra");
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || "Có lỗi xảy ra. Vui lòng thử lại.";
            setApiError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (otp: string) => {
        setLoading(true);
        setApiError("");

        try {
            const response = await authService.verifyOtp(email, otp);
            if (response.success && response.resetToken) {
                setResetToken(response.resetToken);
                setStep(3);
            } else {
                setApiError(response.message || "Mã OTP không chính xác");
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || "Mã OTP không chính xác";
            setApiError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setLoading(true);
        setApiError("");

        try {
            const response = await authService.resendOtp(email);
            if (response.success) {
                toast.success("Đã gửi lại mã xác minh");
            } else {
                toast.error(response.message || "Không thể gửi lại mã");
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || "Không thể gửi lại mã";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async (password: string) => {
        setLoading(true);
        setApiError("");

        try {
            if (!resetToken) {
                setApiError("Phiên xác minh đã hết hạn. Vui lòng bắt đầu lại.");
                setStep(1);
                return;
            }
            const response = await authService.resetPassword(email, password, resetToken);
            if (response.success) {
                toast.success("Đổi mật khẩu thành công!");
                router.push(CLIENT_PATH.LOGIN);
            } else {
                setApiError(response.message || "Không thể đổi mật khẩu");
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || "Không thể đổi mật khẩu";
            setApiError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                overflow: "hidden",
                bgcolor: isDark ? "#0f172a" : "#f0f2f5",
                position: 'relative'
            }}
        >
            <SocialParticles />

            {/* Left Side - Branding (Desktop Only) */}
            <Box
                component={motion.div}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.2 }}
                sx={{
                    flex: 1.2,
                    display: { xs: "none", md: "flex" },
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    p: 8,
                    position: "relative",
                    zIndex: 1,
                    perspective: "1200px"
                }}
            >
                <Box sx={{ maxWidth: 500, zIndex: 2 }}>
                    <motion.div style={{ rotateX: rotateXHeader, rotateY: rotateYHeader }}>
                        <Typography
                            variant="h1"
                            fontWeight={900}
                            sx={{
                                background: 'linear-gradient(to right, #1877f2, #00c6ff)',
                                backgroundClip: 'text',
                                textFillColor: 'transparent',
                                mb: 2,
                                fontSize: '4rem',
                                letterSpacing: '-1px',
                                filter: 'drop-shadow(0 4px 20px rgba(24, 119, 242, 0.3))'
                            }}
                        >
                            Social Chat
                        </Typography>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                    >
                        <Typography variant="h5" color="text.secondary" sx={{ mb: 4, fontWeight: 500, lineHeight: 1.6 }}>
                            Khôi phục quyền truy cập vào tài khoản của bạn một cách an toàn và nhanh chóng.
                        </Typography>
                    </motion.div>
                </Box>
            </Box>

            {/* Right Side - Form */}
            <Box
                sx={{
                    flex: { xs: 1, md: 0.8 },
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    p: 4,
                    perspective: "1000px",
                    zIndex: 2,
                }}
            >
                <Container maxWidth="xs">
                    <Paper
                        component={motion.div}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 60, delay: 0.2 }}
                        elevation={3}
                        sx={{
                            p: 4,
                            borderRadius: 3,
                            bgcolor: 'background.paper',
                            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)',
                            marginTop: { xs: 8, md: 0 }
                        }}
                    >
                        {/* Header */}
                        <Box sx={{ mb: 4, textAlign: 'center' }}>
                            <Box
                                sx={{
                                    width: 60, height: 60,
                                    borderRadius: '50%',
                                    bgcolor: isDark ? 'rgba(24, 119, 242, 0.2)' : 'rgba(24, 119, 242, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto', mb: 2
                                }}
                            >
                                {step === 1 && <LockReset sx={{ fontSize: 32, color: '#1877f2' }} />}
                                {step === 2 && <Email sx={{ fontSize: 32, color: '#1877f2' }} />}
                                {step === 3 && <VpnKey sx={{ fontSize: 32, color: '#1877f2' }} />}
                            </Box>
                            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, color: 'text.primary' }}>
                                {step === 1 && "Quên mật khẩu?"}
                                {step === 2 && "Xác thực OTP"}
                                {step === 3 && "Đặt lại mật khẩu"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {step === 1 && "Nhập email của bạn để nhận mã xác minh"}
                                {step === 2 && `Mã xác minh đã được gửi đến ${email}`}
                                {step === 3 && "Tạo mật khẩu mới cho tài khoản của bạn"}
                            </Typography>
                        </Box>

                        {/* API Error Display */}
                        {apiError && (
                            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 2, textAlign: 'center' }}>
                                <Typography color="error.dark" variant="body2">{apiError}</Typography>
                            </Box>
                        )}

                        {/* Components based on Step */}
                        {step === 1 && <EmailInputStep onSubmit={handleEmailSubmit} loading={loading} />}
                        {step === 2 && <OtpInputStep email={email} onSubmit={handleOtpSubmit} onResend={handleResendOtp} loading={loading} apiError={apiError} />}
                        {step === 3 && <ResetPasswordStep onSubmit={handleResetSubmit} loading={loading} />}

                        {/* Back to Login */}
                        <Box sx={{ mt: 3, textAlign: 'center' }}>
                            <Link href={CLIENT_PATH.LOGIN} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: '#64748b', fontSize: '0.875rem', fontWeight: 500 }}>
                                <ArrowBack sx={{ fontSize: 16 }} /> Quay lại trang đăng nhập
                            </Link>
                        </Box>

                    </Paper>
                </Container>
            </Box>
        </Box>
    );
}
