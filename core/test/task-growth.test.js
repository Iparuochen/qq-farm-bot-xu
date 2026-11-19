const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDailyTasksForDebug,
  buildGrowthTasks,
  summarizeDailyTaskProgress,
} = require('../src/services/task');

test('growth tasks prefer the dedicated growth_tasks field', () => {
  const dedicated = [{ id: 1, task_type: 1 }];
  const merged = [{ id: 2, task_type: 1 }];

  assert.deepEqual(buildGrowthTasks({
    growth_tasks: dedicated,
    tasks: merged,
  }), dedicated);
});

test('growth tasks fall back to type 1 entries in the merged tasks field', () => {
  const growth = { id: 11, task_type: 1 };
  const daily = { id: 12, task_type: 3 };
  const other = { id: 13, task_type: 2 };

  assert.deepEqual(buildGrowthTasks({
    growth_tasks: [],
    tasks: [daily, growth, other],
  }), [growth]);
});

test('growth tasks tolerate a missing task payload', () => {
  assert.deepEqual(buildGrowthTasks(null), []);
  assert.deepEqual(buildGrowthTasks({}), []);
});

test('daily tasks fall back to type 2 entries in the merged task fields', () => {
  const daily = { id: 21, task_type: 2 };
  const growth = { id: 22, task_type: 1 };
  const other = { id: 23, task_type: 3 };

  assert.deepEqual(buildDailyTasksForDebug({
    daily_tasks: [],
    tasks: [growth, daily, other],
  }), [daily]);
});

test('an empty daily task list is not treated as completed', () => {
  assert.deepEqual(summarizeDailyTaskProgress([]), {
    doneToday: false,
    completedCount: 0,
    totalCount: 3,
  });
});

test('daily task progress uses the number of visible tasks up to three', () => {
  assert.deepEqual(summarizeDailyTaskProgress([
    { progress: 1, total_progress: 1 },
    { progress: 2, total_progress: 2 },
  ]), {
    doneToday: true,
    completedCount: 2,
    totalCount: 2,
  });
});

test('daily task progress stays incomplete while a visible task is unfinished', () => {
  assert.deepEqual(summarizeDailyTaskProgress([
    { progress: 1, total_progress: 1 },
    { progress: 0, total_progress: 2 },
    { progress: 3, total_progress: 3 },
  ]), {
    doneToday: false,
    completedCount: 2,
    totalCount: 3,
  });
});

test('claimed daily tasks stay completed when the server resets their progress', () => {
  assert.deepEqual(summarizeDailyTaskProgress([
    { progress: 0, total_progress: 1, is_claimed: true },
    { progress: 0, total_progress: 2, is_claimed: true },
    { progress: 0, total_progress: 3, is_claimed: true },
  ]), {
    doneToday: true,
    completedCount: 3,
    totalCount: 3,
  });
});

test('daily task progress only counts the three visible tasks', () => {
  assert.deepEqual(summarizeDailyTaskProgress([
    { progress: 1, total_progress: 1 },
    { progress: 0, total_progress: 1 },
    { progress: 0, total_progress: 1 },
    { progress: 1, total_progress: 1 },
  ]), {
    doneToday: false,
    completedCount: 1,
    totalCount: 3,
  });
});

// ---- 客户端上报类成长任务（打开好友面板 cond=15 / 设置QQ状态 cond=25） ----

const { pickClientReportedTasks } = require('../src/services/task');

test('client reported growth tasks cover friend-panel and QQ-status conditions only', () => {
  const tasks = [
    { id: 100057, cond_type: 25, is_unlocked: true, is_claimed: false, progress: 0, total_progress: 1 },
    { id: 90005, cond_type: 15, is_unlocked: true, is_claimed: false, progress: 0, total_progress: 1 },
    { id: 90006, cond_type: 7, is_unlocked: true, is_claimed: false, progress: 0, total_progress: 1 },
  ];
  assert.deepEqual(pickClientReportedTasks(tasks).map((t) => t.id), [100057, 90005]);
});

test('client reported growth tasks skip claimed, locked, finished and empty entries', () => {
  const base = { cond_type: 25, is_unlocked: true, is_claimed: false, progress: 0, total_progress: 1 };
  const tasks = [
    { ...base, id: 1, is_claimed: true },
    { ...base, id: 2, is_unlocked: false },
    { ...base, id: 3, progress: 1 },
    { ...base, id: 4, total_progress: 0 },
    { ...base, id: 0 },
    null,
  ];
  assert.deepEqual(pickClientReportedTasks(tasks), []);
  assert.deepEqual(pickClientReportedTasks(null), []);
});
