import { ArrowRight } from "lucide-react";
import "./Button.css";

function Button({
  children,
  href,
  onClick,
  variant = "primary",
  icon = false,
  type = "button",
  className = "",
}) {
  const classes = `ofa-button ofa-button-${variant} ${className}`;

  const content = (
    <>
      <span>{children}</span>
      {icon && <ArrowRight size={17} />}
    </>
  );

  if (href) {
    return (
      <a className={classes} href={href}>
        {content}
      </a>
    );
  }

  return (
    <button className={classes} type={type} onClick={onClick}>
      {content}
    </button>
  );
}

export default Button;