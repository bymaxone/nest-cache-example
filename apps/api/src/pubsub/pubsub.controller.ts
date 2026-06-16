/**
 * Pub/Sub controller — publish, subscribe lifecycle, and error-isolation demo.
 *
 * Layer: pubsub. Thin: validates inputs with Zod, delegates to PubSubBridgeService.
 * No Swagger; no business logic. Routes:
 *   POST   /pubsub/publish    — publish a message; returns subscriber count
 *   POST   /pubsub/subscribe  — add a subscription (ref-counted)
 *   DELETE /pubsub/subscribe  — remove a subscription (ref-counted)
 *   POST   /pubsub/throw      — trigger an intentional handler throw (error-isolation demo)
 */
import { Body, Controller, Delete, Post } from '@nestjs/common'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { PubSubBridgeService } from './pubsub.bridge.service.js'
import { publishSchema, type PublishDto } from './dto/publish.dto.js'
import { subscribeSchema, type SubscribeDto } from './dto/subscribe.dto.js'

/**
 * Handles all /pubsub routes for the Pub/Sub + WebSocket bridge demo.
 *
 * The library namespaces every channel transparently: 'product-events' →
 * 'cache-example:product-events' (spec §17.1). This controller never prepends the
 * namespace by hand.
 */
@Controller('pubsub')
export class PubSubController {
  constructor(private readonly bridge: PubSubBridgeService) {}

  /**
   * POST /pubsub/publish — publish a message to the given channel.
   *
   * The channel is namespaced by the library before reaching Redis, so
   * 'product-events' is transparently published to 'cache-example:product-events'.
   * The subscriber count reflects how many listeners (including the server-side
   * EventsGateway bridge) are subscribed to that namespaced channel.
   *
   * @param body - Validated publish request (channel + message).
   * @returns The channel and the number of subscribers that received the message.
   */
  @Post('publish')
  async publish(
    @Body(new ZodValidationPipe(publishSchema)) body: PublishDto,
  ): Promise<{ channel: string; subscribers: number }> {
    const subscribers = await this.bridge.publish(body.channel, body.message)
    return { channel: body.channel, subscribers }
  }

  /**
   * POST /pubsub/subscribe — add a subscription for a channel or pattern.
   *
   * If a subscription for the channel already exists, its ref count is incremented
   * without opening a second Redis connection — demonstrating the library's internal
   * ref-counting (spec §17.2). The returned refs count shows how many callers hold
   * a reference to this channel's subscription.
   *
   * @param body - Validated subscribe request (channel + optional pattern flag).
   * @returns The channel, current ref count, and whether it is a pattern subscription.
   */
  @Post('subscribe')
  async subscribe(
    @Body(new ZodValidationPipe(subscribeSchema)) body: SubscribeDto,
  ): Promise<{ channel: string; refs: number; pattern: boolean }> {
    const result = await this.bridge.addSubscription(body.channel, body.pattern)
    return { channel: body.channel, refs: result.refs, pattern: result.isPattern }
  }

  /**
   * DELETE /pubsub/subscribe — remove a subscription for a channel or pattern.
   *
   * Decrements the ref count. The underlying Redis UNSUBSCRIBE is issued only
   * when the last reference is removed (spec §17.2). A DELETE on an unknown or
   * already-removed channel is a safe no-op (returns refs: 0, never throws).
   *
   * @param body - Validated subscribe request (channel + optional pattern flag).
   * @returns The channel, remaining ref count, and whether it was a pattern subscription.
   */
  @Delete('subscribe')
  async unsubscribe(
    @Body(new ZodValidationPipe(subscribeSchema)) body: SubscribeDto,
  ): Promise<{ channel: string; refs: number; pattern: boolean }> {
    const result = await this.bridge.removeSubscription(body.channel)
    return { channel: body.channel, refs: result.refs, pattern: result.isPattern }
  }

  /**
   * POST /pubsub/throw — trigger an intentional handler throw on the error-demo channel,
   * proving handler-error isolation.
   *
   * The library swallows the throw and forwards it to events.onEvent as an 'error'
   * with reason: 'handler_error'. Other channels (e.g. product-events) keep
   * delivering normally — the shared subscriber is never torn down (spec §17.1).
   *
   * @returns Confirmation that the trigger was sent.
   */
  @Post('throw')
  async triggerHandlerError(): Promise<{ triggered: boolean }> {
    await this.bridge.triggerErrorDemo()
    return { triggered: true }
  }
}
