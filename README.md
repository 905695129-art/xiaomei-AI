# 心意闯关 Heart Studio

独立备用工程：将 Floot 上的心意闯关产品逐步迁移为可独立部署的 Web 应用。

## 产品边界
- 创作者购买软件一次性授权；平台不从创作者与体验者之间的关卡交易抽佣。
- 创作者创建多份作品，每份作品包含多个单独定价的关卡。
- 体验者通过分享链接浏览作品，逐关付款后解锁对应内容。
- 资金由合规支付机构直接结算给对应创作者/商户；商户准入和支付接口完成前，不开放真实付款。

## 当前状态
- 现有线上版本：https://heart-studio.floot.app
- 本仓库是备用迁移工程，不代表已经完成线上切换。
- 不提交密钥、支付证书、用户数据或生产数据库备份。

## 计划架构
Next.js + TypeScript、PostgreSQL、Drizzle、安全会话认证、私有对象存储、支付 Provider Adapter。

## MVP
登录注册、一次性软件授权、多作品管理、关卡编辑、分享体验页、私密内容访问授权、订单后台、支付沙盒。

## 本地启动
待应用脚手架文件提交后执行 npm install && npm run dev。


## Heart Studio MVP backend (work in progress)

### Local setup

1. Install Node.js 20+ and PostgreSQL 15+.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to a private PostgreSQL database URL.
3. Install dependencies with `npm install`.
4. Apply the schema with `npm run db:migrate`.
5. Start the app with `npm run dev`.

### Implemented API foundation

- `GET /api/experiences/:slug`: published experience metadata and active level titles, teasers and prices only.
- `POST /api/buyer/session`: creates an opaque buyer identity in an HttpOnly cookie.
- `GET /api/experiences/:slug/levels/:levelId`: returns private level content only when the buyer session has a paid entitlement.
- `GET/POST /api/creator/experiences`: creator-owned list/create endpoints, requiring a valid server-side creator session.
- `POST /api/orders`: intentionally returns `503 PAYMENTS_NOT_CONFIGURED` until an approved provider and verified callback flow are implemented.

### Important deployment gates

This repository is not yet a production-ready paid service. The database schema must be applied to a managed PostgreSQL instance; creator login/session issuance and editor APIs are still incomplete; payment provider onboarding, sub-merchant settlement, signed callback verification, refunds and end-to-end tests are not implemented. Do not collect money or represent demo checkout as real payment. The public experience API intentionally excludes private level content.
