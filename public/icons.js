/**
 * Icon System - Scandinavian Minimalist Icons
 * Using Lucide icons for clean, consistent iconography
 */

// Icon registry mapping semantic names to Lucide icon names
const ICON_REGISTRY = {
  // Status icons
  'robot': 'bot',
  'error': 'x-circle',
  'warning': 'alert-triangle',
  'success': 'check-circle',
  'info': 'info',
  'time': 'clock',
  
  // UI icons  
  'play': 'play',
  'stop': 'square',
  'pause': 'pause',
  'record': 'mic',
  'microphone': 'mic',
  'speaker': 'volume-2',
  'settings': 'settings',
  'dashboard': 'layout-dashboard',
  'viewer': 'eye',
  'session': 'folder',
  'sessions': 'folders',
  'search': 'search',
  'menu': 'menu',
  'close': 'x',
  'check': 'check',
  'plus': 'plus',
  'minus': 'minus',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'external-link': 'external-link',
  'download': 'download',
  'upload': 'upload',
  'copy': 'copy',
  'edit': 'edit-2',
  'trash': 'trash-2',
  'refresh': 'refresh-cw',
  'save': 'save',
  'user': 'user',
  'users': 'users',
  'home': 'home',
  'language': 'globe',
  'transcript': 'file-text',
  'audio': 'headphones',
  'volume': 'volume-2'
};

// Note: Console/logging icons are handled server-side in `icons-console.js`.
// Client code should avoid emoji usage and rely on SVG icons via Lucide.

/**
 * Create an SVG icon element
 * @param {string} name - Icon name from registry
 * @param {Object} options - Configuration options
 * @param {string} options.size - Size class (sm, md, lg) or custom size
 * @param {string} options.variant - Color variant (success, warning, error, info, primary, muted)
 * @param {string} options.className - Additional CSS classes
 * @param {Object} options.attributes - Additional SVG attributes
 * @returns {SVGElement} The icon element
 */
function createIcon(name, options = {}) {
  const { size = '', variant = '', className = '', attributes = {} } = options;
  
  const iconName = ICON_REGISTRY[name] || name;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  
  // Base classes
  let classes = 'icon';
  
  if (size && ['sm', 'md', 'lg'].includes(size)) {
    classes += ` icon--${size}`;
  }
  
  if (variant) {
    classes += ` icon--${variant}`;
  }
  
  if (className) {
    classes += ` ${className}`;
  }
  
  svg.setAttribute('class', classes);
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  
  // Custom size
  if (size && !['sm', 'md', 'lg'].includes(size)) {
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
  }
  
  // Additional attributes
  Object.entries(attributes).forEach(([key, value]) => {
    svg.setAttribute(key, value);
  });
  
  // Load icon from Lucide CDN (lucide-static provides raw SVG files)
  loadLucideIcon(svg, iconName);
  
  return svg;
}

/**
 * Load icon content from Lucide
 * @param {SVGElement} svg - Target SVG element
 * @param {string} iconName - Lucide icon name
 */
async function loadLucideIcon(svg, iconName) {
  try {
    const response = await fetch(`https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg`);
    if (response.ok) {
      const text = await response.text();
      const parser = new DOMParser();
      const iconSvg = parser.parseFromString(text, 'image/svg+xml').documentElement;
      
      // Copy the path elements
      Array.from(iconSvg.children).forEach(child => {
        svg.appendChild(child.cloneNode(true));
      });
    } else {
      console.warn(`Icon '${iconName}' not found, using fallback`);
      createFallbackIcon(svg);
    }
  } catch (error) {
    console.warn(`Failed to load icon '${iconName}':`, error);
    createFallbackIcon(svg);
  }
}

/**
 * Create a simple fallback icon (circle with question mark)
 */
function createFallbackIcon(svg) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  svg.appendChild(circle);
  
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '12');
  text.setAttribute('y', '16');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '14');
  text.setAttribute('fill', 'currentColor');
  text.textContent = '?';
  svg.appendChild(text);
}

/**
 * Get console icon for server-side logging
 * @param {string} name - Icon name
 * @returns {string} Console-appropriate icon
 */
// No client console icon mapping to avoid emoji usage.

/**
 * Replace an element with an icon
 * @param {Element} element - Element to replace
 * @param {string} iconName - Icon name
 * @param {Object} options - Icon options
 */
function replaceWithIcon(element, iconName, options = {}) {
  const icon = createIcon(iconName, options);
  element.parentNode?.replaceChild(icon, element);
  return icon;
}

/**
 * Add an icon before an element's text
 * @param {Element} element - Target element
 * @param {string} iconName - Icon name
 * @param {Object} options - Icon options
 */
function prependIcon(element, iconName, options = {}) {
  const icon = createIcon(iconName, { ...options, className: 'icon--inline' });
  element.insertBefore(icon, element.firstChild);
  return icon;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createIcon,
    replaceWithIcon,
    prependIcon,
    ICON_REGISTRY
  };
}
