import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export function Button({
  asChild,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={`button button-${variant} ${className}`}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "pending" | "danger" | "ai";
}) {
  return <span className={`badge badge-${tone} ${className}`} {...props} />;
}

export function Panel({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <section className={`panel ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}
