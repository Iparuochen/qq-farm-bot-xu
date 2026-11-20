const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('pet');

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 正常 12 小时检测一次
const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 失败（断线/场景取消等）10 分钟后重试
const lastCheckMap = new Map(); // accountId -> { at, failed }

// 狗粮 ID：1天(90004)、3天(90005)、5天(90006)，优先喂时长短的
const FOOD_PRIORITY = [90004, 90005, 90006];
const DOG_FOOD_GOODS_ID = 1006; // 商城狗粮礼包

let nowFn = () => Date.now(); // 可注入时钟，仅供测试

async function checkAndAutoPet(accountId) {
  if (!accountId) return;
  const now = nowFn();
  const state = lastCheckMap.get(accountId) || { at: 0, failed: false };
  const interval = state.failed ? RETRY_INTERVAL_MS : CHECK_INTERVAL_MS;
  if (now - state.at < interval) {
    return;
  }

  const store = require('../models/store');
  const autoCfg = store.getAutomation(accountId) || {};
  const autoBuyFood = autoCfg.auto_buy_dog_food === true;
  const autoFeedDog = autoCfg.auto_feed_dog === true;

  // 开关没开：不占用检查窗口。这样打开开关后，下一轮定时器（最长 30 分钟）就会生效，
  // 而不是等上一个 12 小时窗口走完。
  if (!autoBuyFood && !autoFeedDog) return;

  const pets = require('./pets');
  const markDone = () => lastCheckMap.set(accountId, { at: nowFn(), failed: false });

  try {
    const overview = await pets.getPetOverview();
    if (!overview || !overview.deployedId) {
      logger.info('宠物未派出守护，跳过自动喂食/买粮检查');
      markDone();
      return;
    }

    const remainingSec = Number(overview.foodSeconds) || 0;
    const remainingHours = Math.floor(remainingSec / 3600);

    // 自动喂食：守护时长不足24小时
    if (autoFeedDog && remainingSec < 24 * 3600) {
      const foods = Array.isArray(overview.foods) ? overview.foods : [];
      const availableFood = FOOD_PRIORITY
        .map(id => foods.find(f => f.id === id && f.count > 0))
        .find(Boolean);

      if (availableFood) {
        await pets.feedDog(availableFood.id, 1);
        logger.info(`守护剩余不足24小时(当前${remainingHours}小时)，已自动喂食【${availableFood.name}】x1`);
      } else if (autoBuyFood) {
        // 背包没粮，触发自动买粮
        const mall = require('./mall');
        try {
          await mall.purchaseMallGoods(DOG_FOOD_GOODS_ID, 1);
          logger.info('背包狗粮已耗尽，已自动在商城购买【狗粮礼包】');
          // 重新拉取背包再喂食
          const nextOverview = await pets.getPetOverview();
          const nextFoods = Array.isArray(nextOverview.foods) ? nextOverview.foods : [];
          const nextAvailable = FOOD_PRIORITY
            .map(id => nextFoods.find(f => f.id === id && f.count > 0))
            .find(Boolean);
          if (nextAvailable) {
            await pets.feedDog(nextAvailable.id, 1);
            logger.info(`已自动喂食新购【${nextAvailable.name}】x1`);
          }
        } catch (mallErr) {
          logger.warn(`自动买狗粮失败: ${mallErr.message}`);
        }
      }
    }
    markDone();
  } catch (err) {
    // 巡查失败（断线、场景取消等）：10 分钟后重试，不让一次失败把喂食拖后 12 小时
    lastCheckMap.set(accountId, { at: nowFn(), failed: true });
    logger.warn(`宠物守护巡查异常: ${err.message}`);
  }
}

module.exports = {
  checkAndAutoPet,
  resetPetPacing: (id) => lastCheckMap.delete(id),
  _setNowProvider: (fn) => { nowFn = typeof fn === 'function' ? fn : () => Date.now(); }
};
