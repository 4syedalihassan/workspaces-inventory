// Ant Design theme configuration matching AWS color scheme
export const theme = {
  token: {
    // Primary colors (AWS dark blue/gray)
    colorPrimary: '#232f3e',
    colorPrimaryHover: '#37475a',
    colorPrimaryActive: '#131a22',

    // Secondary/Link colors (AWS orange)
    colorLink: '#ff9900',
    colorLinkHover: '#ffad33',
    colorLinkActive: '#cc7a00',

    // Success, Warning, Error, Info
    colorSuccess: '#4caf50',
    colorWarning: '#ff9800',
    colorError: '#f44336',
    colorInfo: '#2196f3',

    // Background colors
    colorBgLayout: '#f5f7fa',
    colorBgContainer: '#ffffff',

    // Border radius
    borderRadius: 8,
    borderRadiusLG: 12,

    // Font
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,

    // Heading sizes
    fontSizeHeading1: 40,
    fontSizeHeading2: 32,
    fontSizeHeading3: 28,
    fontSizeHeading4: 24,
    fontSizeHeading5: 20,

    // Shadows
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    boxShadowSecondary: '0 2px 8px rgba(0,0,0,0.15)',
  },
  components: {
    Button: {
      fontWeight: 600,
      primaryShadow: 'none',
    },
    Card: {
      borderRadiusLG: 12,
      boxShadowTertiary: '0 2px 8px rgba(0,0,0,0.08)',
    },
    Table: {
      headerBg: '#f5f7fa',
      headerColor: '#232f3e',
      headerFontWeight: 600,
    },
    Tag: {
      fontWeight: 500,
    },
    Layout: {
      headerBg: '#232f3e',
      headerColor: '#ffffff',
    },
    Menu: {
      darkItemBg: '#232f3e',
      darkItemSelectedBg: '#37475a',
      darkItemHoverBg: '#37475a',
    },
  },
};
