import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE_ORIGIN = "https://homelensais.com";

/**
 * Emits <link rel="canonical"> and <meta property="og:url"> pointing at the
 * current route, so marketing/legal pages don't inherit the homepage canonical
 * from index.html.
 */
export function SeoCanonical({ path }: { path?: string }) {
  const location = useLocation();
  const routePath = path ?? location.pathname ?? "/";
  const url = `${SITE_ORIGIN}${routePath}`;
  return (
    <Helmet>
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
    </Helmet>
  );
}

export default SeoCanonical;