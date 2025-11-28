# Frontend Architecture Documentation

## Overview
The frontend is built with React 18, TypeScript, and modern web technologies to provide a responsive, accessible, and performant user experience. It follows a component-based architecture with lazy loading, theming support, and Progressive Web App (PWA) capabilities.

## Technology Stack

### Core Framework
- **React 18**: Latest React with concurrent features
- **TypeScript**: Full type safety throughout the application
- **Vite**: Lightning-fast build tool and dev server
- **Wouter**: Lightweight routing library
- **TanStack Query**: Powerful data fetching and state management

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality component library based on Radix UI
- **Radix UI**: Primitive components for accessibility
- **Framer Motion**: Animation and gesture library
- **Lucide React**: Modern icon library
- **Next Themes**: Theme management system

### State Management
- **TanStack Query**: Server state management
- **React Context**: Global state for authentication and theme
- **Local Storage**: Persistent user preferences
- **Session Storage**: Temporary state

## Project Structure

### Directory Organization
```
client/src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI components (shadcn/ui)
│   ├── shared/          # Shared business components
│   ├── onboarding/      # Onboarding flow components
│   └── profile/         # Profile-specific components
├── pages/               # Route components (lazy-loaded)
│   ├── admin/           # Super Admin pages
│   ├── client-portal/   # Client portal pages
│   └── *.tsx           # Individual page components
├── lib/                 # Utilities and configurations
├── hooks/               # Custom React hooks
├── data/                # Static data and constants
└── styles/              # Global styles and CSS
```

### Component Architecture
```
App.tsx                  # Root application component
├── Router()             # Route configuration with lazy loading
├── AppLayout()          # Main layout wrapper
│   ├── SidebarProvider # Sidebar context
│   ├── AppSidebar      # Navigation sidebar
│   ├── Header          # Top navigation bar
│   └── Main Content    # Route-specific content
└── Providers           # Context providers (Theme, Auth, Query)
```

## Key Features

### 1. Lazy Loading & Code Splitting
```typescript
// All pages are lazy-loaded for optimal performance
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Settings = lazy(() => import("@/pages/settings"));

// Suspense wrapper with loading indicator
<Suspense fallback={<PageLoader />}>
  <Switch>
    <Route path="/dashboard" component={Dashboard} />
  </Switch>
</Suspense>
```

### 2. Role-Based Access Control (RBAC)
```typescript
// Route protection with role guards
<RoleGuard allowedRoles={["Super Admin", "Admin"]}>
  <AdminDashboard />
</RoleGuard>

// Organization-level access control
<OrganizationRoute>
  <Dashboard />
</OrganizationRoute>
```

### 3. Multi-Tenant Architecture
- **Organization Context**: Automatic tenant isolation
- **Workspace Switching**: Dynamic organization switching
- **Data Separation**: API requests include organization context

### 4. Responsive Design
- **Mobile-First**: Tailwind CSS responsive utilities
- **Adaptive Layouts**: Different layouts for mobile/desktop
- **Touch-Friendly**: Mobile-optimized interactions
- **Bottom Navigation**: Mobile navigation bar

### 5. Progressive Web App (PWA)
- **Service Worker**: Offline caching and background sync
- **Install Prompts**: Native app installation
- **Push Notifications**: Real-time updates
- **Offline Support**: Basic functionality without internet

### 6. Theme System
```typescript
// Dark/light mode support
<ThemeProvider defaultTheme="system" storageKey="accute-theme">
  <ThemeToggle /> // User can switch themes
</ThemeProvider>

// Automatic system theme detection
// Persistent theme preferences
```

### 7. Real-Time Features
- **WebSocket Integration**: Live chat and notifications
- **Server-Sent Events**: Real-time updates
- **Optimistic Updates**: Immediate UI feedback
- **Background Sync**: Offline action queuing

## Component Categories

### 1. Layout Components
- **AppSidebar**: Main navigation with collapsible menu
- **MobileBottomNav**: Bottom navigation for mobile devices
- **AppLayout**: Main layout wrapper with header and sidebar
- **ProtectedRoute**: Authentication guard wrapper

### 2. UI Components (shadcn/ui)
- **Button, Input, Dialog**: Basic form controls
- **Table, Card, Badge**: Data display components
- **Dropdown, Select, Tooltip**: Interactive elements
- **Accordion, Tabs, Sheet**: Layout components

### 3. Business Components
- **LucaChatWidget**: AI agent chat interface
- **DataTable**: Advanced data grid with sorting/filtering
- **FormRenderer**: Dynamic form generation
- **NotificationBell**: Real-time notification system

### 4. Feature-Specific Components
- **WorkflowCanvas**: Visual workflow builder
- **KanbanBoard**: Drag-and-drop task management
- **CalendarView**: Event scheduling interface
- **DocumentViewer**: File preview and annotation

## State Management Patterns

### 1. Server State (TanStack Query)
```typescript
// Data fetching with caching
const { data: users, isLoading } = useQuery({
  queryKey: ["/api/users"],
  queryFn: () => apiRequest("GET", "/api/users"),
});

// Mutations with optimistic updates
const updateUserMutation = useMutation({
  mutationFn: (userData) => apiRequest("PUT", `/api/users/${id}`, userData),
  onSuccess: () => queryClient.invalidateQueries(["/api/users"]),
});
```

### 2. Global State (React Context)
```typescript
// Authentication context
const { user, login, logout } = useAuth();

// Theme context
const { theme, setTheme } = useTheme();

// Organization context
const { currentOrg, switchOrg } = useOrganization();
```

