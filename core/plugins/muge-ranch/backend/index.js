/**
 * 牧歌初启（2026111700）活动插件入口。
 *
 * 宿主契约 apiVersion 1：
 *   - admin.register：查询与领取两条 HTTP 路由，转发到 worker 内的 api 方法。
 *   - worker.register：GetGroup/Operate 协议服务 + 四个领取开关的自动化 runner。
 *
 * 协议证据全部来自 2026-11-17 官方客户端抓包，见 backend/proto/muge.proto。
 * 牧场人格（2026111705）支持手动答题、结算与领取首次分享奖励。
 */

const path = require('node:path');
const { createMugeService, WORKFLOW } = require('./service');

const PLUGIN_ROOT = __dirname;
// 与 manifest.automation 的 key 一一对应；runner 只处理这四个
const AUTOMATION_KEYS = [
    'muge_celebration_claim',
    'muge_friend_claim',
    'muge_manual_task_claim',
    'muge_manual_stage_claim',
];
// 牧场人格仅支持手动操作，不进入自动化
const PERSONALITY_ACTIONS = new Set(['saveAnswers', 'settle', 'claimShare']);

let service = null;

function buildTypes(ctx) {
    // 宿主模块必须经 ctx.requireModule 白名单解析（安装目录向上解析不到宿主 node_modules）
    const protobuf = ctx.requireModule('protobufjs');
    const root = new protobuf.Root();
    root.loadSync(path.join(PLUGIN_ROOT, 'proto', 'muge.proto'), { keepCase: true });
    return {
        util: protobuf.util,
        MugeGetGroupRequest: root.lookupType('gamepb.mugepb.MugeGetGroupRequest'),
        MugeGetGroupReply: root.lookupType('gamepb.mugepb.MugeGetGroupReply'),
        MugeListRequest: root.lookupType('gamepb.mugepb.MugeListRequest'),
        MugeListReply: root.lookupType('gamepb.mugepb.MugeListReply'),
        MugeOperateRequest: root.lookupType('gamepb.mugepb.MugeOperateRequest'),
        MugeOperateReply: root.lookupType('gamepb.mugepb.MugeOperateReply'),
    };
}

function ensureService(ctx) {
    if (service) return;
    const types = buildTypes(ctx);
    service = createMugeService({
        types,
        util: types.util,
        send: ctx.sendMsgAsync,
        itemDto: ctx.itemDto,
        now: ctx.getServerTimeSec,
        log: ctx.log,
    });
}

async function runMugeAutomation(runContext) {
    const { automation, isAccountReady, log } = runContext;
    if (!service) return;
    const enabled = {
        muge_celebration_claim: automation?.muge_celebration_claim === true,
        muge_friend_claim: automation?.muge_friend_claim === true,
        muge_manual_task_claim: automation?.muge_manual_task_claim === true,
        muge_manual_stage_claim: automation?.muge_manual_stage_claim === true,
    };
    if (!Object.values(enabled).some(Boolean)) return;
    try {
        await service.claimEnabled({ ...enabled, canProceed: () => !isAccountReady || isAccountReady() });
    } catch (error) {
        log?.('活动', `牧歌初启自动领取失败：${error.message}`, {
            module: 'activity', event: '牧歌初启自动检查', result: 'error',
        });
    }
}

module.exports = {
    apiVersion: 1,
    admin: {
        register(ctx) {
            ctx.route('get', '/api/activity/muge-ranch', async (req, res) => {
                const accountId = ctx.requireAccount(req, res);
                if (!accountId) return;
                try {
                    if (!ctx.requireConnected(res, accountId, '账号未运行')) return;
                    res.json({ ok: true, activity: await ctx.callWorker(accountId, 'getMuge', [req.query?.force === '1'], 90000) });
                } catch (error) { ctx.sendError(res, error); }
            });
            ctx.route('post', '/api/activity/muge-ranch/claim', async (req, res) => {
                const accountId = ctx.requireAccount(req, res);
                if (!accountId) return;
                try {
                    if (!ctx.requireConnected(res, accountId, '账号未运行')) return;
                    const action = String(req.body?.action || '');
                    if (!WORKFLOW[action]) return res.status(400).json({ ok: false, error: '不支持的领取类型' });
                    res.json({ ok: true, ...await ctx.callWorker(accountId, 'claimMuge', [action], 190000) });
                } catch (error) { ctx.sendError(res, error); }
            });
            ctx.route('post', '/api/activity/muge-ranch/personality', async (req, res) => {
                const accountId = ctx.requireAccount(req, res);
                if (!accountId) return;
                try {
                    if (!ctx.requireConnected(res, accountId, '账号未运行')) return;
                    const action = String(req.body?.action || '');
                    if (!PERSONALITY_ACTIONS.has(action)) return res.status(400).json({ ok: false, error: '不支持的牧场人格操作' });
                    const input = req.body?.input && typeof req.body.input === 'object' ? req.body.input : {};
                    res.json({ ok: true, ...await ctx.callWorker(accountId, 'personalityMuge', [action, input], 190000) });
                } catch (error) { ctx.sendError(res, error); }
            });
        },
        unregister() { /* 路由摘除由宿主完成 */ },
    },
    worker: {
        register(ctx) {
            ensureService(ctx);
            ctx.registerApiMethod('getMuge', force => service.getOverview(force === true));
            ctx.registerApiMethod('claimMuge', async action => {
                const result = await service.claim(action);
                const activity = await service.getOverview(true);
                return { result, activity };
            });
            ctx.registerApiMethod('personalityMuge', async (action, input) => {
                const result = await service.personality(action, input);
                // personality() 内部已重新读取并刷新缓存，这里直接取缓存即可
                const activity = await service.getOverview();
                return { result, activity };
            });
            ctx.registerAutomation({
                keys: AUTOMATION_KEYS,
                run: runContext => runMugeAutomation({ ...runContext, log: ctx.log }),
            });
        },
        unregister() {
            service = null;
        },
    },
};
