const wxLoginAdapter = require("../services/wx-login-adapter");
const { getPinzanSettings, savePinzanSettings } = require("../services/wx-login/pinzan-config");
const pinzanRegions = require("../services/wx-login/pinzan-regions");
const { clearPinzanProxyCache } = require("../services/wx-login/proxy");

function registerAdminProxyRoutes({ app, logger }) {
  app.get("/api/wx-login/pinzan/regions", (req, res) => {
    res.json({ ok: true, data: pinzanRegions });
  });

  app.get("/api/wx-login/pinzan", (req, res) => {
    res.json({ ok: true, data: getPinzanSettings() });
  });

  app.post("/api/wx-login/pinzan", (req, res) => {
    try {
      const data = savePinzanSettings(req.body && typeof req.body === "object" ? req.body : {});
      clearPinzanProxyCache();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/wx-login/protocol", async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { action, ...payload } = body;
    if (!action) {
      return res.status(400).json({ code: -1, msg: "缺少 action 参数" });
    }

    try {
      if (!["getqr", "checkqr", "jslogin"].includes(action)) {
        return res.status(400).json({ code: -1, msg: "不支持的应用宝协议操作" });
      }
      const owner = req.currentUser && req.currentUser.username;
      let data;
      if (action === "getqr") {
        data = await wxLoginAdapter.getQRCode(owner, payload.proxy);
      } else if (action === "checkqr") {
        data = await wxLoginAdapter.checkQR(payload.uuid, owner);
      } else {
        data = await wxLoginAdapter.getFarmCode(payload.wxid || payload.Wxid, {
          sessionId: payload.sessionId || payload.uuid,
          owner,
          accountId: payload.accountId,
        });
      }
      return res.json(data);
    } catch (error) {
      logger.error("wx login protocol error", { error: error.message, action });
      res.status(500).json({
        code: -1,
        msg: `应用宝协议请求失败: ${  error.message}`,
      });
    }
  });
}

module.exports = { registerAdminProxyRoutes };
