# 简历优化大师

JD 定制简历优化 WebApp · 多用户 · 邀请码登录 · 后端代理 MiniMax API。

## 架构

```
浏览器 (React + Vite)
        │  /api/* (Bearer Token)
        ▼
Node.js (Express + SQLite)
        │  MiniMax Chat Completions
        ▼
api.minimaxi.com
```

- **前端** 仅做 UI / 表单状态 / 模板渲染，**不再持有 API Key**
- **后端** 负责邀请码认证、简历 CRUD、AI 代理、限流
- **SQLite** 存邀请码、用户、简历、分析结果
- 朋友 / 同事可通过邀请码使用同一套服务（共享你的 MiniMax Key）

## 启动方式

### 后端

```bash
cd server
npm install
cp .env.example .env       # 填入 MINIMAX_API_KEY
node server.js             # 默认 http://localhost:4000
```

邀请码管理 CLI：

```bash
cd server
node src/admin.js create --count 3     # 生成 3 个新邀请码
node src/admin.js list                 # 查看所有邀请码
node src/admin.js revoke <code>        # 撤销某个邀请码
```

### 前端

```bash
npm install
cp .env.example .env       # 填入 VITE_API_BASE
npm run dev                # 默认 http://localhost:5173
```

打开浏览器访问前端地址，输入后端生成的邀请码即可使用。

## 已实现能力

- 输入目标岗位、行业、公司类型、求职阶段、JD、原始简历、补充信息
- 一键填充示例数据
- **简历库**（云端保存、多份管理、自动 2.5s 防抖保存）
- 邀请码登录 / 登出，多用户数据隔离
- 9 步流程导航：输入 → JD 解析 → 简历诊断 → 匹配分析 → 经历追问 → 简历优化 → 面试准备 → 整体增强 → 导出
- AI 追问生成 bullet、AI 优化对照表
- 三套主题（白 / 牛皮纸 / 深色）
- 三套导出模板（编辑出版型 / 精准网格型 / 极简留白）
- 中文与纯英文简历按需生成，支持 PDF / Word 导出

## 部署

详见 [DEPLOY.md](./DEPLOY.md)。

## 技术栈

- **前端**：React 18、Vite 5、@react-pdf/renderer、docx
- **后端**：Node.js 24（内置 `node:sqlite`）、Express、express-rate-limit
- **存储**：SQLite
- **认证**：邀请码 → Bearer Token（DB 只存 SHA-256 哈希）
- **AI**：MiniMax Chat Completions（OpenAI 兼容协议）
