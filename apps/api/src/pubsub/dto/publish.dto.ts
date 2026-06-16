/**
 * Publish DTO — body schema for POST /pubsub/publish.
 *
 * Layer: pubsub. Zod-validated; no Swagger.
 */
import { z } from 'zod'

/** Body for POST /pubsub/publish — an app channel + an arbitrary JSON message. */
export const publishSchema = z.object({
  channel: z.string().min(1),
  message: z.unknown(),
})

/** Inferred publish-request type. */
export type PublishDto = z.infer<typeof publishSchema>
