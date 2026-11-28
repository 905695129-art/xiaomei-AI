# Heart Studio 部署指南（Docker Compose）

本指南提供可自行托管的容器部署方式。**它不会自动替你购买服务器、配置域名、创建 Resend 发件域名或开通支付商户。** 首次上线仍需要你控制的服务器、域名和服务商账户。

## 1. 服务器要求

- 支持 Docker Engine 与 Docker Compose v2 的 Linux 主机。
- 构建和运行镜像使用受支持的 Node.js 22 Alpine LTS 基础镜像。
- 建议至少 2 vCPU、2GB RAM；生产环境按流量和图片存储需求扩容。
- 一个已指向服务器的域名，以及 HTTPS 反向代理（例如由 Caddy/Nginx 终止 TLS）。
- 防火墙只开放 HTTPS 入口；不要把 PostgreSQL 端口暴露到公网。

## 2. 准备配置

在仓库目录执行：

```bash
cp .env.example .env
```

编辑 `.env`，至少将 `POSTGRES_PASSWORD` 替换为长随机密码。生产部署还应设置：

- `APP_URL=https://你的正式域名`
- `RESEND_API_KEY`：Resend 服务端 API Key
- `EMAIL_FROM`：Resend 已验证域名中的发件地址
- `REQUIRE_VERIFIED_EMAIL=true`：只有在邮件发送已完成验证后再启用
- `STORAGE_ENDPOINT`、`STORAGE_PUBLIC_URL`、`STORAGE_REGION`、`STORAGE_BUCKET`、`STORAGE_ACCESS_KEY`、`STORAGE_SECRET_KEY`：需要真实照片上传时配置

不要把 `.env` 提交到 Git。生产密钥应使用服务器密钥管理能力保存，并定期轮换。

## 3. 启动应用

```bash
docker compose run --rm migrate
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Compose 会先启动 PostgreSQL，等待数据库健康检查通过，再执行可重复的 `db/schema.sql` 迁移，最后启动 Next.js 应用。数据库数据保存在名为 `heart_studio_data` 的 Docker volume 中。

应用容器监听 3000 端口，Compose 默认只将其绑定到主机回环地址 `127.0.0.1:3000`，便于主机上的 Caddy/Nginx 反向代理访问。应用对所有路由设置 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy` 等浏览器安全响应头；生产环境还会发送 HSTS。生产环境应通过 HTTPS 反向代理访问，并确保反向代理正确传递 Host、协议和请求头；不要将应用端口改为公网监听。

健康检查分为两层：`GET /api/health` 只检查 Next.js 进程是否存活；`GET /api/ready` 会实际执行数据库查询，返回数据库是否就绪。部署验收时应两者都返回 HTTP 200。

## 4. 备份与升级

升级前先备份数据库：

```bash
docker compose exec -T db sh -c 'pg_dump -U heart -d heart_studio' > heart-studio-backup.sql
```

更新代码后：

```bash
git pull
docker compose up -d --build
```

恢复备份前应停止写入并确认备份文件完整：

```bash
cat heart-studio-backup.sql | docker compose exec -T db psql -U heart -d heart_studio -v ON_ERROR_STOP=1
```

备份文件可能含账户邮箱、作品私密内容和交易记录，必须加密保存并限制访问。不要把备份上传到公开仓库。

## 5. 上线验收

- [ ] 域名 HTTPS 正常，HTTP 自动跳转 HTTPS。
- [ ] PostgreSQL 未暴露公网，数据库密码为强随机值。
- [ ] Resend 发件域名已验证，实际收到邮箱验证和密码重置邮件。
- [ ] 开启 `REQUIRE_VERIFIED_EMAIL=true` 后，未验证账户不能发布作品。
- [ ] 对象存储 CORS 仅允许正式域名；测试上传 JPG/PNG/WEBP/GIF，确认 8MB 限制和公开图片 URL 正常。
- [ ] 备份和恢复演练成功。
- [ ] 隐私政策、服务条款已由运营主体补齐并完成目标市场法律审查。
- [ ] 支付机构商户准入、创作者结算安排和退款规则已获批准。

## 6. 真实支付仍未开通

当前 `POST /api/orders` 会返回 503 `PAYMENTS_NOT_CONFIGURED`。数据库里的订单约束和支付回调账本只是安全基础，不是支付渠道。必须完成支付机构/服务商准入、服务端下单、签名验签、幂等回调、退款执行和端到端验收后，才能对外收费。不得用个人收款码或虚构订单冒充平台支付。

## 7. 故障排查

- `SERVICE_NOT_CONFIGURED`：检查 `DATABASE_URL` 和数据库连接。
- 邮件接口返回 `EMAIL_DELIVERY_NOT_CONFIGURED`：检查 `RESEND_API_KEY`、`EMAIL_FROM`、`APP_URL`。
- 照片上传提示存储未配置：检查 S3 兼容存储的 endpoint、bucket、公开 URL 和凭据。
- 应用进程未就绪：检查 `curl -i http://127.0.0.1:3000/api/health`。
- 应用可响应但数据库未就绪：检查 `curl -i http://127.0.0.1:3000/api/ready`、`DATABASE_URL` 和数据库日志。
- 应用无法启动：查看 `docker compose logs app`；迁移失败时查看 `docker compose logs migrate`。
