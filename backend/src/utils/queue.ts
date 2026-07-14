import { Queue, Worker, QueueEvents, type JobsOptions } from 'bullmq';
import type { Core } from '@strapi/strapi';

const REDIS_HOST = process.env.REDIS_HOST || '';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const queues: Record<string, Queue> = {};
const workers: Record<string, Worker> = {};
const queueEvents: Record<string, QueueEvents> = {};
let isAvailable = false;

export function isQueueAvailable(): boolean {
  const available = isAvailable && !!REDIS_HOST;
  if (!available && !REDIS_HOST) {
    console.warn('[Queue] Redis not configured (REDIS_HOST missing). Queue features disabled.');
  }
  return available;
}

async function checkConnection(): Promise<boolean> {
  if (!REDIS_HOST) {
    console.log('[Queue] Disabled - REDIS_HOST not set');
    return false;
  }

  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      connectTimeout: 3000,
    });

    await redis.ping();
    await redis.disconnect();
    isAvailable = true;
    console.log('[Queue] Redis connection successful');
    return true;
  } catch (err) {
    console.warn('[Queue] Redis connection failed:', err instanceof Error ? err.message : err);
    isAvailable = false;
    return false;
  }
}

const connectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

export function getQueue(name: string): Queue | null {
  if (!REDIS_HOST) {
    return null;
  }

  if (!isAvailable) {
    console.log('[Queue] Skipping getQueue - Redis not available');
    return null;
  }

  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: connectionOptions,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
        },
      },
    });
  }
  return queues[name];
}

export interface CreateWorkerOptions {
  concurrency?: number;
}

export function createWorker(
  name: string,
  processor: (job: { id: string; name: string; data: any }) => Promise<any>,
  options?: CreateWorkerOptions
): Worker | null {
  if (!REDIS_HOST) {
    console.log('[Queue] Skipping createWorker - REDIS_HOST not set');
    return null;
  }

  if (!isAvailable) {
    console.log('[Queue] Skipping createWorker - Redis not available');
    return null;
  }

  if (workers[name]) {
    return workers[name];
  }

  const worker = new Worker(name, async (job) => {
    return processor({
      id: job.id || '',
      name: job.name,
      data: job.data,
    });
  }, {
    connection: connectionOptions,
    concurrency: options?.concurrency || 2,
  });

  worker.on('failed', (job, err) => {
    console.error(`[Queue] Worker ${name} job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job, returnvalue) => {
    console.log(`[Queue] Worker ${name} job ${job.id} completed`);
  });

  worker.on('error', (err) => {
    console.error(`[Queue] Worker ${name} error:`, err.message);
  });

  workers[name] = worker;
  return worker;
}

export function getQueueEvents(name: string): QueueEvents | null {
  if (!REDIS_HOST) {
    return null;
  }

  if (!isAvailable) {
    console.log('[Queue] Skipping getQueueEvents - Redis not available');
    return null;
  }

  if (!queueEvents[name]) {
    queueEvents[name] = new QueueEvents(name, {
      connection: connectionOptions,
    });
  }
  return queueEvents[name];
}

export async function addJob(
  queueName: string,
  jobName: string,
  data: any,
  options?: JobsOptions
): Promise<any> {
  const queue = await getQueueWithCheck(queueName);
  if (!queue) {
    console.log(`[Queue] Skipping addJob ${jobName} - queue not available`);
    return null;
  }

  try {
    return queue.add(jobName, data, options);
  } catch (err) {
    console.warn(`[Queue] Failed to add job ${jobName}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function getQueueWithCheck(name: string): Promise<Queue | null> {
  if (!REDIS_HOST) {
    return null;
  }

  if (!isAvailable) {
    await checkConnection();
  }

  return getQueue(name);
}

export async function registerQueues(strapi: Core.Strapi): Promise<void> {
  if (!REDIS_HOST) {
    console.log('[Queue] Skipping registerQueues - REDIS_HOST not set');
    return;
  }

  await checkConnection();

  if (!isAvailable) {
    console.log('[Queue] Skipping registerQueues - Redis connection failed');
    return;
  }

  (strapi as any).queue = {
    add: addJob,
    getQueue,
    createWorker,
    getQueueEvents,
  };

  console.log('[Queue] Queues registered');
}

export async function closeAllQueues(): Promise<void> {
  for (const [name, worker] of Object.entries(workers)) {
    try {
      await worker.close();
      console.log(`[Queue] Worker ${name} closed`);
    } catch (err) {
      console.warn(`[Queue] Failed to close worker ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  for (const [name, queue] of Object.entries(queues)) {
    try {
      await queue.close();
      console.log(`[Queue] Queue ${name} closed`);
    } catch (err) {
      console.warn(`[Queue] Failed to close queue ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  for (const [name, events] of Object.entries(queueEvents)) {
    try {
      await events.close();
      console.log(`[Queue] QueueEvents ${name} closed`);
    } catch (err) {
      console.warn(`[Queue] Failed to close QueueEvents ${name}:`, err instanceof Error ? err.message : err);
    }
  }
}
