import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode, MouseEventHandler, ButtonHTMLAttributes } from 'react';
import './Button.css';

interface ButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: string;
  icon?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  className?: string;
}

function Button({
  children,
  href,
  onClick,
  variant = 'primary',
  icon = false,
  type = 'button',
  className = '',
}: ButtonProps) {
  const classes = `ofa-button ofa-button-${variant} ${className}`;

  const content = (
    <>
      <span>{children}</span>
      {icon && <ArrowRight size={17} />}
    </>
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} type={type} onClick={onClick}>
      {content}
    </button>
  );
}

export default Button;