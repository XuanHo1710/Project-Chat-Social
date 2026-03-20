"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Divider,
  Stack,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  CircularProgress,
  useTheme,
  Paper,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Google as GoogleIcon,
} from "@mui/icons-material";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CLIENT_PATH } from "@/constants/paths";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";
import axios from "axios";

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
  const theme = useTheme(); // Hook to access theme

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const newParticles = Array.from({ length: 60 }).map((_, i) => ({
      key: i,
      width: Math.random() * 6 + 2,
      height: Math.random() * 6 + 2,
      // Use theme primary color in the mix
      color: [theme.palette.primary.main, theme.palette.secondary.main, '#e91e63', '#9c27b0', '#ffeb3b'][Math.floor(Math.random() * 5)],
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
  }, [theme.palette.primary.main, theme.palette.secondary.main]);
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

export default function LoginPage() {
  const [username, setUsername] = useState("xuanho");
  const [password, setPassword] = useState("123123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser, setAccessToken } = useAuthStore();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const router = useRouter();

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error(t('auth.fill_all_info'));
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login({ username, password });

      if (response.data?.payload) {
        const userData = {
          id: response.data.payload._id,
          username: response.data.payload.username,
          fullName: response.data.payload.fullname,
          role: response.data.payload.role,
          gender: response.data.payload.gender,
          email: response.data.payload.email,
          avatar: response.data.payload.avatar,
        };

        setAccessToken(response.data.access_token);
        setUser(userData);

        if (response.data.session_id) {
          await axios.post('/api/auth/session', {
            accessToken: response.data.access_token,
            sessionId: response.data.session_id,
          });
        }

        toast.success(t('auth.welcome_user', { name: response.data.payload.fullname }));
        router.push(CLIENT_PATH.HOME);
      }
    } catch {
      toast.error(t('auth.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithGoogle = () => {
    // Call API login with google
    window.open(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/login/google`,
      'google-login',
      'width=500,height=600,left=200,top=100'
    );
  }


  // Handle Login with google callback
  useEffect(() => {
    const BACKEND_ORIGIN = new URL(
      process.env.NEXT_PUBLIC_BACKEND_API_URL!
    ).origin;
    const handler = async (event: MessageEvent) => {
      if (event.origin !== BACKEND_ORIGIN) return;

      const { type, payload } = event.data;

      if (type === 'GOOGLE_LOGIN_SUCCESS') {
        const userData = {
          id: payload.payload._id,
          username: payload.payload.username,
          fullName: payload.payload.fullname,
          role: payload.payload.role,
          gender: payload.payload.gender,
          email: payload.payload.email,
          avatar: payload.payload.avatar,
        };

        setAccessToken(payload.access_token);
        setUser(userData);

        if (payload.session_id) {
          await axios.post('/api/auth/session', {
            accessToken: payload.access_token,
            sessionId: payload.session_id,
          });
        }

        toast.success(`Xin chào ${payload.payload.fullname}! Đăng nhập thành công!`);
        router.push(CLIENT_PATH.HOME);
      }

      if (type === 'GOOGLE_LOGIN_FAILED') {
        toast.error(t('auth.google_login_failed'));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [router, setAccessToken, setUser]);


  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        overflow: "hidden",
        bgcolor: isDark ? "#0f172a" : "#f0f2f5", // Consider using theme.palette.background.default
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
                background: `linear-gradient(to right, ${theme.palette.primary.main}, ${theme.palette.secondary.main || '#00c6ff'})`, // Use theme colors
                backgroundClip: 'text',
                textFillColor: 'transparent',
                mb: 2,
                fontSize: '4rem',
                letterSpacing: '-1px',
                filter: `drop-shadow(0 4px 20px ${theme.palette.primary.main}4d)` // Dynamic shadow
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
              {t('auth.connect_friends')}
            </Typography>
          </motion.div>
        </Box>
      </Box>

      {/* Right Side - Login Form */}
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
            <Box sx={{ mb: 4, textAlign: 'center', display: { md: 'none' } }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: theme.palette.primary.main }}>Social Chat</Typography>
            </Box>

            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, color: 'text.primary', textAlign: 'center' }}>
              {t('auth.login_button')}
            </Typography>

            <form onSubmit={handleLogin}>
              <Stack spacing={2.5} sx={{ mt: 3 }}>
                <TextField
                  label={t('auth.username')}
                  fullWidth
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />

                <TextField
                  label={t('auth.password')}
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

                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                    }
                    label={<Typography variant="body2">{t('auth.remember_me')}</Typography>}
                  />
                  <Link href={CLIENT_PATH.FORGOT_PASSWORD} className="text-sm font-medium hover:underline" style={{ color: theme.palette.primary.main }}>
                    {t('auth.forgot_password')}
                  </Link>
                </Stack>

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
                    fontSize: '1.1rem',
                    textTransform: 'none',
                    borderRadius: 1.5,
                    bgcolor: theme.palette.primary.main,
                    boxShadow: `0 4px 12px ${theme.palette.primary.main}4d`,
                    '&:hover': {
                      bgcolor: theme.palette.primary.dark,
                    }
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : t('auth.login_button')}
                </Button>

                <Divider sx={{ my: 2 }}>
                  <Typography variant="caption" color="text.secondary">{t('auth.or')}</Typography>
                </Divider>

                <Button
                  component={motion.button}
                  onClick={() => handleLoginWithGoogle()}
                  whileHover={{ scale: 1.02, backgroundColor: "rgba(0,0,0,0.04)" }}
                  variant="outlined"
                  startIcon={<GoogleIcon />}
                  type="button"
                  fullWidth
                  sx={{ py: 1.2, textTransform: 'none', borderRadius: 1.5 }}
                >
                  {t('auth.login_with_google')}
                </Button>

                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('auth.no_account')}{' '}
                    <Link href={CLIENT_PATH.REGISTER} className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                      {t('auth.register_now')}
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
