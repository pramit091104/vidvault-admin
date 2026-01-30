import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-3 sm:px-4">
      <div className="text-center max-w-md mx-auto">
        <h1 className="mb-4 text-6xl sm:text-8xl font-bold">404</h1>
        <p className="mb-6 text-lg sm:text-xl text-muted-foreground">Oops! Page not found</p>
        <p className="mb-8 text-sm sm:text-base text-muted-foreground px-4">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a 
          href="/" 
          className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors touch-manipulation"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
