# 简历优化大师 · 后端

为「[简历优化大师](https://github.com/LeoLiu127/resume-optimizer)」前端提供：

- **邀请码认证**（无需邮箱注册，朋友填码即用）
- **简历库**（云端持久化，多设备同步）
- **MiniMax API 代理**（API Key 留在服务端，前端不可见）

## 快速开始

```bash
cd server
npm install
cp .env.example .env
# 编辑 .env，把 MINIMAX_API_KEY 改成你自己的真实 Key
npm run seed     # 第一次启动生成 5 个默认邀请码（把码发给朋友）
npm start        # 启动服务（默认 4000 端口）
```

启动后健康检查：

```bash
curl http://localhost:4000/api/health
# { "ok": true, "minimaxConfigured": true, ... }
```

## 邀请码管理

```bash
# 列出所有邀请码
npm run admin list

# 新建一个邀请码（label 可选，max_uses 默认可用 1 次）
npm run admin create "给张三" 1

# 撤销邀请码（立即失效，已用 token 不会撤销）
npm run admin revoke ABC123XYZ

# 批量生成（首次启动推荐）
npm run admin seed 10
```

## 端点

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET  | `/api/health` | 无 | 健康检查 |
| GET  | `/api/auth/bootstrap` | 无 | 服务端能力探测 |
| POST | `/api/auth/redeem` | 无 | 用邀请码换 token |
| GET  | `/api/auth/me` | Bearer | 当前会话信息 |
| POST | `/api/auth/logout` | Bearer | 登出 |
| GET  | `/api/resumes` | Bearer | 简历列表 |
| GET  | `/api/resumes/:id` | Bearer | 简历详情 |
| POST | `/api/resumes` | Bearer | 新建简历 |
| PUT  | `/api/resumes/:id` | Bearer | 更新简历 |
| DELETE | `/api/resumes/:id` | Bearer | 删除简历 |
| GET  | `/api/analyses?resume_id=...` | Bearer | 分析列表 |
| POST | `/api/analyses` | Bearer | 保存分析结果 |
| GET  | `/api/analyses/bullets` | Bearer | 追问 bullet 历史 |
| POST | `/api/analyses/bullets` | Bearer | 保存追问 bullet |
| POST | `/api/analyze/analyze` | Bearer | 主分析（代理 MiniMax） |
| POST | `/api/analyze/followup` | Bearer | 追问 bullet 生成 |
| POST | `/api/analyze/rewrite` | Bearer | 优化风格重写 |
| POST | `/api/analyze/enhance` | Bearer | 补强建议 |

所有请求 `/api/analyze/*` 与 `/api/resumes`、`/api/analyses` 都需要 `Authorization: Bearer <token>` 头。

## 数据存储

- SQLite 单文件 `data/app.db`（无需安装 MySQL）
- 自动建表（首次启动）
- 备份：直接复制 `data/app.db` 文件
- 重要数据：用户 token 只存 **hash**，DB 泄露时无法重放

## 部署到阿里云

参见 [DEPLOY.md](../DEPLOY.md)
