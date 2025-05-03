import ScrapeFormContent from "./ScrapeFormContent"; // Adjusted import path

/**
 * Wrapper component for the ScrapeFormContent.
 * Provides a container div, often used as a target for HTMX OOB swaps.
 */
const ScrapeForm = () => (
  <div id="scrape-form-container">
    <ScrapeFormContent />
  </div>
);

export default ScrapeForm;
