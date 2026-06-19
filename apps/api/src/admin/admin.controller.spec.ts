/**
 * Unit: AdminController — thin HTTP binding over AdminService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts each
 * Explorer route delegates with the right arguments (including the optional
 * `section` query, present vs absent). A second block pins the route decorator
 * metadata (path + HTTP method) via `Reflector`.
 *
 * @module admin/admin.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { KeyQuery } from './dto/key-query.dto.js'
import { AdminController, keyParamSchema } from './admin.controller.js'
import { AdminService } from './admin.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with a fully mocked AdminService.
 *
 * @returns The controller plus each service mock for stubbing and assertions.
 */
function setup() {
  const getInfo = jest.fn<AdminService['getInfo']>()
  const getKeyspaceBreakdown = jest.fn<AdminService['getKeyspaceBreakdown']>()
  const listKeys = jest.fn<AdminService['listKeys']>()
  const inspectKey = jest.fn<AdminService['inspectKey']>()
  const deleteKey = jest.fn<AdminService['deleteKey']>()
  const persistKey = jest.fn<AdminService['persistKey']>()
  const expireKey = jest.fn<AdminService['expireKey']>()
  const seed = jest.fn<AdminService['seed']>()
  const flushNamespace = jest.fn<AdminService['flushNamespace']>()

  const serviceMock: Partial<AdminService> = {
    getInfo,
    getKeyspaceBreakdown,
    listKeys,
    inspectKey,
    deleteKey,
    persistKey,
    expireKey,
    seed,
    flushNamespace,
  }

  const controller = new AdminController(serviceMock as AdminService)
  return {
    controller,
    getInfo,
    getKeyspaceBreakdown,
    listKeys,
    inspectKey,
    deleteKey,
    persistKey,
    expireKey,
    seed,
    flushNamespace,
  }
}

