export class InterruptFurtherProcessing extends Error {
  type: string = "@peaque/framework/InterruptFurtherProcessing"
  constructor(message?: string) {
    super(message || "Interrupt further processing")
    this.stack = undefined
  }
}
