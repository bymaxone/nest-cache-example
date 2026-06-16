/**
 * Application entry point for the nest-cache-example API.
 *
 * Graceful-shutdown ordering (driven by `app.enableShutdownHooks()`):
 *   1. Process receives SIGTERM/SIGINT.
 *   2. Nest stops accepting new HTTP/WS connections (the Express server closes).
 *   3. Nest fires `OnModuleDestroy` across providers in reverse-dependency order.
 *   4. The library's `ConnectionManager` runs `quit()` on the main client,
 *      bounded by `shutdownTimeoutMs` (default 5000); `PubSubService` closes its
 *      dedicated subscriber; the TTL raw subscriber quits last.
 *
 * CORS for the socket.io gateway is applied at the adapter level (SocketIoAdapter
 * below) so the `@WebSocketGateway` decorator stays static and `WEB_ORIGIN` is
 * read once from the validated `ConfigService` — never from `process.env` directly.
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { INestApplication } from '@nestjs/common'
import type { ServerOptions } from 'socket.io'
import { AppModule } from './app.module.js'
import type { Env } from './config/env.schema.js'

/**
 * Extends IoAdapter to apply CORS at the socket.io server level, so the
 * `@WebSocketGateway` decorator stays a static literal (no `process.env` read).
 * CORS origin is resolved once from the validated ConfigService after boot.
 */
class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly corsOrigin: string,
  ) {
    super(app)
  }

  override createIOServer(
    port: number,
    options?: ServerOptions,
  ): ReturnType<IoAdapter['createIOServer']> {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigin, credentials: true },
    })
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get<ConfigService<Env, true>>(ConfigService)
  const origin = config.get('WEB_ORIGIN', { infer: true })
  app.enableCors({ origin, credentials: true })
  app.useWebSocketAdapter(new SocketIoAdapter(app, origin))
  app.enableShutdownHooks()
  await app.listen(config.get('PORT', { infer: true }))
}

void bootstrap()
