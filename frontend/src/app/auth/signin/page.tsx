"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  IconButton,
  InputAdornment,
  CircularProgress,
  useTheme,
  Paper,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CLIENT_PATH } from "@/constants/paths";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// Spark/Particle Component
interface Particle {
  key: number;
  width: number;
  height: number;
  color: string;
  shadow: number;
  initialX: number;
  initialY: number;
  duration: number;
  delay: number;
  xPath: number[];
  yPath: number[];
}

const SocialParticles = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const newParticles = Array.from({ length: 60 }).map((_, i) => ({
      key: i,
      width: Math.random() * 6 + 2,
      height: Math.random() * 6 + 2,
      color: ['#1877f2', '#42b72a', '#e91e63', '#9c27b0', '#ffeb3b'][Math.floor(Math.random() * 5)],
      shadow: Math.random() * 10 + 5,
      initialX: Math.random() * window.innerWidth,
      initialY: Math.random() * window.innerHeight,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5,
      xPath: [
        Math.random() * window.innerWidth,
        Math.random() * window.innerWidth,
        Math.random() * window.innerWidth
      ],
      yPath: [
        Math.random() * window.innerHeight,
        Math.random() * window.innerHeight,
        Math.random() * window.innerHeight
      ]
    }));
    setParticles(newParticles);
  }, []);

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map((p) => (
        <motion.div
          key={p.key}
          style={{
            position: 'absolute',
            width: p.width,
            height: p.height,
            borderRadius: '50%',
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.shadow}px ${p.shadow / 2}px rgba(255,255,255,0.5)`,
          }}
          initial={{
            x: p.initialX,
            y: p.initialY,
            opacity: 0,
            scale: 0
          }}
          animate={{
            x: p.xPath,
            y: p.yPath,
            opacity: [0, Math.random() * 0.8 + 0.2, 0],
            scale: [0, Math.random() * 1.5 + 0.5, 0]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "linear",
            delay: p.delay
          }}
        />
      ))}
    </Box>
  );
};

export default function SigninPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser, setAccessToken } = useAuthStore();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const router = useRouter();

  // Mouse parallax effect
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

  // Transform values
  const rotateX = useTransform(mouseY, [-20, 20], [5, -5]);
  const rotateY = useTransform(mouseX, [-20, 20], [-5, 5]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password || !firstName || !lastName) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setLoading(true);

    try {
      const response = await authService.signup({ username, password, firstName, lastName });

      if (response.data?.payload) {
        const userData = {
          id: response.data.payload._id,
          username: response.data.payload.username,
          fullName: response.data.payload.fullname,
          role: response.data.payload.role,
          gender: response.data.payload.gender,
          email: undefined,
          avatar: undefined,
        };

        setAccessToken(response.data.access_token);
        setUser(userData);

        toast.success(`Xin chào ${response.data.payload.fullname}! Đăng ký thành công!`);
        router.push(CLIENT_PATH.HOME);
      }
    } catch {
      toast.error("Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.");
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
        transition={{ duration: 1 }}
        sx={{
          flex: 1.2,
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          p: 8,
          position: "relative",
          zIndex: 1,
          perspective: "1000px"
        }}
      >
        <Box sx={{ maxWidth: 500, zIndex: 2 }}>
          <motion.div style={{ rotateX, rotateY }}>
            <Typography
              variant="h1"
              fontWeight={900}
              sx={{
                background: 'linear-gradient(to right, #1877f2, #00c6ff)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
                textShadow: '0 4px 30px rgba(24, 119, 242, 0.4)',
                mb: 2,
                fontSize: '4.5rem',
                letterSpacing: '-2px'
              }}
            >
              Social Chat
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Typography variant="h5" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
              Tham gia cộng đồng ngay hôm nay và kết nối với mọi người.
            </Typography>
          </motion.div>
        </Box>
      </Box>

      {/* Right Side - Sign Up Form */}
      <Box
        sx={{
          flex: { xs: 1, md: 0.8 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          p: 4,
          perspective: "1000px",
          zIndex: 2
        }}
      >
        <Container maxWidth="xs">
          <Paper
            component={motion.div}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            // @ts-ignore
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
            elevation={3}
            sx={{
              p: 4,
              borderRadius: 3,
              bgcolor: 'background.paper',
              boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.4)' : '0 10px 40px rgba(0,0,0,0.1)',
              marginTop: { xs: 8, md: 0 }
            }}
          >
            <Box sx={{ mb: 4, textAlign: 'center', display: { md: 'none' } }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: "#1877f2" }}>Social Chat</Typography>
            </Box>

            <Stack alignItems="center" sx={{ mb: 3 }}>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Typography variant="h4" fontWeight={800} sx={{
                  color: 'text.primary',
                  textAlign: 'center',
                  mb: 1
                }}>
                  Tạo tài khoản
                </Typography>
              </motion.div>
              <Typography variant="body1" color="text.secondary">
                Nhanh chóng và dễ dàng.
              </Typography>
            </Stack>


            <form onSubmit={handleSign}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Họ"
                    fullWidth
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading}
                  />
                  <TextField
                    label="Tên"
                    fullWidth
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                  />
                </Stack>

                <TextField
                  label="Tên đăng nhập"
                  fullWidth
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />

                <TextField
                  label="Mật khẩu"
                  type={showPassword ? "text" : "password"}
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Typography variant="caption" color="text.secondary" sx={{ px: 1, textAlign: 'center' }}>
                  Bằng cách nhấp vào Đăng ký, bạn đồng ý với Điều khoản, Chính sách quyền riêng tư của chúng tôi.
                </Typography>

                <Button
                  component={motion.button}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    textTransform: 'none',
                    borderRadius: 1.5,
                    bgcolor: '#1877f2', // Blue as requested
                    boxShadow: '0 4px 12px rgba(24, 119, 242, 0.4)',
                    '&:hover': {
                      bgcolor: '#166fe5',
                    }
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : "Đăng ký"}
                </Button>

                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Đã có tài khoản?{' '}
                    <Link href={CLIENT_PATH.LOGIN} className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                      Đăng nhập
                    </Link>
                  </Typography>
                </Box>
              </Stack>
            </form>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
