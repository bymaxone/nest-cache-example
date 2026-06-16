/**
 * Subscribe DTO — body schema for POST/DELETE /pubsub/subscribe.
 *
 * Layer: pubsub. Zod-validated; no Swagger.
 */
import { z } from 'zod'

/** Body for POST/DELETE /pubsub/subscribe. */
export const subscribeSchema = z.object({
  channel: z.string().min(1),
  /** true → psubscribe (e.g. 'product:*'). Default: false. */
  pattern: z.boolean().default(false),
})

/** Inferred subscribe-request type. */
export type SubscribeDto = z.infer<typeof subscribeSchema>
