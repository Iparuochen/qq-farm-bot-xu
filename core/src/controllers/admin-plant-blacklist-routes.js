function getAccountOrRespond(req, res, { getAccountIdFromRequest, canAccessAccount }) {
  const accountId = getAccountIdFromRequest(req);
  if (!accountId) {
    res.status(400).json({ ok: false, error: "Missing accountId" });
    return null;
  }
  if (!canAccessAccount(req, accountId)) {
    res.status(403).json({ ok: false, error: "无权访问此账号" });
    return null;
  }
  return accountId;
}

function normalizeSeedIds(list) {
  return [
    ...new Set(
      (Array.isArray(list) ? list : [])
        .map(Number)
        .filter((seedId) => Number.isFinite(seedId) && seedId > 0),
    ),
  ];
}

/** 名单读写器：blacklist / whitelist 共用同一套 CRUD 逻辑 */
function createListAccessor(store, provider, snakeName, camelName) {
  const getter = store[`get${camelName}`];
  const setter = store[`set${camelName}`];

  const get = (accountId) => (typeof getter === "function" ? getter(accountId) : []);

  const set = (accountId, list) => {
    if (typeof setter === "function") setter(accountId, list);
    if (provider && typeof provider.broadcastConfig === "function") {
      provider.broadcastConfig(accountId);
    }
    return get(accountId);
  };

  return { snakeName, get, set };
}

function registerListRoutes(app, {
  basePath,
  accessor,
  requireAdminToken,
  getAccountOrRespond: respond,
  sendProviderError,
}) {
  const access = respond;

  app.get(basePath, requireAdminToken, (req, res) => {
    try {
      const accountId = getAccountOrRespond(req, res, access);
      if (!accountId) return;
      res.json({ ok: true, data: accessor.get(accountId) });
    } catch (error) {
      sendProviderError(res, error);
    }
  });

  app.post(basePath, requireAdminToken, (req, res) => {
    try {
      const accountId = getAccountOrRespond(req, res, access);
      if (!accountId) return;

      const seedId = Number((req.body || {}).seedId);
      if (!seedId) {
        return res.status(400).json({ ok: false, error: "Missing seedId" });
      }

      const list = accessor.get(accountId);
      if (!list.includes(seedId)) {
        accessor.set(accountId, [...list, seedId]);
      }
      res.json({ ok: true, data: accessor.get(accountId) });
    } catch (error) {
      sendProviderError(res, error);
    }
  });

  app.delete(`${basePath}/:seedId`, requireAdminToken, (req, res) => {
    try {
      const accountId = getAccountOrRespond(req, res, access);
      if (!accountId) return;

      const seedId = Number(req.params.seedId);
      if (!seedId) {
        return res.status(400).json({ ok: false, error: "Missing seedId" });
      }

      const data = accessor.set(
        accountId,
        accessor.get(accountId).filter((item) => item !== seedId),
      );
      res.json({ ok: true, data });
    } catch (error) {
      sendProviderError(res, error);
    }
  });

  app.post(`${basePath}/batch`, requireAdminToken, (req, res) => {
    try {
      const accountId = getAccountOrRespond(req, res, access);
      if (!accountId) return;

      const seedIds = (req.body || {}).seedIds || [];
      if (!Array.isArray(seedIds)) {
        return res
          .status(400)
          .json({ ok: false, error: "seedIds must be an array" });
      }

      const data = accessor.set(accountId, [
        ...new Set([...accessor.get(accountId), ...normalizeSeedIds(seedIds)]),
      ]);
      res.json({ ok: true, data });
    } catch (error) {
      sendProviderError(res, error);
    }
  });

  app.delete(basePath, requireAdminToken, (req, res) => {
    try {
      const accountId = getAccountOrRespond(req, res, access);
      if (!accountId) return;
      accessor.set(accountId, []);
      res.json({ ok: true, data: [] });
    } catch (error) {
      sendProviderError(res, error);
    }
  });
}

function registerAdminPlantBlacklistRoutes({
  app,
  provider,
  store,
  requireAdminToken,
  getAccountIdFromRequest,
  canAccessAccount,
  sendProviderError,
}) {
  const access = { getAccountIdFromRequest, canAccessAccount };

  const blacklist = createListAccessor(store, provider, "plantBlacklist", "PlantBlacklist");
  const whitelist = createListAccessor(store, provider, "plantWhitelist", "PlantWhitelist");

  registerListRoutes(app, {
    basePath: "/api/plant-blacklist",
    accessor: blacklist,
    requireAdminToken,
    getAccountOrRespond: access,
    sendProviderError,
  });

  registerListRoutes(app, {
    basePath: "/api/plant-whitelist",
    accessor: whitelist,
    requireAdminToken,
    getAccountOrRespond: access,
    sendProviderError,
  });

  // 名单模式：whitelist（只偷名单内）/ blacklist（排除名单内）
  app.get("/api/plant-filter-mode", requireAdminToken, (req, res) => {
    try {
      const accountId = getAccountOrRespond(req, res, access);
      if (!accountId) return;
      const mode = typeof store.getPlantFilterMode === "function"
        ? store.getPlantFilterMode(accountId)
        : "blacklist";
      res.json({ ok: true, data: mode });
    } catch (error) {
      sendProviderError(res, error);
    }
  });

  app.post("/api/plant-filter-mode", requireAdminToken, (req, res) => {
    try {
      const accountId = getAccountOrRespond(req, res, access);
      if (!accountId) return;

      const raw = String((req.body || {}).mode || "").toLowerCase();
      const mode = raw === "whitelist" ? "whitelist" : "blacklist";
      if (typeof store.setPlantFilterMode === "function") {
        store.setPlantFilterMode(accountId, mode);
      }
      if (provider && typeof provider.broadcastConfig === "function") {
        provider.broadcastConfig(accountId);
      }
      res.json({ ok: true, data: mode });
    } catch (error) {
      sendProviderError(res, error);
    }
  });
}

module.exports = { registerAdminPlantBlacklistRoutes };
