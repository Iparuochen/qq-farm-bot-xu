// node --test 的自定义解析钩子：让 web/test 下的 TS 测试能解析
// 1. vite 的 '@/xxx' 别名（映射到 src/）
// 2. 不带扩展名的相对导入（补 .ts / /index.ts）
// 仅供本地 node --test 使用，vite 构建不受影响。
import { existsSync, statSync } from 'node:fs'

const SRC_PREFIX = '@/'

// 依优先级给出候选 URL
function candidatesFor(baseHref) {
  return [
    baseHref + '.ts',
    baseHref + '.tsx',
    baseHref + '.js',
    baseHref + '/index.ts',
    baseHref,
  ]
}

function resolveCandidates(baseHref) {
  for (const href of candidatesFor(baseHref)) {
    try {
      const u = new URL(href)
      if (existsSync(u) && !statSync(u).isDirectory()) return u.href
      // 目录命中则尝试其 index.ts
      if (existsSync(u) && statSync(u).isDirectory()) {
        const idx = new URL('index.ts', u)
        if (existsSync(idx)) return idx.href
      }
    } catch { /* 非法 URL，跳过 */ }
  }
  return null
}

export async function resolve(specifier, context, next) {
  // 1. '@/xxx' 别名 → src/xxx（相对本文件所在 test/ 目录的上一级）
  if (specifier.startsWith(SRC_PREFIX)) {
    const base = new URL(`../src/${specifier.slice(SRC_PREFIX.length)}`, import.meta.url)
    const hit = resolveCandidates(base.href)
    if (hit) return next(hit, context)
    return next(specifier, context)
  }

  // 2. 不带扩展名的相对导入 → 补 .ts / /index.ts
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    if (/\.[cm]?[jt]sx?$/.test(specifier)) return next(specifier, context) // 已带扩展名
    const abs = new URL(specifier, context.parentURL)
    const hit = resolveCandidates(abs.href)
    if (hit) return next(hit, context)
  }

  return next(specifier, context)
}
