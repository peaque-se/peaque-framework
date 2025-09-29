export class InterruptFurtherProcessing extends Error {
  constructor(message?: string) {
    super(message || "Interrupt further processing")
  }
}
