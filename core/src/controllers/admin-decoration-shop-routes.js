const { getItemById, getSeedImageBySeedId } = require("../config/gameConfig");
const { toNum } = require("../utils/utils");

const DECORATION_SHOP_ID = 4;
// shop 4 是混合商店（抓包实证 2026-11-15）：
//   - 牧草种子（item 20040，goods 2129，20 金币，Lv1）——货币 1001，可重复购买；
//   - 头像框（2130 萌宠柯基 / 2131 春耕纪，980 金豆豆，Lv8）——一次性拥有；
//   - 夏野农家系列农场装扮（type 18）。
// 抓包 BuyGoods 回包 cost_items：牧草种子扣 item 1001(金币)x20。
const GOLD_CURRENCY_ID = 1001;
const GOLD_BEAN_CURRENCY_ID = 1005;
const SEED_ITEM_TYPE = 5;
const PASTURE_GRASS_ITEM_ID = 20040;

function getAuthorizedAccountId({
  req,
  res,
  getAccountIdFromRequest,
  canAccessAccount,
}) {
  const accountId = getAccountIdFromRequest(req);
  if (!accountId) {
    res.status(400).json({ ok: false, error: "Missing\x20x-account-id" });
    return null;
  }
  if (!canAccessAccount(req, accountId)) {
    res.status(403).json({ ok: false, error: "无权访问此账号" });
    return null;
  }
  return accountId;
}

function getOwnedDecorationIds(bag) {
  const items = Array.isArray(bag?.originalItems)
    ? bag.originalItems
    : Array.isArray(bag?.items) ? bag.items : [];
  return new Set(items
    .filter((item) => Number(item?.count) > 0)
    .map((item) => Number(item?.id) || 0));
}

function getDecorationGoods(shopReply) {
  // 返回 shop 4 全部商品，保持服务端回包顺序
  return (shopReply?.goods_list || []).filter((goods) => toNum(goods?.item_id) > 0);
}

function resolveShopCurrency(itemId, itemConfig) {
  // 种子类用金币（牧草种子抓包扣 1001），其余装扮类沿用金豆豆口径
  if (Number(itemConfig?.type) === SEED_ITEM_TYPE || Number(itemId) === PASTURE_GRASS_ITEM_ID) {
    return { currencyId: GOLD_CURRENCY_ID, currencyLabel: "金币" };
  }
  return { currencyId: GOLD_BEAN_CURRENCY_ID, currencyLabel: "金豆豆" };
}

function buildDecorationItem(itemId, userGoldBean, ownedDecorationIds = new Set(), goods, context = {}) {
  const itemConfig = getItemById(itemId);
  if (!itemConfig) return null;

  const price = toNum(goods?.price) || Number(itemConfig.price) || 0;
  const limitCount = toNum(goods?.limit_count) || 0;
  const boughtNum = toNum(goods?.bought_num) || 0;
  const soldOut = limitCount > 0 && boughtNum >= limitCount;
  const { currencyId, currencyLabel } = resolveShopCurrency(itemId, itemConfig);
  const balance = currencyId === GOLD_CURRENCY_ID ? Number(context.userGold || 0) : userGoldBean;

  let requiredLevel = 0;
  for (const cond of goods?.conds || []) {
    if (toNum(cond.type) === 1) requiredLevel = toNum(cond.param) || 0;
  }
  const lockedByLevel = Number(context.userLevel || 0) > 0 && requiredLevel > Number(context.userLevel);

  // 头像框使用后即从背包消失，购买记录（售罄/限购）是拥有的权威来源；
  // 种子可重复购买，不按背包判定为已拥有。
  const isSeed = Number(itemConfig.type) === SEED_ITEM_TYPE;
  const owned = !isSeed && (soldOut || ownedDecorationIds.has(itemId));
  return {
    id: toNum(goods?.id) || itemId,
    itemId,
    itemType: Number(itemConfig.type) || 0,
    itemCount: toNum(goods?.item_count) || 1,
    price,
    limitCount,
    boughtNum,
    name: itemConfig.name || `装扮${  itemId}`,
    image: getSeedImageBySeedId(itemId),
    desc: itemConfig.desc || "",
    effectDesc: itemConfig.effectDesc || "",
    requiredLevel,
    locked: goods?.unlocked === false || lockedByLevel,
    currencyId,
    currencyLabel,
    owned,
    canBuy: !owned && !lockedByLevel && goods?.unlocked !== false && !soldOut && balance >= price,
  };
}

function registerAdminDecorationShopRoutes({
  app,
  provider,
  adminLogger,
  getAccountIdFromRequest,
  canAccessAccount,
  sendProviderError,
}) {
  app.get("/api/shop/decoration", async (req, res) => {
    const accountId = getAuthorizedAccountId({
      req,
      res,
      getAccountIdFromRequest,
      canAccessAccount,
    });
    if (!accountId) return;

    try {
      const status = provider.getStatus(accountId);
      if (!status || !status.connection || !status.connection.connected) {
        return res.json({
          ok: false,
          error: "获取装扮商城失败:\x20账号未运行",
        });
      }

      const userGoldBean = status?.status?.goldBean || 0;
      const userGold = status?.status?.gold || 0;
      const userLevel = status?.status?.level || 0;
      const [bag, shopReply] = await Promise.all([
        provider.getBag(accountId),
        provider.getShopInfo(accountId, DECORATION_SHOP_ID),
      ]);
      const ownedDecorationIds = getOwnedDecorationIds(bag);
      const decorationGoods = getDecorationGoods(shopReply);
      const decorations = decorationGoods
        .map((goods) => {
          const itemId = toNum(goods?.item_id) || 0;
          return buildDecorationItem(itemId, userGoldBean, ownedDecorationIds, goods, {
            userGold,
            userLevel,
          });
        })
        .filter(Boolean);

      res.json({ ok: true, data: decorations, userGoldBean, userGold });
    } catch (error) {
      adminLogger.error("获取装扮商城失败", {
        error: error.message,
        stack: error.stack,
      });
      sendProviderError(res, error);
    }
  });
}

module.exports = {
  buildDecorationItem,
  getDecorationGoods,
  getOwnedDecorationIds,
  registerAdminDecorationShopRoutes,
};
