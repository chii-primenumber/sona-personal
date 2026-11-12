/**
 * 离线测试用的 DataStore 内存桩。
 *
 * src/lib/store.ts 在模块初始化时就读取全局 DataStore（Pengu Loader 提供），
 * 因此纯 Node 环境下必须先注入这个桩，再导入任何会间接引用 store 的模块。
 */
interface DataStoreLike {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
  remove: (key: string) => void
}

const memory = new Map<string, unknown>()

const stub: DataStoreLike = {
  get: (key) => memory.get(key),
  set: (key, value) => { memory.set(key, value) },
  remove: (key) => { memory.delete(key) },
}

const globalScope = globalThis as unknown as {
  DataStore?: DataStoreLike
  document?: { documentElement: { lang: string } }
}
if (!globalScope.DataStore) globalScope.DataStore = stub
// i18n 的 getCurrentLocale() 会读 document.documentElement.lang；纯 Node 环境补一个最小桩。
if (!globalScope.document) globalScope.document = { documentElement: { lang: 'zh-CN' } }

export {}
