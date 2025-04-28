// Import the main CSS file which includes Tailwind and Flowbite styles
import "./styles/main.css";

// Import Flowbite JavaScript and initialization function
import { initFlowbite } from "flowbite";

// Initialize Flowbite components
initFlowbite();

// Import HTMX to make it globally available
import "htmx.org";

// Import and start AlpineJS
import Alpine from "alpinejs";
Alpine.start();
