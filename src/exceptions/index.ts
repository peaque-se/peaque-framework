/**
 * Exception thrown to interrupt further processing in the request pipeline.
 *
 * This is a special control-flow exception that signals the framework to stop
 * processing the current request without treating it as an error. Useful for
 * implementing early returns in middleware chains.
 *
 * @example
 * ```typescript
 * export default async function guard(req: PeaqueRequest): Promise<GuardResult> {
 *   if (!req.cookies().get('auth')) {
 *     req.redirect('/login');
 *     throw new InterruptFurtherProcessing();
 *   }
 *   return { allow: true };
 * }
 * ```
 */
export class InterruptFurtherProcessing extends Error {
  /** Unique type identifier for this exception */
  readonly type: string = "@peaque/framework/InterruptFurtherProcessing";

  /**
   * Creates a new InterruptFurtherProcessing exception
   * @param message - Optional message describing why processing was interrupted
   */
  constructor(message?: string) {
    super(message || "Interrupt further processing");
    this.name = "InterruptFurtherProcessing";
    // Remove stack trace as this is a control-flow exception, not an error
    this.stack = undefined;
  }
}
