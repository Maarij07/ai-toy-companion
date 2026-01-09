# GlueStack UI Implementation Guide

## Overview
This guide documents the implementation of GlueStack UI in the AI Toy Companion app, including custom theming, component usage, and solutions to common issues encountered during development.

## 1. Theme Configuration

### Custom Theme Setup
The application uses a custom GlueStack UI theme that integrates colors from the project's `colors.json` file. The theme is configured in `src/config/theme.ts`.

#### Color Mapping Strategy
Colors from `colors.json` are mapped to GlueStack's token system:
- Primary colors: `$primary500`, `$primary600`, etc.
- Secondary colors: `$secondary500`, `$secondary600`, etc.
- Background colors: `$backgroundLight0`, `$backgroundLight50`, etc.
- Text colors: `$textDark800`, `$textLight50`, etc.
- Semantic colors: `$error500`, `$warning500`, `$success500`, etc.

#### Border Colors
Custom border color mappings were added to ensure proper contrast:
- `$borderLight300` and other border shades mapped to appropriate grayscale values

### Component Default Properties
The theme defines default properties for common components:
- **Buttons**: Default height (`h="$12"`) and padding (`py="$5"`)
- **Inputs**: Default padding (`py="$3"`) and background styling
- **Text styling**: Consistent font weights and line heights

## 2. Login Screen Implementation

### Component Structure
The `GlueStackLoginScreen.tsx` implements a comprehensive login form with:
- Email and password inputs with validation
- Sign In button with loading state
- Social login options (Google, Apple)
- Error handling and display
- Password visibility toggle

### UI Consistency
All interactive elements maintain consistent sizing:
- Buttons: `h="$12"` for uniform height
- Input fields: `h="$12"` to match button height
- Proper padding and margin spacing

## 3. Button Text Truncation Issue and Resolution

### The Problem
Initially, button text was being vertically clipped, with only the top portion of text visible (sometimes as little as 5-20% of the full text). This occurred due to how GlueStack UI renders text within buttons and the relationship between button dimensions, padding, and text styling.

### Root Causes Identified
1. **Insufficient vertical padding**: Buttons had inadequate padding to accommodate text properly
2. **Line height issues**: Text line height was not optimized for the button container
3. **Padding misconfiguration**: Incorrect padding values were pushing text outside the visible area

### Resolution Strategy
The issue was resolved through a systematic approach:

#### Phase 1: Padding Adjustment
- Initially increased padding to `py="$7"` which improved visibility to ~80%
- Later reduced to `py="$3"` to prevent text from being pushed out of view
- Found optimal padding that maintains button height while ensuring text visibility

#### Phase 2: Text Styling Enhancement
- Added `fontSize: '$lg'` to button text styles
- Implemented `lineHeight: '$md'` to ensure proper vertical spacing
- Added `textAlignVertical: 'center'` and `alignSelf: 'center'` for proper alignment
- Set `overflow: 'visible'` to prevent clipping

#### Phase 3: Dimensional Consistency
- Maintained `h="$12"` for consistent button height across all buttons
- Ensured input fields also use `h="$12"` for UI consistency
- Applied uniform padding strategies across all interactive elements

### Final Solution
The combination of appropriate padding (`py="$3"`), enhanced text styling, and proper dimensional consistency resolved the text truncation issue completely.

## 4. Input Field Improvements

### Height Standardization
- Input fields were updated to `h="$12"` to match button heights
- Vertical padding set to `py="$3"` for consistency
- Background color set to `$backgroundLight0` for proper contrast

### Text and Icon Visibility
- Input text color set to `$textDark800` for readability
- Placeholder text color set to `$textDark500` for subtle guidance
- Input icons (Mail, Lock) colored `$textDark800` to ensure visibility against backgrounds

### Password Visibility Toggle
- Implemented eye icon toggle using `showPassword` state
- Icons change between `Eye` (visible) and `EyeOff` (hidden) states
- Positioned consistently in the right input slot

## 5. Error Handling System

### Firebase Error Service
A dedicated service `src/services/FirebaseErrorService.ts` was created to handle Firebase authentication errors:

#### Features
- Comprehensive error code mappings for human-readable messages
- Support for both authentication and social provider errors
- Intelligent error detection for malformed error objects
- Extensible architecture for future error types

#### Error Message Processing
The service intelligently processes various error formats:
- Direct error codes from Firebase
- Error messages containing embedded codes
- Pattern-based message interpretation
- Fallback mechanisms for unrecognized errors

### Error Display Implementation
- Error messages appear in a dedicated box above the sign-in button
- Uses light error colors (`$error100` background, `$error500` border, `$error700` text) for minimal design
- Matches button dimensions (`h="$12"`) for visual consistency
- Automatically clears when new login attempts are made

## 6. Social Login Integration

### Google Sign-In
- Implemented with proper error handling using the Firebase error service
- Loading states and user feedback during authentication
- Proper credential handling and Firestore user creation/update

### Apple Sign-In
- Available conditionally on iOS platforms
- Consistent styling with other social login options
- Same error handling and user feedback mechanisms

## 7. Best Practices Applied

### Component Consistency
- All interactive elements maintain consistent dimensions
- Proper spacing and alignment throughout the form
- Visual hierarchy maintained with appropriate contrast

### Accessibility
- Adequate touch targets for mobile interaction
- Sufficient color contrast for readability
- Clear visual feedback for interactions

### Performance
- Efficient state management
- Proper cleanup of event listeners
- Optimized component rendering

## 8. Common Issues and Solutions

### Text Clipping
As documented in Section 3, this was resolved through careful padding and text styling adjustments.

### Color Consistency
Theme configuration ensures all elements use the project's brand colors consistently.

### Error Handling
Centralized error service prevents duplication and ensures consistent user messaging across authentication flows.

This guide serves as a reference for maintaining and extending the GlueStack UI implementation in the AI Toy Companion app.