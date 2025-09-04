# Icon System Documentation

This document describes the Scandinavian minimalist icon system implemented for the Sidekick project, replacing emoji usage throughout the application.

## Design Principles

The icon system follows the **Scandinavian Minimalism** design guide:

- **Line icons only** - Using Lucide icons with 1.5px stroke weight
- **Clean and minimal** - No filled icons, maintaining visual consistency
- **Semantic naming** - Icons are referenced by function, not appearance
- **Color consistency** - Following the established color tokens
- **No emoji usage** - Replaced all emoji with appropriate icons

## Implementation

### Client-Side Icons (Browser)

**Files:**
- `/public/styles/icons.css` - Icon styling and size classes
- `/public/icons.js` - Icon utility functions and registry

**Usage:**
```javascript
// Create an icon element
const playIcon = createIcon('play', { 
  size: 'md', 
  variant: 'primary', 
  className: 'custom-class' 
});

// Add to DOM
document.getElementById('button').appendChild(playIcon);

// Replace element with icon
replaceWithIcon(element, 'microphone', { size: 'sm' });

// Prepend icon to element
prependIcon(element, 'settings');
```

**Available sizes:**
- `sm` - 14×14px
- Default - 16×16px  
- `md` - 20×20px
- `lg` - 24×24px
- Custom size: `{ size: '32px' }`

**Color variants:**
- `success` - Sage green (#6BAA75)
- `warning` - Sand/clay (#D9A982) 
- `error` - Red (#e74c3c)
- `info` - Nordic blue (#A3B6D3)
- `primary` - Near-black (#1A1A1A)
- `muted` - Light gray (#7A7A7A)

### Server-Side Icons (Console)

**Files:**
- `/icons-console.js` - Clean text-based icons for server logs

**Usage:**
```javascript
import { getIcon, formatMessage } from "./icons-console.js";

// Simple icon
console.log(getIcon('robot')); // [AI]

// Formatted message
console.error(formatMessage('error', 'Something went wrong'));
// Output: [ERROR] Something went wrong
```

## Icon Registry

### Status Icons
- `robot` - AI/bot indicator
- `error` - Error states
- `warning` - Warning states  
- `success` - Success states
- `info` - Information
- `time` - Time/duration

### UI Icons
- `play`, `stop`, `pause` - Media controls
- `microphone`, `speaker` - Audio
- `settings` - Settings/configuration
- `dashboard` - Dashboard view
- `viewer` - Viewer page
- `session`, `sessions` - Session management
- `search` - Search functionality
- `menu`, `close` - Navigation
- `check`, `plus`, `minus` - Actions
- `chevron-*` - Navigation arrows
- `edit`, `trash`, `save` - File operations

### Content Icons
- `transcript` - Text/transcript content
- `audio` - Audio content
- `language` - Language selection
- `user`, `users` - User management
- `home` - Home/main page

## Browser Integration

Icons are automatically loaded from Lucide CDN. The system includes:

- **Fallback handling** - Shows question mark icon if loading fails
- **Semantic naming** - Use descriptive names, not icon appearance
- **Accessibility** - Proper ARIA attributes and screen reader support
- **Performance** - Cached SVG loading with minimal bundle size

## Migration from Emojis

### Before (Emoji):
```javascript
console.log("🤖 AI Model ready");
element.innerHTML = "🎯 Target achieved";
```

### After (Icons):
```javascript
// Server-side
console.log(formatMessage('robot', 'AI Model ready'));

// Client-side  
const icon = createIcon('success');
element.appendChild(icon);
element.appendChild(document.createTextNode(' Target achieved'));
```

## Maintenance

### Adding New Icons

1. **Client-side**: Add to `ICON_REGISTRY` in `/public/icons.js`
2. **Server-side**: Add to `CONSOLE_ICONS` in `/icons-console.js`
3. **Ensure semantic naming** - Use function-based names
4. **Update documentation** - Add to this file's registry section

### Design Consistency

- Always use Lucide icons for consistency
- Maintain 1.5px stroke weight
- Follow established color variants
- Test icons across different backgrounds
- Ensure proper contrast ratios

## Examples

### Button with Icon
```html
<button class="button button--primary" onclick="handlePlay()">
  <!-- Icon will be inserted by JavaScript -->
  <span class="button-text">Play</span>
</button>

<script>
const button = document.querySelector('button');
const icon = createIcon('play', { size: 'sm' });
button.insertBefore(icon, button.firstChild);
</script>
```

### Status Indicator
```javascript
function updateStatus(status) {
  const statusEl = document.getElementById('status');
  const iconName = status === 'recording' ? 'microphone' : 
                   status === 'error' ? 'error' : 'success';
  
  statusEl.innerHTML = '';
  statusEl.appendChild(createIcon(iconName, { 
    variant: status === 'error' ? 'error' : 'success' 
  }));
  statusEl.appendChild(document.createTextNode(` ${status}`));
}
```

This icon system maintains the clean, minimal aesthetic while providing consistent, accessible iconography throughout the application.