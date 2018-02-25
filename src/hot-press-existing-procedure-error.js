/**
 * Error to be thrown when registering a procedure that has already been
 * registerd.
 * @class HotPressExistingProcedureError
 * @extends Error
 * @param  {String} name The name of the procedure
 */
export default class HotPressExistingProcedureError extends Error {
  /**
   * @constructor
   * @param {String} name The name of the procedure
   */
  constructor (name) {
    super(`The procedure "${name}" is already registered`)
  }
}