### 3. Local State (React Hooks)
```typescript
// Form state management
const [formData, setFormData] = useState(initialData);

// UI state
const [isDialogOpen, setIsDialogOpen] = useState(false);

// Custom hooks for reusable logic
const { isMobile } = useMobileDetect();
const { toast } = useToast();
```

## Security Implementation

### 1. Authentication
- **JWT Tokens**: Secure token-based authentication
- **Automatic Refresh**: Token renewal before expiration
- **Route Guards**: Protected route access control
- **Session Management**: Secure logout and cleanup

### 2. Authorization
- **Role-Based Access**: Component-level permission checks
- **Organization Isolation**: Multi-tenant data separation
- **Feature Gates**: Subscription-based feature access
- **API Security**: Authenticated requests with CSRF protection

### 3. Input Validation
- **Zod Schemas**: Type-safe form validation
- **Sanitization**: XSS prevention for user inputs
- **File Uploads**: MIME type and size validation
- **SQL Injection**: Parameterized queries via ORM

## Performance Optimization

### 1. Code Splitting
```typescript
// Route-based splitting
const Dashboard = lazy(() => import("@/pages/dashboard"));

// Component-based splitting for large features
const WorkflowBuilder = lazy(() => import("@/components/workflow-builder"));
```

### 2. Caching Strategies
- **Query Caching**: TanStack Query automatic caching
- **Static Assets**: Long-term browser caching
- **CDN Integration**: Asset delivery optimization
- **Service Worker**: Offline resource caching

### 3. Bundle Optimization
- **Tree Shaking**: Unused code elimination
- **Dynamic Imports**: Load-on-demand for heavy features
- **Asset Optimization**: Image compression and WebP support
- **Vendor Splitting**: Separate chunks for third-party libraries

### 4. Rendering Optimization
```typescript
// Memoization for expensive calculations
const expensiveValue = useMemo(() => calculateValue(data), [data]);

// Callback memoization to prevent re-renders
const handleClick = useCallback(() => onClick(id), [onClick, id]);

// Virtual scrolling for large lists
<VirtualizedTable data={largeDataset} />
```

## Accessibility Features

### 1. WCAG Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: ARIA labels and descriptions
- **Color Contrast**: AA/AAA contrast ratios
- **Focus Management**: Proper focus handling

### 2. Semantic HTML
- **Proper Headings**: H1-H6 hierarchy
- **Form Labels**: Associated labels for inputs
- **Button Roles**: Semantic button elements
- **Landmark Regions**: Navigation and content areas

### 3. Interactive Elements
- **Focus Indicators**: Visible focus states
- **Error Messages**: Clear error descriptions
- **Loading States**: Progress indicators
- **Confirmation Dialogs**: Destructive action warnings

## Testing Strategy

### 1. Component Testing
```typescript
// Jest + React Testing Library
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('renders dashboard correctly', () => {
  render(<Dashboard />);
  expect(screen.getByText('Welcome')).toBeInTheDocument();
});
```

### 2. Integration Testing
- **API Integration**: Mock API responses for testing
- **Route Testing**: Navigation and protected routes
- **Form Flows**: End-to-end form submission
- **Authentication Flows**: Login/logout scenarios

### 3. E2E Testing (Playwright)
- **Critical Paths**: User authentication and key workflows
- **Cross-Browser**: Chrome, Firefox, Safari testing
- **Mobile Testing**: Responsive design validation
- **Performance Testing**: Core Web Vitals monitoring

## Build and Deployment

### 1. Development Build
```bash
npm run dev          # Vite dev server with HMR
npm run check        # TypeScript type checking
npm run test         # Jest unit tests
```

### 2. Production Build
```bash
npm run build        # Optimized production build
├── dist/public/     # Static assets
│   ├── index.html   # Entry point
│   ├── assets/      # JS/CSS bundles
│   └── service-worker.js # PWA service worker
```

### 3. Deployment Strategy
- **Static Hosting**: CDN deployment for assets
- **Progressive Enhancement**: Core functionality without JavaScript
- **HTTP/2 Push**: Critical resource preloading
- **Gzip/Brotli**: Asset compression

## Mobile Experience

### 1. Responsive Design
```css
/* Tailwind responsive utilities */
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Mobile: 1 column, Desktop: 3 columns */}
</div>
```

### 2. Touch Interactions
- **Touch Targets**: Minimum 44px touch areas
- **Swipe Gestures**: Navigation and actions
- **Pull-to-Refresh**: Data refresh gesture
- **Haptic Feedback**: Native-like interactions

### 3. Mobile-Specific Features
- **Bottom Navigation**: Thumb-friendly navigation
- **Bottom Sheets**: Modal alternatives for mobile
- **Safe Areas**: Notch and gesture area handling
- **Device API**: Camera, geolocation integration

## Future Enhancements

### 1. Performance Improvements
- **React 18 Features**: Concurrent rendering and suspense
- **Streaming SSR**: Server-side rendering optimization
- **Edge Caching**: CDN-level caching strategies
- **WebAssembly**: Performance-critical calculations

### 2. User Experience
- **Advanced Animations**: Micro-interactions and transitions
- **Voice Interface**: Speech-to-text integration
- **AR/VR Support**: Immersive data visualization
- **AI-Powered UX**: Personalized interface adaptation

### 3. Developer Experience
- **Component Storybook**: Component documentation
- **Visual Regression Testing**: UI change detection
- **Bundle Analyzer**: Performance monitoring
- **Hot Module Replacement**: Faster development cycles

This frontend architecture provides a robust, scalable foundation for enterprise-grade applications while maintaining excellent developer experience and user performance.