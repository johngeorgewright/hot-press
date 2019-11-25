export default class HotPressNonExistingProcedureError extends Error {
  constructor (name: string) {
    super(`The procedure "${name}" doesn't exist`)
  }
}
