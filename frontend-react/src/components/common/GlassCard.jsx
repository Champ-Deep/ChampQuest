import { motion } from 'motion/react';

export default function GlassCard({ children, className = '', hover = false, ...props }) {
  const Component = hover ? motion.div : 'div';
  const hoverProps = hover ? {
    whileHover: { scale: 1.01, borderColor: 'rgba(var(--neon-primary-rgb, 239, 68, 68), 0.3)' },
    transition: { duration: 0.2 },
  } : {};

  return (
    <Component className={`glass-card ${className}`} {...hoverProps} {...props}>
      {children}
    </Component>
  );
}
