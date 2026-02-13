import type { MetadataRoute } from 'next'

const baseUrl = 'https://marcko.bixai.dev'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
  ]
}
