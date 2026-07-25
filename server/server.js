import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, isMiniMaxConfigured } from './src/config.js';
import { getDb, closeDb } from './src/db.js';
import authRoutes from './src/routes/auth.js';
import resumeRoutes from './src/routes/resumes.js';
import analysisRoutes from './src/routes/analyses.js';
import analyzeRoutes from './src/routes/analyze.js';
import adminRoutes from './src/routes/admin.js';

const app = express();

// 启动时初始化数据库
getDb();

app.set('trust proxy', 1);
app.use(express.json({ limit: '4mb' }));

// CORS
app.use(
  cors({
    origin(origin, callback) {
      // 没有 Origin（curl / 服务端）放行；有则必须在白名单
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS 拒绝来源：${origin}`));
    },
    credentials: true,
  }),
);

// 速率限制（保护 API Key）
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 每分钟 60 次
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // AI 分析每分钟 10 次（昂贵）
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '分析请求过于频繁，请稍后再试' },
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    minimaxConfigured: isMiniMaxConfigured(),
  });
});

// 路由（注意顺序：更具体的路径放前面，避免被通用 limiter 误伤）
app.use('/api/auth', authRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/resumes', apiLimiter, resumeRoutes);
app.use('/api/analyses', apiLimiter, analysisRoutes);
app.use('/api/analyze', analyzeLimiter, analyzeRoutes);

// 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: `路由不存在：${req.method} ${req.path}` });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

const server = app.listen(config.port, () => {
  console.log('==================================================');
  console.log(`✓ 简历优化大师后端已启动`);
  console.log(`  端口: ${config.port}`);
  console.log(`  邀请码模式: ${config.invite.inviteOnly ? '开启' : '关闭'}`);
  console.log(`  MiniMax API: ${isMiniMaxConfigured() ? '已配置' : '未配置（将回退到 mock）'}`);
  console.log(`  CORS 白名单: ${config.corsOrigins.join(', ')}`);
  console.log(`  健康检查: http://localhost:${config.port}/api/health`);
  console.log('==================================================');
});

// 优雅退出
function shutdown() {
  console.log('\n正在关闭...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
