import type { Core } from '@strapi/strapi';

let strapiInstance: Core.Strapi | null = null;

export function setStrapi(strapi: Core.Strapi): void {
  strapiInstance = strapi;
}

export async function processFaqFeedback(job: { id: string; name: string; data: any }): Promise<{ success: boolean; message: string }> {
  const { feedbackId, action } = job.data;

  console.log(`[FaqFeedback] Processing feedback ${feedbackId}, action: ${action}`);

  if (!strapiInstance) {
    throw new Error('Strapi instance not initialized');
  }

  try {
    switch (action) {
      case 'generate-faq':
        await handleGenerateFaq(job.data);
        break;
      case 'analyze-feedback':
        await handleAnalyzeFeedback(job.data);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return {
      success: true,
      message: `Feedback ${feedbackId} processed successfully (${action})`,
    };
  } catch (err) {
    console.error(`[FaqFeedback] Failed to process feedback ${feedbackId}:`, err instanceof Error ? err.message : err);
    throw err;
  }
}

async function handleGenerateFaq(data: any): Promise<void> {
  const { knowledgeBaseId, question, answer } = data;

  console.log(`[FaqFeedback] Generating FAQ from knowledge base ${knowledgeBaseId}`);

  await new Promise(resolve => setTimeout(resolve, 1000));

  const faqService = strapiInstance!.service('api::faq-item.faq-item');

  const existingFaq = await faqService.find({
    filters: {
      question: {
        $containsi: question,
      },
    },
  });

  if (existingFaq.results && existingFaq.results.length === 0) {
    await faqService.create({
      data: {
        question,
        answer,
        knowledgeBase: knowledgeBaseId ? [knowledgeBaseId] : [],
        isActive: true,
      },
    });
    console.log('[FaqFeedback] FAQ created successfully');
  } else {
    console.log('[FaqFeedback] FAQ already exists, skipping');
  }
}

async function handleAnalyzeFeedback(data: any): Promise<void> {
  const { feedbackId, rating, comment } = data;

  console.log(`[FaqFeedback] Analyzing feedback ${feedbackId}, rating: ${rating}`);

  await new Promise(resolve => setTimeout(resolve, 800));

  const faqService = strapiInstance!.service('api::faq-item.faq-item');

  if (rating < 3 && comment) {
    console.log(`[FaqFeedback] Low rating detected, flagging for review: ${comment}`);

    const relatedFaq = await faqService.findOne(feedbackId);
    if (relatedFaq) {
      await faqService.update(feedbackId, {
        data: {
          needsReview: true,
        },
      });
    }
  }

  console.log('[FaqFeedback] Feedback analysis completed');
}
