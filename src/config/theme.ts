import { createConfig } from '@gluestack-ui/themed';
import { config as defaultConfig } from '@gluestack-ui/config';

// Import colors from your colors.json
const colors = {
  primary: '#6D8B74',
  primaryLight: '#8A9D8C',
  primaryDark: '#546E5F',
  secondary: '#FFD166',
  secondaryLight: '#FFE5A3',
  secondaryDark: '#E6B84D',
  accent: '#EF7C8E',
  accentLight: '#F49FB5',
  accentDark: '#D86476',
  background: '#F8F4E9',
  backgroundLight: '#FFFFFF',
  backgroundDark: '#EDE8DC',
  textPrimary: '#3C3C3C',
  textSecondary: '#6B6B6B',
  textTertiary: '#9A9A9A',
  textLight: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceLight: '#F5F5F5',
  surfaceDark: '#ECECEC',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
  info: '#2196F3',
  transparent: 'transparent'
};

// Create custom config with extended tokens
const customTokens = {
  ...defaultConfig.tokens,
  colors: {
    ...defaultConfig.tokens.colors,
    // Primary shades
    primary0: colors.backgroundLight,
    primary50: colors.primaryLight,
    primary100: colors.primaryLight,
    primary200: colors.primaryLight,
    primary300: colors.primaryLight,
    primary400: colors.primary,
    primary500: colors.primary,
    primary600: colors.primaryDark,
    primary700: colors.primaryDark,
    primary800: colors.primaryDark,
    primary900: colors.primaryDark,
    primary950: colors.primaryDark,
    // Background shades
    backgroundLight0: colors.background,
    backgroundLight50: colors.background,
    backgroundLight100: colors.background,
    backgroundLight200: colors.background,
    backgroundLight300: colors.background,
    backgroundLight400: colors.background,
    backgroundLight500: colors.background,
    backgroundLight600: colors.backgroundDark,
    backgroundLight700: colors.backgroundDark,
    backgroundLight800: colors.backgroundDark,
    backgroundLight900: colors.backgroundDark,
    backgroundLight950: colors.backgroundDark,
    // Border shades
    borderLight0: '#F0F0F0',
    borderLight50: '#E5E5E5',
    borderLight100: '#DDDDDD',
    borderLight200: '#CCCCCC',
    borderLight300: '#BBBBBB',
    borderLight400: '#AAAAAA',
    borderLight500: '#999999',
    borderLight600: '#888888',
    borderLight700: '#777777',
    borderLight800: '#666666',
    borderLight900: '#555555',
    borderLight950: '#444444',
    // Secondary shades
    secondary0: colors.backgroundLight,
    secondary50: colors.secondaryLight,
    secondary100: colors.secondaryLight,
    secondary200: colors.secondaryLight,
    secondary300: colors.secondaryLight,
    secondary400: colors.secondary,
    secondary500: colors.secondary,
    secondary600: colors.secondaryDark,
    secondary700: colors.secondaryDark,
    secondary800: colors.secondaryDark,
    secondary900: colors.secondaryDark,
    secondary950: colors.secondaryDark,
    // Accent shades
    accent0: colors.backgroundLight,
    accent50: colors.accentLight,
    accent100: colors.accentLight,
    accent200: colors.accentLight,
    accent300: colors.accentLight,
    accent400: colors.accent,
    accent500: colors.accent,
    accent600: colors.accentDark,
    accent700: colors.accentDark,
    accent800: colors.accentDark,
    accent900: colors.accentDark,
    accent950: colors.accentDark,
    // Surface shades
    surface0: colors.surface,
    surface50: colors.surfaceLight,
    surface100: colors.surfaceLight,
    surface200: colors.surfaceLight,
    surface300: colors.surfaceLight,
    surface400: colors.surface,
    surface500: colors.surface,
    surface600: colors.surfaceDark,
    surface700: colors.surfaceDark,
    surface800: colors.surfaceDark,
    surface900: colors.surfaceDark,
    surface950: colors.surfaceDark,
    // Text shades
    textDark0: colors.textLight,
    textDark50: colors.textPrimary,
    textDark100: colors.textPrimary,
    textDark200: colors.textPrimary,
    textDark300: colors.textSecondary,
    textDark400: colors.textSecondary,
    textDark500: colors.textSecondary,
    textDark600: colors.textTertiary,
    textDark700: colors.textTertiary,
    textDark800: colors.textPrimary,
    textDark900: colors.textPrimary,
    textDark950: colors.textPrimary,
    textLight0: colors.textLight,
    textLight50: colors.textLight,
    textLight100: colors.textLight,
    textLight200: colors.textLight,
    textLight300: colors.textLight,
    textLight400: colors.textLight,
    textLight500: colors.textLight,
    textLight600: colors.textLight,
    textLight700: colors.textLight,
    textLight800: colors.textLight,
    textLight900: colors.textLight,
    textLight950: colors.textLight,
    // Semantic colors
    error500: colors.error,
    error600: colors.error,
    error700: colors.error,
    warning500: colors.warning,
    info500: colors.info,
    success500: colors.success,
    // Additional color mappings
    gray50: colors.backgroundLight,
    gray100: colors.background,
    gray200: colors.background,
    gray300: colors.backgroundDark,
    gray400: colors.backgroundDark,
    gray500: colors.textSecondary,
    gray600: colors.textPrimary,
    gray700: colors.textPrimary,
    gray800: colors.textPrimary,
    gray900: colors.textPrimary,
  }
};

// Create components with updated defaults
const customComponents = {
  ...defaultConfig.components,
  Button: {
    ...defaultConfig.components.Button,
    baseStyle: {
      py: '$5',
      h: '$12',
    },
    defaultProps: {
      bg: '$primary500',
      _text: { color: '$white', fontWeight: '$medium' },
    },
    theme: {
      ...defaultConfig.components.Button.theme,
    }
  },
  Input: {
    ...defaultConfig.components.Input,
    baseStyle: {
      py: '$3',
    },
    defaultProps: {
      bg: '$backgroundLight0',
      borderColor: '$borderLight300',
    },
    theme: {
      ...defaultConfig.components.Input.theme,
    }
  }
};

// Create the custom config with components having updated default props
export const customConfig = createConfig({
  tokens: customTokens,
  aliases: defaultConfig.aliases,
  globalStyle: defaultConfig.globalStyle,
  components: customComponents,
  plugins: defaultConfig.plugins,
});

export default customConfig;