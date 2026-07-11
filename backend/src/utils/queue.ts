import { Queue, Worker, QueueEvents, type JobsOptions } from 'bullmq';
import type { Core } from '@strapi/strapi';

const queues: Record<string, Queue> = {};
const workers: Record<string, Worker> = {};
const queueEvents: Record<string, QueueEvents> = {};

const connectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

export function getQueue(name: string): Queue {
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
): Worker {
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

export function getQueueEvents(name: string): QueueEvents {
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
  const queue = getQueue(queueName);
  return queue.add(jobName, data, options);
}

export async function registerQueues(strapi: Core.Strapi): Promise<void> {
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
