# 部署指南：阿里云轻量应用服务器 + Nginx

本文档面向「把项目部署到一台 Linux 公网服务器，对朋友开放使用」的场景。

## 一、总体架构

```
┌────────────────────────────────────────────────────┐
│                阿里云轻量应用服务器                   │
│  ┌──────────────────────────────────────────────┐  │
│  │  Nginx（反向代理 + 静态资源）                  │  │
│  │  /            →  前端 dist/                    │  │
│  │  /api/*       →  http://127.0.0.1:4000/api/*    │  │
│  └──────────────────────────────────────────────┘  │
│                       │                              │
│  ┌──────────────────────────────────────────────┐  │
│  │  Node.js 后端（PM2 守护）                      │  │
│  │  server.js  :4000                             │  │
│  │  SQLite  data/resume.db                       │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
                       │
                       ▼  (HTTPS outbound)
              api.minimaxi.com
```

只需要在阿里云安全组放通 **80 / 443** 端口，**4000 不要对外**。

---

## 二、服务器初始准备

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y        # Ubuntu
# 或 sudo yum update -y                         # CentOS

# 2. 安装 Node.js 24+（Node 24 内置 node:sqlite，免编译原生模块）
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # 确认 v24.x

# 3. 安装 Nginx + PM2
sudo apt install -y nginx
sudo npm install -g pm2

# 4. 安装 git / 其它工具
sudo apt install -y git ufw

# 5. 防火墙（只开 SSH / HTTP / HTTPS）
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

阿里云控制台「轻量应用服务器 → 安全组」也要放行：22（SSH）、80、443。

---

## 三、上传代码

```bash
# 在本地打包并 scp 到服务器（路径按你实际情况）
cd f:/AI\ Projects/Resume
# 排除 node_modules
rsync -avz --exclude node_modules --exclude dist \
  ./resume root@你的公网IP:/opt/resume
```

或者用 git：

```bash
# 服务器上
cd /opt
sudo git clone https://github.com/LeoLiu127/resume-optimizer.git resume
```

---

## 四、配置 & 启动后端

```bash
cd /opt/resume/server
npm install --omit=dev
cp .env.example .env
vim .env   # 修改以下几项
```

`.env` 关键配置：

```bash
PORT=4000
NODE_ENV=production
# 多个来源用逗号分隔；填域名 + 本地
CORS_ORIGINS=https://你的域名,http://localhost
# 服务端静态托管前端（如果 Nginx 不直接 serve dist，则可启用）
SERVE_STATIC=../dist
# 必填：MiniMax API Key（请使用受限额度 Key 并定期轮换）
MINIMAX_API_KEY=sk-cp-xxx...
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_MODEL=MiniMax-M3
MINIMAX_TIMEOUT=60000
# 是否允许 AI 失败时回退到本地 Mock（生产建议 false）
FALLBACK_ENABLED=false
```

启动：

```bash
# 用 PM2 守护
pm2 start server.js --name resume-api
pm2 save
pm2 startup    # 复制输出的 sudo 命令执行一次，开机自启
```

验证：

```bash
curl http://127.0.0.1:4000/api/health
# {"ok":true,"minimaxConfigured":true,...}
```

---

## 五、生成首批邀请码

```bash
cd /opt/resume/server
# 给 3 个朋友各发 1 个
node src/admin.js create --count 3
# 给小李单独发一个
node src/admin.js create --label "给同事小李"
```

输出形如：

```
✅ 已生成邀请码：
   CAEVRSTUJJ    (给同事小李)  状态: 未使用
   HJKMNPQRSA    状态: 未使用
   WXYZ234567    状态: 未使用
```

把码发给朋友，他们在前端输入即可注册使用。后续管理：

```bash
node src/admin.js list                   # 查看所有
node src/admin.js list --used            # 只看已使用的
node src/admin.js revoke CAEVRSTUJJ      # 撤销（保留记录但禁止再登）
node src/admin.js delete  CAEVRSTUJJ     # 彻底删除
```

---

## 六、构建 & 部署前端

```bash
cd /opt/resume
npm install
cp .env.example .env
vim .env   # 关键：把 VITE_API_BASE 指向同源 /api（让 Nginx 转发）
```

`.env`：

```bash
# 同源反代：前端请求 /api/* 由 Nginx 转发到 :4000
# 这样浏览器看是同源，没有 CORS 问题
VITE_API_BASE=/api
VITE_USE_MOCK_FALLBACK=false
```

构建：

```bash
npm run build
# 产物在 dist/
```

---

## 七、Nginx 配置

`/etc/nginx/sites-available/resume`：

```nginx
server {
    listen 80;
    server_name yourdomain.com;   # 没有域名就填公网 IP

    # ---- 1. 前端静态资源 ----
    root /opt/resume/dist;
    index index.html;

    # SPA 路由 fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ---- 2. /api 反向代理到 Node 后端 ----
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;     # AI 调用较慢
        proxy_send_timeout 90s;
        client_max_body_size 5m;    # 简历文本上限
    }

    # ---- 3. 简单缓存 ----
    location ~* \.(js|css|png|jpg|svg|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # ---- 4. 安全 Header ----
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options         DENY;
    add_header Referrer-Policy         strict-origin-when-cross-origin;
}
```

启用：

```bash
sudo ln -s /etc/nginx/sites-available/resume /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 八、（推荐）HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
# 自动续期：certbot renew --dry-run
```

证书到位后 Nginx 会被 certbot 自动改写为 443 + 301 重定向。

---

## 九、升级 / 维护

```bash
# 更新代码
cd /opt/resume && git pull
cd server && npm install --omit=dev && pm2 restart resume-api
cd .. && npm install && npm run build

# 备份 SQLite（邀请码 + 用户 + 简历都在里面）
cp /opt/resume/server/data/resume.db /backup/resume-$(date +%F).db

# 查看后端日志
pm2 logs resume-api
```

---

## 十、安全清单

- ✅ `MINIMAX_API_KEY` **只在服务端 `.env`**，不要提交到 Git
- ✅ 阿里云安全组只开放 22 / 80 / 443，**4000 仅本地监听**
- ✅ CORS_ORIGINS 限定为你的域名，避免被跨域滥用
- ✅ SQLite 文件 `server/data/resume.db` 定期备份
- ✅ 邀请码默认 10 位，强制过期前可以主动 `revoke`
- ✅ 后端 `express-rate-limit`：AI 接口 10 次 / 分钟，普通接口 60 次 / 分钟
- ✅ 数据库只存 Token 的 SHA-256 哈希，不存明文

## 十一、常见问题

| 现象 | 排查 |
| --- | --- |
| 前端打开后停在「邀请码输入页」一直 loading | 浏览器 F12 看 `bootstrap` 请求是否 200；Nginx `/api/` 是否正确转发 |
| 输入邀请码提示 `兑换失败` | 后端 `pm2 logs` 看错误；邀请码是否被 `revoke` |
| AI 一直回退到 mock | `pm2 logs` 看 MiniMax 是否超时 / 401；检查 `MINIMAX_API_KEY` 是否过期 |
| 端口 4000 在外网访问不到 | 这是正常的，请通过 Nginx 80/443 访问，不要直接暴露 4000 |
| 朋友说「我的简历没了」 | 邀请码一旦被 `delete`，对应用户数据仍存在但无法再登录；用 `revoke` 而不是 `delete` |