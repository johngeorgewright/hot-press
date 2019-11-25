export default class HotPressExistingProcedureError extends Error {
  constructor (name: string) {
    super(`The procedure "${name}" is already registered`)
  }
}
