// 注册 test/alias-loader.mjs 的解析钩子（供 web 的 node --test 使用）
import { register } from 'node:module'

register('./alias-loader.mjs', import.meta.url)
