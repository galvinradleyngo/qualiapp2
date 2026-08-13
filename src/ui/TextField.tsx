import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, id, className = '', ...rest }, ref) => {
    const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <div className="field">
        <label htmlFor={inputId}>{label}</label>
        <input ref={ref} id={inputId} className={`input ${className}`} {...rest} />
        {error ? <p className="text-sm text-red-700">{error}</p> : hint ? <p className="text-sm text-ink-soft">{hint}</p> : null}
      </div>
    );
  },
);
TextField.displayName = 'TextField';

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, hint, id, className = '', ...rest }, ref) => {
    const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <div className="field">
        <label htmlFor={inputId}>{label}</label>
        <textarea ref={ref} id={inputId} className={`textarea ${className}`} {...rest} />
        {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      </div>
    );
  },
);
TextAreaField.displayName = 'TextAreaField';
