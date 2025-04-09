
import { Link, useLocation, LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavLinkProps extends LinkProps {
  children: React.ReactNode;
  activeClassName?: string;
}

export function NavLink({ 
  children, 
  to, 
  className, 
  activeClassName = "text-primary font-medium", 
  ...props 
}: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={cn(
        "text-sm transition-colors hover:text-primary",
        isActive ? activeClassName : "text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
