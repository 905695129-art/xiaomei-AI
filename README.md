# 心意闯关 Heart Studio

这是「心意闯关」的独立 Web 应用开发仓库。产品采用温柔、甜美的视觉方向：创作者制作互动作品，体验者通过专属链接逐关浏览。

## 产品规则
- 创作者创建多份作品，每份作品最多包含 30 个关卡。
- 每关单独设置标题、付款前提示、价格和私密内容。
- 公开分享页只展示作品介绍、关卡标题、提示和价格。
- 私密内容必须由服务端验证已支付 entitlement 后才能读取。
- 产品设计目标是不对创作者与体验者之间的关卡交易抽佣；真实结算须使用获准的商户/服务商及子商户方案。

## 当前已实现
- `/creator`：创作者邮箱注册、登录、作品创建与作品列表；支持归档和恢复草稿。
- `/creator/[experienceId]`：关卡编辑、删除、添加、价格设置、私密内容编辑、保存与发布。
- `/creator/orders`：创作者订单记录和真实订单汇总；只读取数据库记录，不生成模拟收入。
- `/p/[slug]`：体验者分享页，展示每关标题、提示和独立价格，并支持分享链接及进入购买记录。
- `/purchases`：体验者购买记录页，只显示当前浏览器身份已付款且已解锁的关卡。
- `GET /api/experiences/:slug`：只返回已发布作品的公开元数据，归档作品不会公开访问。
- `GET/PUT /api/creator/experiences/:id/levels`：验证作品归属后读取或保存关卡。
- `PATCH /api/creator/experiences/:id`：创作者本人可修改作品标题/描述、归档或恢复草稿。
- `GET /api/creator/orders`：按当前创作者身份读取订单及汇总。
- `GET /api/buyer/purchases`：仅凭 HttpOnly 买家会话读取当前买家已付款且已发放 entitlement 的购买记录，不接受客户端传入买家 ID。
- `POST /api/creator/experiences/:id/publish`：发布作品。
- `GET /api/experiences/:slug/levels/:levelId`：只有当前买家会话拥有已支付 entitlement 时才返回私密内容。
- `POST /api/orders`：真实支付渠道未配置前明确返回 503 `PAYMENTS_NOT_CONFIGURED`。

## 重要限制
**目前尚未开通真实收款，也不是可投入商业运营的生产服务。** 分享页的价格仅作展示；点击关卡不会发起支付、创建虚假订单或解锁内容。不要用当前版本向体验者收取真实款项。订单页面仅展示数据库中的真实订单记录；在支付尚未接入时通常为空。

正式上线前仍需完成：
1. 配置并迁移生产 PostgreSQL 数据库。
2. 完成支付机构/商户准入，确认创作者结算方式。
3. 实现服务端下单、签名回调验证、退款和 entitlement 发放。
4. 增加注册/登录限流、邮箱验证、密码重置及更完整的 CSRF 防护。
5. 完成端到端安全测试、隐私政策、服务条款和生产部署配置。

## 本地开发
需要 Node.js 20+ 与 PostgreSQL 15+。

```bash
npm install
cp .env.example .env.local
# 在 .env.local 中配置 DATABASE_URL
npm run db:migrate
npm run dev
```

应用默认在 http://localhost:3000 启动。不要将数据库连接串、支付密钥、证书或生产用户数据提交到 Git。
