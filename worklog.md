# Progress Companion - iOS/Mobile Fitness App

## Overview
A privacy-first, photo-first AI fitness companion designed exclusively for iOS and mobile users. Features native iOS-style UI, gestures, and safe area support.

---

## iOS-Specific Features

### Native iOS UI Elements
- **Tab Bar**: Fixed bottom navigation with iOS-style icons and active states
- **Safe Area Support**: Proper handling of notched devices (iPhone X and later)
- **Pull to Refresh**: Native-style refresh gesture with animated indicator
- **Rounded Corners**: iOS-style corner radius (16-24px)
- **Haptic Feedback**: Visual feedback for touch interactions

### Mobile-First Design
- **Touch Targets**: Minimum 44px tap targets for accessibility
- **Swipe Gestures**: Pull-to-refresh implemented
- **Bottom Sheets**: iOS-style modal sheets with drag handles
- **No Desktop Layout**: Strictly mobile-only viewport
- **Smooth Scrolling**: Native -webkit-overflow-scrolling

### PWA Support
- Web App Manifest for "Add to Home Screen"
- Apple Web App meta tags
- Standalone display mode
- Portrait orientation lock

---

## App Structure

### 5 Main Tabs

1. **Home Tab**
   - Personalized greeting with Progress Aura
   - Quick action buttons (Log Photo, Log Meal)
   - Today's Nutrition Ring
   - Top Insight card with confidence badge
   - Goals progress bars
   - Recent insights feed

2. **Progress Tab**
   - Full-screen photo carousel
   - Thumbnail navigation strip
   - Stats cards (weight, body fat)
   - Morph Memory feature (AI-generated, labeled)

3. **Food Tab**
   - Today's meals timeline
   - Scan button for photo/barcode
   - Food search
   - Food database with confidence badges

4. **Experiments Tab**
   - Active experiments cards
   - Quick-start templates
   - New experiment dialog
   - Adherence tracking

5. **Profile Tab**
   - User info with Progress Aura
   - Coaching style selector
   - Settings toggles
   - Privacy controls

### Floating Action Button
- AI Coach chat interface
- Bottom sheet with conversation
- Private badge indicator

---

## Technical Implementation

### Styling
- Tailwind CSS with iOS-inspired design tokens
- Safe area CSS environment variables
- Dark mode support
- Smooth animations with Framer Motion
- No scrollbar on iOS (hidden)

### Components Used
- ProgressAura (consistency indicator)
- NutritionRing (macro visualization)
- ConfidenceBadge (AI confidence)
- ProvenanceTag (data source)
- InsightCard (AI insights)
- FoodCard (food database)
- ExperimentCard (micro-experiments)

### APIs Available
- /api/analyze-photo - Photo analysis with confidence
- /api/chat - AI coach with coaching tone
- /api/generate-morph - Morph memory images
- /api/insights - Pattern analysis
- /api/signal-composer - Data recommendations

---

## Privacy & Safety

- Private by default
- All AI images labeled "AI Generated"
- Opt-in required for morph/projection
- Export with provenance
- Data deletion controls
- No data leaves device without consent

---

## Accessibility

- Minimum 44px touch targets
- ARIA labels on all interactive elements
- Color contrast compliance
- Dark mode for visual comfort
- Screen reader support

---

## Performance

- Optimized for 60fps on mobile
- Lazy loading for images
- Efficient re-renders with React memo
- Smooth scroll behavior
- Fast initial load
