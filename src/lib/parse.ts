/**
 * HTML parsing and content extraction using Defuddle
 */

import { Defuddle } from "defuddle/node";

export interface ExtractResult {
  content: string;
  title?: string;
  author?: string;
  published?: string;
  description?: string;
  wordCount: number;
  parseTimeMs: number;
}

/**
 * Extract main content from HTML using Defuddle
 */
export async function extractContent(
  html: string,
  url: string
): Promise<ExtractResult | null> {
  const startTime = Date.now();

  try {
    const result = await Defuddle(html, url, {
      markdown: true,
    });

    if (!result || !result.content) {
      return null;
    }

    return {
      content: result.content,
      title: result.title,
      author: result.author,
      published: result.published,
      description: result.description,
      wordCount: result.wordCount || countWords(result.content),
      parseTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    // Defuddle failed, return null
    return null;
  }
}

/**
 * Count words in text (rough estimate)
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}
