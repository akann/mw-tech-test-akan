import { beforeAll, afterAll } from 'vitest';
import { app } from '@app/app';

export const fastify = app();

beforeAll(async () => {
  // called once before all tests run
  await fastify.ready();
});
afterAll(async () => {
  // called once after all tests run
  await fastify.close();
});
