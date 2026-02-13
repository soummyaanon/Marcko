import type { MetadataRoute } from 'next'

const baseUrl = 'https://marcko.bixai.dev'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/share/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
