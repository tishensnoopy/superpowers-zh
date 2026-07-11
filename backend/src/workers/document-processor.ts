import type { Core } from '@strapi/strapi';

let strapiInstance: Core.Strapi | null = null;

export function setStrapi(strapi: Core.Strapi): void {
  strapiInstance = strapi;
}

export async function processDocument(job: { id: string; name: string; data: any }): Promise<{ success: boolean; message: string }> {
  const { documentId, action } = job.data;

  console.log(`[DocumentProcessor] Processing document ${documentId}, action: ${action}`);

  if (!strapiInstance) {
    throw new Error('Strapi instance not initialized');
  }

  try {
    const knowledgeBaseService = strapiInstance.service('api::knowledge-base.knowledge-base');

    const document = await knowledgeBaseService.findOne(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    switch (action) {
      case 'vectorize':
        await handleVectorize(document, documentId);
        break;
      case 'summarize':
        await handleSummarize(document, documentId);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return {
      success: true,
      message: `Document ${documentId} processed successfully (${action})`,
    };
  } catch (err) {
    console.error(`[DocumentProcessor] Failed to process document ${documentId}:`, err instanceof Error ? err.message : err);
    throw err;
  }
}

async function handleVectorize(document: any, documentId: number): Promise<void> {
  console.log(`[DocumentProcessor] Vectorizing document ${documentId}`);

  await strapiInstance!.service('api::knowledge-base.knowledge-base').update(documentId, {
    data: {
      status: 'processing',
    },
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  const vectorDbIds = [{ collection: 'knowledge-base', id: `doc_${documentId}` }];

  await strapiInstance!.service('api::knowledge-base.knowledge-base').update(documentId, {
    data: {
      status: 'ready',
      vectorDbIds,
    },
  });

  console.log(`[DocumentProcessor] Vectorization completed for document ${documentId}`);
}

async function handleSummarize(document: any, documentId: number): Promise<void> {
  console.log(`[DocumentProcessor] Summarizing document ${documentId}`);

  await strapiInstance!.service('api::knowledge-base.knowledge-base').update(documentId, {
    data: {
      status: 'processing',
    },
  });

  await new Promise(resolve => setTimeout(resolve, 1500));

  const summary = `Summary generated for document: ${document.title}`;

  await strapiInstance!.service('api::knowledge-base.knowledge-base').update(documentId, {
    data: {
      status: 'ready',
      summary,
    },
  });

  console.log(`[DocumentProcessor] Summarization completed for document ${documentId}`);
}
