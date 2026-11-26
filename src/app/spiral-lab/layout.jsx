// Research tool, not linked from the site's navigation; keep it out of search results.
export const metadata = {
  title: "Spiral lab · Spiral Analysis",
  robots: { index: false, follow: false },
};

export default function SpiralLabLayout({ children }) {
  return children;
}
