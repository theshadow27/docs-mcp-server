import { unified } from "unified"; // Import unified
import remarkParse from "remark-parse"; // Import unified plugins
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import type { StoreSearchResult } from "../../store/types";

/**
 * Props for the SearchResultItem component.
 */
interface SearchResultItemProps {
  result: StoreSearchResult;
}

/**
 * Renders a single search result item.
 * Converts markdown content to HTML using unified.
 * @param props - Component props including the search result data.
 */
const SearchResultItem = async ({ result }: SearchResultItemProps) => {
  // Use unified pipeline to convert markdown to HTML
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkHtml);
  const file = await processor.process(result.content);
  const rawHtml = String(file);
  // NOTE: DOMPurify sanitization removed by user

  return (
    <div class="block px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 mb-2">
      <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline"
          safe
        >
          {result.url}
        </a>
      </div>
      {/* Render the raw HTML content */}
      <div class="prose dark:prose-invert max-w-none">{rawHtml as "safe"}</div>
    </div>
  );
};

export default SearchResultItem;
