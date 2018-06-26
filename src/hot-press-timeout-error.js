/**
 * Timeout errors
 * @class HotPressTimeoutError
 * @extends Error
 * @param  {Number} ms The amount of milliseconds
 */
export default class HotPressTimeoutError extends Error {
  /**
   * @constructor
   * @param {Number} ms The milliseconds that exceeded to cause the timeout
   */
  constructor (ms) {
    super(`Exceeded ${ms}ms`)
  }
}
