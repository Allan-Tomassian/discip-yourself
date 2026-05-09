import React from "react";
import { ShieldCheck } from "lucide-react";

export default function AuthCommandSurface({
  title,
  subtitle = "",
  eyebrow = "Accès sécurisé",
  tone = "default",
  icon = null,
  showIcon = true,
  children,
  footer = null,
  className = "",
  bodyClassName = "",
  "data-testid": dataTestId,
}) {
  const Icon = icon || ShieldCheck;
  return (
    <section
      className={["authCommandSurface", `authCommandSurface--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      data-testid={dataTestId}
    >
      <div className="authCommandSurfaceAura" aria-hidden="true" />

      <header className="authCommandHeader">
        {eyebrow ? <div className="authCommandEyebrow">{eyebrow}</div> : null}
        {showIcon ? (
          <div className="authCommandIcon" aria-hidden="true">
            {React.isValidElement(Icon) ? Icon : <Icon size={24} strokeWidth={1.7} />}
          </div>
        ) : null}
        <div className="authCommandTitleBlock">
          {title ? <h1>{title}</h1> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>

      <div className={["authCommandBody", bodyClassName].filter(Boolean).join(" ")}>
        {children}
      </div>

      {footer ? <footer className="authCommandFooter">{footer}</footer> : null}
    </section>
  );
}

export function AuthSecureNote({ children = "Sécurisé par Discip Yourself" }) {
  return (
    <div className="authSecureNote">
      <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
