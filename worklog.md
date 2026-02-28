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

---
## Task ID: 1 - Home Page Complete Redesign
### Work Task
Completely redesign the Home Page for "Progress Companion" iOS fitness app with comprehensive iOS mobile experience including Dynamic Header, Hero Signal Section, Interactive Macro Rings, Quick Actions, Timeline, Progress Pulse Bar, and AI Coach Dock.

### Work Summary
Successfully redesigned the entire `/home/z/my-project/src/app/page.tsx` with the following comprehensive iOS-native features:

**1. Dynamic Header (Safe Area Optimized)**
- Current date with elegant typography
- Time-based greeting: "Good morning/afternoon/evening"
- Consistency percentage with trend indicator
- Level badge (Lv.12) with emerald gradient
- Streak flame icon (tap opens streak breakdown sheet)
- Settings icon (SF Symbol style)
- Header background gradient shifts based on trend (warm for positive, neutral glass for stable, cool tones for declining)

**2. Hero Section — "Today's Signal"**
- Large visual card with animated ring decorations
- AI insight displayed prominently
- Confidence badge (76%)
- Data source indicators (12 logs + 3 weight entries)
- "Why?" button opens explanation sheet
- Single action CTA button ("Log Lunch")

**3. Daily Macro Progress Rings (Interactive)**
- 4 circular rings: Calories (amber), Protein (rose), Carbs (blue), Fat (purple)
- Tap ring → opens comparison sheet vs yesterday
- Long press → shows 7-day average
- Rings pulse when near goal completion (80%+)
- Visual celebration when protein goal is met

**4. Quick Actions Row (Floating Tiles)**
- Horizontally scrollable premium cards
- Glass blur effect with shadow depth
- Actions: AI Scan Food, Search Foods, Log Workout, Log Weight, Start Test
- Each with unique gradient and icon color

**5. Today's Timeline (Scrollable Feed)**
- Chronological feed with icons, time, and descriptions
- Macro preview for meals
- Edit button on each entry
- Empty state with "Add First Meal" CTA

**6. Progress Pulse Bar**
- Animated horizontal strip showing consistency %
- Trend arrow indicator
- Tiny heatmap dots for past 7 days
- Tap opens analytics sheet

**7. AI Coach Dock (Bottom Floating Button)**
- Circular floating gradient button (emerald to teal)
- Subtle glow animation when AI has insight
- Message preview bubble: "I noticed something about your weekend calories."
- Tap opens half-screen chat sheet

**Sheet Interactions Implemented:**
- Streak Breakdown Sheet: Shows current/best streak, weekly dots, motivation tip
- Macro Comparison Sheet: Today vs Yesterday or 7-Day Average with bar chart
- Why Sheet: Explains insight with data sources and calculation methodology
- Analytics Sheet: Weekly analytics with heatmap and highlights
- AI Chat Sheet: Full chat interface with confidence badges

**Technical Implementation:**
- All shadcn/ui components utilized (Card, Button, Badge, Sheet, Progress, ScrollArea)
- Existing fitness components integrated (ConfidenceBadge, ProvenanceTag)
- Framer Motion animations throughout
- Dark mode fully supported
- iOS safe areas properly handled
- Pull-to-refresh gesture implemented
- Custom scrollbar styling for desktop
- All touch targets meet 44px minimum

---
## Task ID: 2 - Onboarding Flow Implementation
### Work Task
Create a comprehensive Onboarding Flow for "Progress Companion" iOS fitness app with 6 primary screens, privacy consent modal, post-onboarding immediate tasks, and iOS-style animations.

### Work Summary
Successfully created the complete onboarding flow component at `/home/z/my-project/src/components/fitness/onboarding-flow.tsx` with the following features:

**Screen 0 — Welcome**
- Animated logo with pulsing ring decoration
- Purpose line: "Progress Companion — show what changed, why, and next step."
- Privacy-first microcopy: "Privacy-first. Data stays private unless you share."
- Primary CTA: "Get started"

**Screen 1 — Core Identity**
- Display name (optional) with user icon
- Birth year with validation (13-120 years)
- Sex at birth selector (male/female/other, optional)
- Height input in cm with validation (100-250cm range)
- Microcopy: "Height used for body-composition estimates."
- Skip functionality with missing field tracking

**Screen 2 — Primary Goal & Phase**
- Goal options: Fat Loss, Recomposition, Muscle Gain, Performance, Maintenance
- Each goal has unique icon, description, and gradient
- Target weight slider (1-20 kg range)
- Sensitivity selector: Conservative/Moderate/Aggressive
- Dynamic microcopy showing selected goal details

**Screen 3 — Baseline & First Data**
- Side-by-side weight log and progress photo upload
- Weight input with validation (30-300kg)
- Photo upload helper text: "Stand 1.5m back, minimal bulky clothing. Front pose."
- Provenance UI for recorded values
- Warning when both skipped: "Add a weight or photo to activate full insights."

**Screen 4 — Food & Preference Seeds**
- Multi-select cuisines (Mediterranean, Asian, American, Mexican, Indian, Middle Eastern)
- Dietary tags selection (Vegetarian, Vegan, Keto, Low Carb, High Protein, Paleo)
- Allergy options (Gluten, Dairy, Nuts, Soy, Eggs, Shellfish)
- Common staples selection
- "Add local favorites later" toggle (default ON)

**Screen 5 — Behavior & Integration Preferences**
- Toggle: Enable meal camera scanner (default ON)
- Toggle: Connect wearable (optional)
- Toggle: Enable weekly photo reminders (default ON)
- Coaching tone selector with preview: Strict, Analytical, Supportive, Minimal
- Live preview card showing example message for selected tone

**Privacy & Generated Content Consent Modal**
- Explicit consent lines for generated images
- Label and export exclusion notice
- Two buttons: "I agree" / "Not now" (Not now disables morph features)
- Provenance microcopy about changing settings later

**Post-Onboarding Immediate Tasks**
- Prompt: "Do one now: upload a photo or log a meal."
- Both action buttons presented side-by-side
- Skip option available
- First action tracked in onboarding data

**iOS Design Features Implemented**
- Full-screen modal presentation with swipe gestures
- Page indicator dots at bottom (interactive, clickable)
- Smooth slide transitions using Framer Motion AnimatePresence
- Glass blur effects on navigation elements
- Dark mode support throughout
- Safe area handling for notched devices
- Swipe navigation between screens
- Back button navigation on all screens except first

**Technical Implementation**
- TypeScript strict typing for all data structures
- localStorage persistence for onboarding state
- Callbacks for onComplete and onSkip
- All inputs skippable with missing field tracking in provenance
- Integration with existing page.tsx using conditional rendering
- Uses existing shadcn/ui components: Button, Input, Card, Dialog, Switch, Label, Badge, Slider
- Integrates existing fitness components: ProvenanceTag, ConfidenceBadge
- React.useRef pattern for avoiding cascading renders in useEffect
