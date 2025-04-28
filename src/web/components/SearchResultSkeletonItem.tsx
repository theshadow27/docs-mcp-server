/**
 * Renders a skeleton placeholder for a search result item.
 * Used to indicate loading state while search results are being fetched.
 */
const SearchResultSkeletonItem = () => (
  <div class="block px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg shadow-sm mb-2 animate-pulse">
    <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
    <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full mb-2"></div>
    <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
  </div>
);

export default SearchResultSkeletonItem;
