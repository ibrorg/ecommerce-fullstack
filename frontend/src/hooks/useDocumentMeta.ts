import { useEffect } from 'react';

interface DocumentMetaOptions {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
}

/**
 * useDocumentMeta — sets document.title, meta description, canonical URL,
 * and Open Graph tags per page. In a CSR SPA this is the minimum viable SEO
 * (crawlers like Googlebot now execute JS, so these tags get indexed).
 *
 * For full SSR SEO, migrate to Next.js where the server renders the tags.
 */
export function useDocumentMeta({
  title,
  description,
  canonicalUrl,
  ogType = 'website',
  ogImage,
}: DocumentMetaOptions): void {
  useEffect(() => {
    const fullTitle = title.includes('E-Shop') ? title : `${title} — E-Shop`;
    document.title = fullTitle;

    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }

    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('property', 'og:type', ogType);

    if (ogImage) {
      setMetaTag('property', 'og:image', ogImage);
      setMetaTag('name', 'twitter:image', ogImage);
    }

    if (canonicalUrl) {
      setCanonicalLink(canonicalUrl);
      setMetaTag('property', 'og:url', canonicalUrl);
    }

    return () => {
      // reset to defaults on unmount
      document.title = 'E-Shop — Full Stack E-Commerce';
    };
  }, [title, description, canonicalUrl, ogType, ogImage]);
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonicalLink(href: string): void {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}
