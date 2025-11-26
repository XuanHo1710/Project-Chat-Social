"use client";
import React, { useState } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  Stack,
  Checkbox,
  FormControlLabel,
  Link,
  IconButton,
  InputAdornment,
  CircularProgress,
  Fade,
  Zoom,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  ChatBubble,
  Google as GoogleIcon,
  Facebook as FacebookIcon,
  Lock,
  Person,
} from "@mui/icons-material";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";

export default function LoginPage() {
  const [username, setUsername] = useState("xuanho");
  const [password, setPassword] = useState("123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login({ username, password });

      if (response.data?.payload) {
        // Map backend response to User type and save to Zustand store
        const userData = {
          id: response.data.payload._id, // Using username as ID
          username: response.data.payload.username,
          fullName: response.data.payload.fullname,
          role: response.data.payload.role,
          gender: response.data.payload.gender,
          email: undefined, // Backend doesn't provide email in login response
          avatar: undefined, // Backend doesn't provide avatar in login response
        };

        // Set user in Zustand store (only in-memory, not localStorage)
        setUser(userData);

        toast.success(`Xin chào ${response.data.payload.fullname}! Đăng nhập thành công!`);

        // Middleware will redirect to /chat via refresh_token cookie
        // Force reload to trigger middleware check
        window.location.href = "/chat";
      }
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMessage = error.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          width: "150%",
          height: "150%",
          background: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
          animation: "moveBackground 20s linear infinite",
          opacity: 0.3,
        },
        "@keyframes moveBackground": {
          "0%": { transform: "translate(0, 0)" },
          "100%": { transform: "translate(50px, 50px)" },
        },
      }}
    >
      {/* Left Side - Branding */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          width: "50%",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Fade in timeout={1000}>
          <Box sx={{ textAlign: "center", color: "white", px: 6 }}>
            <Zoom in timeout={1200}>
              <Box
                sx={{
                  mb: 4,
                  display: "inline-flex",
                  p: 3,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
                }}
              >
                <ChatBubble sx={{ fontSize: 80, color: "white" }} />
              </Box>
            </Zoom>
            <Typography
              variant="h2"
              fontWeight={900}
              mb={2}
              sx={{
                textShadow: "0 2px 10px rgba(0,0,0,0.2)",
                background: "linear-gradient(45deg, #fff, #e0e0e0)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Social Chat
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: "rgba(255,255,255,0.9)",
                fontWeight: 300,
                mb: 4,
                textShadow: "0 2px 10px rgba(0,0,0,0.1)",
              }}
            >
              Kết nối mọi người, mọi nơi
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                mt: 6,
              }}
            >
              {[
                { number: "1M+", label: "Người dùng" },
                { number: "50M+", label: "Tin nhắn" },
                { number: "24/7", label: "Hỗ trợ" },
              ].map((stat, index) => (
                <Fade key={index} in timeout={1500 + index * 200}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h4" fontWeight={800} color="white">
                      {stat.number}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)" }}>
                      {stat.label}
                    </Typography>
                  </Box>
                </Fade>
              ))}
            </Box>
          </Box>
        </Fade>
      </Box>

      {/* Right Side - Login Form */}
      <Box
        sx={{
          width: { xs: "100%", md: "50%" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Container maxWidth="sm">
          <Zoom in timeout={800}>
            <Paper
              elevation={24}
              sx={{
                p: 5,
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
              }}
            >
              <form onSubmit={handleLogin}>
                <Stack spacing={3}>
                  {/* Header */}
                  <Box sx={{ textAlign: "center", mb: 2 }}>
                    <Typography variant="h4" fontWeight={800} color="primary" mb={1}>
                      Đăng nhập
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Chưa có tài khoản?{" "}
                      <Link href="#" underline="hover" sx={{ fontWeight: 600 }}>
                        Đăng ký ngay
                      </Link>
                    </Typography>
                  </Box>

                  {/* Username Field */}
                  <TextField
                    label="Tên đăng nhập"
                    placeholder="Nhập tên đăng nhập"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth
                    variant="outlined"
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        transition: "all 0.3s",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(102, 126, 234, 0.2)",
                        },
                      },
                    }}
                  />

                  {/* Password Field */}
                  <TextField
                    label="Mật khẩu"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    variant="outlined"
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            disabled={loading}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        transition: "all 0.3s",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(102, 126, 234, 0.2)",
                        },
                      },
                    }}
                  />

                  {/* Remember Me & Forgot Password */}
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          disabled={loading}
                        />
                      }
                      label="Ghi nhớ đăng nhập"
                    />
                    <Link href="#" underline="hover" sx={{ fontWeight: 500 }}>
                      Quên mật khẩu?
                    </Link>
                  </Stack>

                  {/* Login Button */}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      textTransform: "none",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      boxShadow: "0 4px 15px 0 rgba(102, 126, 234, 0.4)",
                      transition: "all 0.3s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 6px 20px 0 rgba(102, 126, 234, 0.6)",
                        background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                      },
                      "&:active": {
                        transform: "translateY(0)",
                      },
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} sx={{ color: "white" }} />
                    ) : (
                      "Đăng nhập"
                    )}
                  </Button>

                  {/* Divider */}
                  <Divider sx={{ my: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Hoặc tiếp tục với
                    </Typography>
                  </Divider>

                  {/* Social Login Buttons */}
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<GoogleIcon />}
                      disabled={loading}
                      sx={{
                        borderRadius: 2,
                        py: 1.2,
                        textTransform: "none",
                        fontWeight: 600,
                        transition: "all 0.3s",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        },
                      }}
                    >
                      Google
                    </Button>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<FacebookIcon />}
                      disabled={loading}
                      sx={{
                        borderRadius: 2,
                        py: 1.2,
                        textTransform: "none",
                        fontWeight: 600,
                        transition: "all 0.3s",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        },
                      }}
                    >
                      Facebook
                    </Button>
                  </Stack>
                </Stack>
              </form>
            </Paper>
          </Zoom>
        </Container>
      </Box>
    </Box>
  );
}
