/**
 * Console Icon System - Server-side clean text icons
 * Replaces emojis with clean, minimal text representations
 * Aligns with Scandinavian minimalist design principles
 */

// Clean text-based icons for console output
const CONSOLE_ICONS = {
  // Status indicators
  robot: '[AI]',
  error: '[ERROR]',
  warning: '[WARN]',
  success: '[OK]',
  info: '[INFO]',
  time: '[TIME]',
  
  // Server status
  server: '[SERVER]',
  database: '[DB]',
  viewer: '[VIEW]',
  
  // Network
  globe: '[WEB]',
  
  // Data
  chart: '[DATA]'
};

// Color codes for terminal output (optional, clean fallback)
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

/**
 * Get a clean console icon
 * @param {string} name - Icon name
 * @param {boolean} colored - Whether to include color codes
 * @returns {string} Console-appropriate icon
 */
function getIcon(name, colored = false) {
  const icon = CONSOLE_ICONS[name] || '[•]';
  
  if (!colored) {
    return icon;
  }
  
  // Add color for better visibility (optional)
  switch (name) {
    case 'error':
      return `${COLORS.red}${icon}${COLORS.reset}`;
    case 'warning':
      return `${COLORS.yellow}${icon}${COLORS.reset}`;
    case 'success':
      return `${COLORS.green}${icon}${COLORS.reset}`;
    case 'info':
    case 'robot':
      return `${COLORS.cyan}${icon}${COLORS.reset}`;
    case 'server':
    case 'database':
      return `${COLORS.blue}${icon}${COLORS.reset}`;
    default:
      return `${COLORS.gray}${icon}${COLORS.reset}`;
  }
}

/**
 * Create a formatted console message with icon
 * @param {string} iconName - Icon name
 * @param {string} message - Message text
 * @param {boolean} colored - Whether to use colors
 * @returns {string} Formatted message
 */
function formatMessage(iconName, message, colored = false) {
  const icon = getIcon(iconName, colored);
  return `${icon} ${message}`;
}

// Export for use in server
export { getIcon, formatMessage, CONSOLE_ICONS };