describe('AdminController (unit)', () => {
  describe('delegation', () => {
    it('getInfo forwards the section when present', async () => {
      /*
       * Scenario: GET /admin/info?section=memory.
       * Rule it protects: the controller passes `query.section` through to the service.
       */
      const { controller, getInfo } = setup()
      getInfo.mockResolvedValue({ memory: { used_memory: '1024' } })

      await expect(controller.getInfo({ section: 'memory' })).resolves.toEqual({
        memory: { used_memory: '1024' },
      })
      expect(getInfo).toHaveBeenCalledWith('memory')
    })

    it('getInfo forwards undefined when no section is given', async () => {
      /*
       * Scenario: GET /admin/info with no query.
       * Rule it protects: the controller forwards `undefined` so the service requests
       * the default INFO sections.
       */
      const { controller, getInfo } = setup()
      getInfo.mockResolvedValue({})

      await expect(controller.getInfo({})).resolves.toEqual({})
      expect(getInfo).toHaveBeenCalledWith(undefined)
    })

    it('getKeyspaceBreakdown delegates with no arguments', async () => {
      /*
       * Scenario: GET /admin/keyspace.
       * Rule it protects: the controller returns the service breakdown verbatim.
       */
      const { controller, getKeyspaceBreakdown } = setup()
      const breakdown = {
        byType: { string: 1, hash: 0, set: 0 },
        byPrefix: [{ prefix: 'product', bytes: 50 }],
        expiry: { withTtl: 1, noTtl: 0 },
      }
      getKeyspaceBreakdown.mockResolvedValue(breakdown)

      await expect(controller.getKeyspaceBreakdown()).resolves.toBe(breakdown)
      expect(getKeyspaceBreakdown).toHaveBeenCalledWith()
    })

    it('listKeys forwards the validated query', async () => {
      /*
       * Scenario: GET /admin/keys with a parsed query.
       * Rule it protects: the controller passes the whole `query` object to the service.
       */
      const { controller, listKeys } = setup()
      const query: KeyQuery = { strategy: 'scan', limit: 200 }
      listKeys.mockResolvedValue({
        keys: ['cache-example:product:1'],
        cursor: null,
        strategy: 'scan',
      })

      await expect(controller.listKeys(query)).resolves.toEqual({
        keys: ['cache-example:product:1'],
        cursor: null,
        strategy: 'scan',
      })
      expect(listKeys).toHaveBeenCalledWith(query)
    })

    it('inspectKey forwards the full key param', async () => {
      /*
       * Scenario: GET /admin/keys/:key.
       * Rule it protects: the controller passes `params.key` to `service.inspectKey`.
       */
      const { controller, inspectKey } = setup()
      const result = {
        key: 'cache-example:product:1',
        type: 'string',
        value: { id: '1' },
        raw: '{"id":"1"}',
        ttl: 100,
        memoryBytes: 64,
      }
      inspectKey.mockResolvedValue(result)

      await expect(controller.inspectKey({ key: 'cache-example:product:1' })).resolves.toBe(result)
      expect(inspectKey).toHaveBeenCalledWith('cache-example:product:1')
    })

    it('deleteKey forwards the full key param', async () => {
      /*
       * Scenario: DELETE /admin/keys/:key.
       * Rule it protects: the controller passes `params.key` to `service.deleteKey`.
       */
      const { controller, deleteKey } = setup()
      deleteKey.mockResolvedValue({ deleted: 1 })

      await expect(controller.deleteKey({ key: 'cache-example:product:1' })).resolves.toEqual({
        deleted: 1,
      })
      expect(deleteKey).toHaveBeenCalledWith('cache-example:product:1')
    })

    it('persistKey forwards the full key param', async () => {
      /*
       * Scenario: POST /admin/keys/:key/persist.
       * Rule it protects: the controller passes `params.key` to `service.persistKey`.
       */
      const { controller, persistKey } = setup()
      persistKey.mockResolvedValue({ ttl: -1 })

      await expect(controller.persistKey({ key: 'cache-example:product:1' })).resolves.toEqual({
        ttl: -1,
      })
      expect(persistKey).toHaveBeenCalledWith('cache-example:product:1')
    })

    it('expireKey forwards the key param and seconds body', async () => {
      /*
       * Scenario: POST /admin/keys/:key/expire.
       * Rule it protects: the controller passes `(params.key, body.seconds)`.
       */
      const { controller, expireKey } = setup()
      expireKey.mockResolvedValue({ ttl: 120 })

      await expect(
        controller.expireKey({ key: 'cache-example:product:1' }, { seconds: 120 }),
      ).resolves.toEqual({ ttl: 120 })
      expect(expireKey).toHaveBeenCalledWith('cache-example:product:1', 120)
    })

    it('seed forwards the validated count', async () => {
      /*
       * Scenario: POST /admin/seed?count=10.
       * Rule it protects: the controller passes `query.count` to `service.seed`.
       */
      const { controller, seed } = setup()
      seed.mockResolvedValue({ seeded: 10 })

      await expect(controller.seed({ count: 10 })).resolves.toEqual({ seeded: 10 })
      expect(seed).toHaveBeenCalledWith(10)
    })

    it('flushNamespace delegates with no arguments', async () => {
      /*
       * Scenario: DELETE /admin/namespace.
       * Rule it protects: the controller returns the service flush count verbatim.
       */
      const { controller, flushNamespace } = setup()
      flushNamespace.mockResolvedValue({ flushed: 42 })

      await expect(controller.flushNamespace()).resolves.toEqual({ flushed: 42 })
      expect(flushNamespace).toHaveBeenCalledWith()
    })
  })

  describe('keyParamSchema', () => {
    it('accepts a well-formed namespaced key', () => {
      /*
       * Scenario: a key in the form `cache-example:prefix:id`.
       * Rule it protects: the refine passes when both arms hold — the namespace
       * prefix matches AND there are at least three colon-delimited segments.
       */
      expect(keyParamSchema.safeParse({ key: 'cache-example:product:1' }).success).toBe(true)
    })

    it('rejects a key outside the application namespace', () => {
      /*
       * Scenario: a key that does not start with `cache-example:`.
       * Rule it protects: the first `&&` arm (startsWith) short-circuits to false, so
       * the refine rejects foreign-namespace keys.
       */
      expect(keyParamSchema.safeParse({ key: 'other:product:1' }).success).toBe(false)
    })

    it('rejects a namespaced key with too few segments', () => {
      /*
       * Scenario: a key in the namespace but lacking a `prefix:id` tail.
       * Rule it protects: the second `&&` arm (segment count ≥ 3) fails, so a bare
       * `cache-example:x` is rejected.
       */
      expect(keyParamSchema.safeParse({ key: 'cache-example:x' }).success).toBe(false)
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under admin', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `admin`.
       */
      expect(reflector.get<string>(PATH_METADATA, AdminController)).toBe('admin')
    })

    it('declares the expected method + path for every handler', () => {
      /*
       * Scenario: inspect each route's verb and sub-path.
       * Rule it protects: GET/POST/DELETE verbs and the literal admin sub-paths are
       * pinned so a StringLiteral or method mutant on any Explorer route is caught.
       */
      const routes: Array<[keyof AdminController, RequestMethod, string]> = [
        ['getInfo', RequestMethod.GET, 'info'],
        ['getKeyspaceBreakdown', RequestMethod.GET, 'keyspace'],
        ['listKeys', RequestMethod.GET, 'keys'],
        ['inspectKey', RequestMethod.GET, 'keys/:key'],
        ['deleteKey', RequestMethod.DELETE, 'keys/:key'],
        ['persistKey', RequestMethod.POST, 'keys/:key/persist'],
        ['expireKey', RequestMethod.POST, 'keys/:key/expire'],
        ['seed', RequestMethod.POST, 'seed'],
        ['flushNamespace', RequestMethod.DELETE, 'namespace'],
      ]
      for (const [handler, method, path] of routes) {
        const fn = AdminController.prototype[handler]
        expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(method)
        expect(reflector.get<string>(PATH_METADATA, fn)).toBe(path)
      }
    })
  })
})
