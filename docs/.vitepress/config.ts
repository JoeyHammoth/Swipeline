import { defineConfig } from 'vitepress'

// Project Pages URL until the organisation transfer: https://joeyhammoth.github.io/Swipeline/
// `base` must keep that trailing slash or every asset 404s. Update both base and
// sitemap hostname together when moving to a custom domain or org-level Pages.
const BASE = '/Swipeline/'

export default defineConfig({
  lang: 'en-US',
  title: 'Swipeline',
  description:
    'Swipe-first discovery toolkit: connect any source, get a ranked deck, keep a portable history.',
  base: BASE,
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}brand/logo.svg` }],
    ['meta', { name: 'theme-color', content: '#0f1020' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: `${BASE}brand/hero.svg` }],
  ],

  themeConfig: {
    logo: { src: '/brand/logo.svg', alt: 'Swipeline' },
    siteTitle: 'Swipeline',

    nav: [
      { text: 'Guide', link: '/getting-started/quickstart' },
      { text: 'Concepts', link: '/concepts/architecture' },
      { text: 'Reference', link: '/reference/config' },
      { text: 'Adapters', link: '/adapters/' },
      { text: 'Playground', link: '/playground' },
      { text: 'Roadmap', link: '/roadmap' },
      {
        text: 'Project',
        items: [
          { text: 'Contributing', link: '/contributing/' },
          { text: 'Design & decisions', link: '/decisions/open-questions' },
          { text: 'Architecture contracts', link: '/architecture/contracts' },
          { text: 'Benchmarks', link: '/benchmarks' },
          { text: 'Landscape', link: '/landscape' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Getting started',
        items: [
          { text: 'Quickstart', link: '/getting-started/quickstart' },
          { text: 'Add to an existing app', link: '/getting-started/add-to-existing-app' },
          { text: 'Choose your tier', link: '/getting-started/choose-your-tier' },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Architecture', link: '/concepts/architecture' },
          { text: 'Cards and adapters', link: '/concepts/cards-and-adapters' },
          { text: 'Events, profiles and history', link: '/concepts/events-and-profiles' },
          { text: 'Ranking', link: '/concepts/ranking' },
          { text: 'Local-first and privacy', link: '/concepts/local-first-and-privacy' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Write a source adapter', link: '/guides/write-an-adapter' },
          { text: 'Custom card templates', link: '/guides/custom-card-template' },
          { text: 'Write a rank stage', link: '/guides/write-a-rank-stage' },
          { text: 'Embeddings', link: '/guides/embeddings' },
          { text: 'Write a UI binding', link: '/guides/write-a-binding' },
          { text: 'React Native', link: '/guides/react-native' },
          { text: 'Self-host the server', link: '/guides/self-host-the-server' },
          { text: 'Export and import history', link: '/guides/export-and-import' },
          { text: 'Accessibility', link: '/guides/accessibility' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Deck configuration', link: '/reference/config' },
          { text: 'CLI', link: '/reference/cli' },
          { text: 'Schemas', link: '/reference/schemas' },
          { text: 'Contracts', link: '/architecture/contracts' },
        ],
      },
      {
        text: 'Project',
        items: [
          { text: 'Adapters catalog', link: '/adapters/' },
          { text: 'Recipes', link: '/recipes/' },
          { text: 'Playground', link: '/playground' },
          { text: 'Benchmarks', link: '/benchmarks' },
          { text: 'Landscape', link: '/landscape' },
          { text: 'Roadmap', link: '/roadmap' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
      {
        text: 'Contributing',
        collapsed: false,
        items: [
          { text: 'How to contribute', link: '/contributing/' },
          {
            text: 'Architecture for contributors',
            link: '/contributing/architecture-for-contributors',
          },
          { text: 'RFCs', link: '/contributing/rfcs' },
          { text: 'ADRs', link: '/adr/' },
          { text: 'Open questions and decisions', link: '/decisions/open-questions' },
          { text: 'M0 verification research', link: '/research/2026-11-m0-verification' },
          {
            text: 'Design & implementation plan',
            link: '/swipeline-design-and-implementation-plan',
          },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/JoeyHammoth/Swipeline' }],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/JoeyHammoth/Swipeline/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    outline: { level: [2, 3] },

    footer: {
      message: 'Code Apache-2.0 · Docs prose CC BY 4.0',
      copyright: '© 2026 Swipeline contributors',
    },
  },

  sitemap: { hostname: 'https://joeyhammoth.github.io/Swipeline/' },
})
