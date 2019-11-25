export default class HotPressTimeoutError extends Error {
  constructor (ms: number) {
    super(`Exceeded ${ms}ms`)
  }
}
