/**
 * Error to be thrown when a trying to reference a non-existant procedure.
 * @class HotPressNonExistingProcedureError
 * @this HotPress
 * @extends Error
 * @param  {String} name The name of the procedure
 */
export default class HotPressNonExistingProcedureError extends Error {
  /**
   * @constructor
   * @param {String} name The name of the procedure
   */
  constructor (name) {
    super(`The procedure "${name}" doesn't exist`)
  }
}
