/**
 * @fileoverview Shared UI constants for the dashboard.
 *
 * @module lib/constants
 */

/**
 * The cache namespace this dashboard is bound to. The library binds one
 * `namespace` per module instance, so this is fixed and shown read-only;
 * multi-tenancy is prefix scoping within it, not namespace switching.
 */
export const APP_NAMESPACE = 'cache-example'
