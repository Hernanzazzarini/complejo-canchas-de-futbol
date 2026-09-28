import { jest } from '@jest/globals';

/**
 * Corriendo en ESM, Jest inyecta `describe`/`it`/`expect` pero no el objeto
 * `jest`. Se publica acá como global para que los specs lo usen con el tipado
 * laxo de @types/jest, en vez de importarlo uno por uno desde '@jest/globals'.
 */
(globalThis as Record<string, unknown>).jest = jest;
