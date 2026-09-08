"use client";

import { forwardRef, type ReactNode } from "react";

const base =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-neutral-100 disabled:text-neutral-500";

export function Label({
  children,
  required,
  htmlFor,
}: {
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-neutral-600">
      {children}
      {required && <span className="ml-0.5 text-brand">*</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className = "",
}: {
  label?: ReactNode;
  required?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${base} ${className}`} {...props} />;
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={`${base} resize-y ${className}`} {...props} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className = "", children, ...props }, ref) {
  return (
    <select ref={ref} className={`${base} pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }
>(function Checkbox({ label, className = "", ...props }, ref) {
  return (
    <label className={`flex items-center gap-2 text-sm text-neutral-700 ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand/30"
        {...props}
      />
      {label}
    </label>
  );
});

/** Grade responsiva de campos de formulário. */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
