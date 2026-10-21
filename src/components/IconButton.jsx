import { cn } from '../utils/cn.js';

export function IconButton({ className, children, ...props }) {
  return (
    <button type="button" className={cn('icon-btn', className)} {...props}>
      {children}
    </button>
  );
}
