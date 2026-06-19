/**
 * Unit: TenantsController — thin HTTP binding over TenantsService.
 *
 * Constructs the controller directly with a hand-mocked service and asserts every
 * route delegates with the right arguments and returns the service result
 * unchanged. A second block reads the route decorator metadata (path + HTTP
 * method) via `Reflector` to lock the route table against string/method mutants.
 *
 * @module tenants/tenants.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TenantsController } from './tenants.controller.js'
import type { TenantsService } from './tenants.service.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with a fully mocked TenantsService.
 *
 * @returns The controller plus each service mock for stubbing and assertions.
 */
function setup() {
  const getProduct = jest.fn<TenantsService['getProduct']>()
  const clearTenant = jest.fn<TenantsService['clearTenant']>()
  const seedForeignNamespace = jest.fn<TenantsService['seedForeignNamespace']>()
  const proveIsolation = jest.fn<TenantsService['proveIsolation']>()

  const serviceMock: Partial<TenantsService> = {
    getProduct,
    clearTenant,
    seedForeignNamespace,
    proveIsolation,
  }

  const controller = new TenantsController(serviceMock as TenantsService)
  return { controller, getProduct, clearTenant, seedForeignNamespace, proveIsolation }
}

describe('TenantsController (unit)', () => {
  describe('delegation', () => {
    it('getProduct forwards the tenant and product id and returns the result', async () => {
      /*
       * Scenario: tenant-scoped read-through.
       * Rule it protects: the controller passes `(params.t, params.id)` to the
       * service and returns its `{ data, source }` result verbatim.
       */
      const { controller, getProduct } = setup()
      const result = {
        data: { id: 'p1', name: 'P', priceCents: 1, tags: [], stock: 1 },
        source: 'cache' as const,
      }
      getProduct.mockResolvedValue(result)

      await expect(controller.getProduct({ t: 't1', id: 'p1' })).resolves.toBe(result)
      expect(getProduct).toHaveBeenCalledWith('t1', 'p1')
    })

    it('clearTenant forwards the tenant id and returns the clear summary', async () => {
      /*
       * Scenario: per-tenant cache clear.
       * Rule it protects: the controller delegates `params.t` to `clearTenant`.
       */
      const { controller, clearTenant } = setup()
      const result = { tenant: 't1', scannedKeys: 2, deleted: 2 }
      clearTenant.mockResolvedValue(result)

      await expect(controller.clearTenant({ t: 't1' })).resolves.toBe(result)
      expect(clearTenant).toHaveBeenCalledWith('t1')
    })

    it('seedForeignNamespace delegates with no arguments', async () => {
      /*
       * Scenario: the raw-client foreign seed.
       * Rule it protects: the controller forwards straight to the service and
       * returns its confirmation unchanged.
       */
      const { controller, seedForeignNamespace } = setup()
      const result = { key: 'other-app:demo', written: true as const }
      seedForeignNamespace.mockResolvedValue(result)

      await expect(controller.seedForeignNamespace()).resolves.toBe(result)
      expect(seedForeignNamespace).toHaveBeenCalledWith()
    })

    it('proveIsolation delegates with no arguments', async () => {
      /*
       * Scenario: the namespace-flush isolation proof.
       * Rule it protects: the controller forwards straight to the service and
       * returns its `{ flushedNamespaceKeys, foreignKeySurvived }` result unchanged.
       */
      const { controller, proveIsolation } = setup()
      const result = { flushedNamespaceKeys: 3, foreignKeySurvived: true }
      proveIsolation.mockResolvedValue(result)

      await expect(controller.proveIsolation()).resolves.toBe(result)
      expect(proveIsolation).toHaveBeenCalledWith()
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller under tenants', () => {
      /*
       * Scenario: inspect the @Controller base path.
       * Rule it protects: the base path string is exactly `tenants`.
       */
      expect(reflector.get<string>(PATH_METADATA, TenantsController)).toBe('tenants')
    })

    it('declares the expected method + path for every handler', () => {
      /*
       * Scenario: inspect each route's verb and sub-path.
       * Rule it protects: the GET/DELETE/POST verbs and the literal sub-paths are
       * pinned so a StringLiteral or method mutant on any route is caught.
       */
      const routes: Array<[keyof TenantsController, RequestMethod, string]> = [
        ['getProduct', RequestMethod.GET, ':t/products/:id'],
        ['clearTenant', RequestMethod.DELETE, ':t/cache'],
        ['seedForeignNamespace', RequestMethod.POST, 'seed-foreign'],
        ['proveIsolation', RequestMethod.POST, 'prove-isolation'],
      ]
      for (const [handler, method, path] of routes) {
        const fn = TenantsController.prototype[handler]
        expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(method)
        expect(reflector.get<string>(PATH_METADATA, fn)).toBe(path)
      }
    })
  })
})
