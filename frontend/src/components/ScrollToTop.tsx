import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop — scrolls the viewport to the top whenever the route path
 * changes. Without this, navigating to a new page keeps the scroll position
 * from the previous page, which is disorienting.
 *
 * Place inside <Router> but outside <Routes>.
 */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
