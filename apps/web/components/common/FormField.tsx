import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type BaseProps = {
  label: string;
  hint?: string;
  children?: ReactNode;
};

export function FieldShell({ label, hint, children }: BaseProps) {
  return (
    <label className="hc-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function TextInput(props: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const { label, hint, ...inputProps } = props;
  return (
    <FieldShell label={label} hint={hint}>
      <input {...inputProps} />
    </FieldShell>
  );
}

export function TextArea(props: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { label, hint, ...textareaProps } = props;
  return (
    <FieldShell label={label} hint={hint}>
      <textarea {...textareaProps} />
    </FieldShell>
  );
}

export function SelectField(props: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const { label, hint, children, ...selectProps } = props;
  return (
    <FieldShell label={label} hint={hint}>
      <select {...selectProps}>{children}</select>
    </FieldShell>
  );
}
