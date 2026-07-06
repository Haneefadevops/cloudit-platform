"use client";
import * as React from "react";
import { cn } from "../lib/utils.js";

export interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
}

function FormField({ children, className }: FormFieldProps) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export interface FormLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

function FormLabel({
  className,
  children,
  required,
  ...props
}: FormLabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

export interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  message?: string;
}

function FormError({ className, message, ...props }: FormErrorProps) {
  if (!message) return null;
  return (
    <p
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    >
      {message}
    </p>
  );
}

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <form ref={ref} className={cn("space-y-4", className)} {...props}>
        {children}
      </form>
    );
  }
);
Form.displayName = "Form";

export { Form, FormField, FormLabel, FormError };
