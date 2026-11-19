const { getMutationCatalog } = require("../services/collections");

function getAuthorizedAccountId(req, res, { getAccountIdFromRequest, canAccessAccount }) {
  const accountId = getAccountIdFromRequest(req);
  if (!accountId) {
    res.status(400).json({
      ok: false,
      error: "Missing x-account-id",
    });
    return null;
  }

  if (!canAccessAccount(req, accountId)) {
    res.status(403).json({
      ok: false,
      error: "无权访问此账号",
    });
    return null;
  }

  return accountId;
}

function registerAdminCollectionsRoutes({
  app,
  provider,
  adminLogger,
  getAccountIdFromRequest,
  canAccessAccount,
  sendProviderError,
}) {
  const routeContext = {
    provider,
    adminLogger,
    getAccountIdFromRequest,
    canAccessAccount,
    sendProviderError,
  };

  // 藏品宝典快照（蓝晶藏品）
  app.get("/api/collections", async (req, res) => {
    const accountId = getAuthorizedAccountId(req, res, routeContext);
    if (!accountId) return;

    try {
      const snapshot = await provider.getCollectionsSnapshot(accountId);
      res.json({ ok: true, data: snapshot });
    } catch (err) {
      adminLogger.error("获取藏品宝典失败", {
        accountId,
        error: err.message,
      });
      sendProviderError(res, err);
    }
  });

  // 藏品写操作：upgrade（激活/升星）、claim（评分领奖）、display（展示切换）
  app.post("/api/collections/:action", async (req, res) => {
    const accountId = getAuthorizedAccountId(req, res, routeContext);
    if (!accountId) return;

    try {
      const data = await provider.operateCollections(accountId, String(req.params.action), req.body || {});
      res.json({ ok: true, data });
    } catch (err) {
      adminLogger.error("藏品操作失败", {
        accountId,
        action: req.params.action,
        error: err.message,
        code: err.code,
      });
      sendProviderError(res, err);
    }
  });

  // 变异宝典（本地配置，无需账号）
  app.get("/api/illustrated/mutations", async (req, res) => {
    try {
      res.json({ ok: true, data: getMutationCatalog() });
    } catch (err) {
      adminLogger.error("获取变异宝典失败", { error: err.message });
      sendProviderError(res, err);
    }
  });
}

module.exports = { registerAdminCollectionsRoutes };
