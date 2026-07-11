import type { Core } from '@strapi/strapi';

const queues: Record<string, any> = {};
const workers: Record<string, any> = {};

function getConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export function getQueue(name: string) {
  return queues[name];
}

export function createWorker(name: string, processor: (job: any) => Promise<any>, options?: { concurrency?: number }) {
  return workers[name];
}

export async function addJob(queueName: string, jobName: string, data: any, options?: any) {
  return null;
}

export async function registerQueues(strapi: Core.Strapi) {
  (strapi as any).queue = { add: addJob };
}

export async function closeAllQueues() {
  // no-op
}
