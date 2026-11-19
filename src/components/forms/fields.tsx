'use client';

import { useState, type ChangeEvent, type HTMLAttributes, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import MuiTextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Button, { type ButtonProps } from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { Eye, EyeOff } from 'lucide-react';
import type { FormState } from '@/lib/forms';
import { Notice } from '@/components/ui/notice';

/** Traduit une clé d'erreur (ex. « validation.required ») si elle existe. */
function useErrorText() {
  const t = useTranslations();
  return (error?: string) => (error ? (t.has(error) ? t(error) : error) : undefined);
}

interface FieldProps {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optionalLabel?: boolean;
  type?: string;
  defaultValue?: string | number;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
  autoCapitalize?: string;
  autoFocus?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  minLength?: number;
  min?: string | number;
  max?: string | number;
  placeholder?: string;
  size?: 'small' | 'medium';
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

/** Champ texte MUI (Sneat) : libellé, aide, message d'erreur traduit, œil pour les mots de passe. */
export function TextField({
  name,
  label,
  hint,
  error,
  optionalLabel,
  type = 'text',
  readOnly,
  autoCapitalize,
  inputMode,
  maxLength,
  minLength,
  min,
  max,
  size,
  ...rest
}: FieldProps) {
  const t = useTranslations();
  const errorText = useErrorText();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <MuiTextField
      fullWidth
      name={name}
      size={size}
      label={optionalLabel ? `${label} (${t('common.optional')})` : label}
      type={isPassword && visible ? 'text' : type}
      error={Boolean(error)}
      helperText={errorText(error) ?? hint}
      inputProps={{ readOnly, autoCapitalize, inputMode, maxLength, minLength, min, max }}
      // Les champs date affichent leur propre gabarit (jj/mm/aaaa) : le libellé reste au-dessus.
      InputLabelProps={type === 'date' || type === 'datetime-local' ? { shrink: true } : undefined}
      InputProps={
        isPassword
          ? {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton edge="end" onClick={() => setVisible((v) => !v)} aria-label={t('auth.showPassword')} aria-pressed={visible}>
                    {visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
                  </IconButton>
                </InputAdornment>
              ),
            }
          : undefined
      }
      {...rest}
    />
  );
}

interface TextAreaProps {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  minRows?: number;
  placeholder?: string;
  monospace?: boolean;
}

export function TextAreaField({ name, label, hint, error, maxLength, minRows = 5, monospace = true, ...rest }: TextAreaProps) {
  const errorText = useErrorText();
  return (
    <MuiTextField
      fullWidth
      multiline
      minRows={minRows}
      name={name}
      label={label}
      error={Boolean(error)}
      helperText={errorText(error) ?? hint}
      inputProps={{ maxLength, style: monospace ? { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.875rem' } : undefined }}
      {...rest}
    />
  );
}

/** Liste déroulante native (légère, accessible, compatible FormData). */
export function SelectField({
  name,
  label,
  options,
  defaultValue,
  error,
  hint,
  required,
  size,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  size?: 'small' | 'medium';
  onChange?: (value: string) => void;
}) {
  const errorText = useErrorText();
  return (
    <MuiTextField
      select
      fullWidth
      name={name}
      label={label}
      size={size}
      required={required}
      defaultValue={defaultValue ?? ''}
      error={Boolean(error)}
      helperText={errorText(error) ?? hint}
      SelectProps={{ native: true }}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </MuiTextField>
  );
}

export function CheckboxField({
  name,
  label,
  error,
  required,
  defaultChecked,
}: {
  name: string;
  label: ReactNode;
  error?: string;
  required?: boolean;
  defaultChecked?: boolean;
}) {
  const errorText = useErrorText();
  return (
    <Box>
      <FormControlLabel
        control={<Checkbox name={name} required={required} defaultChecked={defaultChecked} inputProps={{ 'aria-invalid': Boolean(error) }} />}
        label={label}
        sx={{ alignItems: 'flex-start', '& .MuiCheckbox-root': { mt: -1 }, '& .MuiFormControlLabel-label': { fontSize: '0.9375rem' } }}
      />
      {error && (
        <FormHelperText error role="alert">
          {errorText(error)}
        </FormHelperText>
      )}
    </Box>
  );
}

/** Bandeau de résultat global d'un formulaire. */
export function FormMessage({ state }: { state: FormState }) {
  const t = useTranslations();
  if (!state.message || state.status === 'idle') return null;
  const text = t.has(state.message) ? t(state.message) : state.message;
  return <Notice tone={state.status === 'success' ? 'success' : 'error'}>{text}</Notice>;
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
  fullWidth = true,
  color = 'primary',
  variant = 'contained',
  size = 'large',
  startIcon,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: string;
  fullWidth?: boolean;
  color?: ButtonProps['color'];
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  startIcon?: ReactNode;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      color={color}
      size={size}
      fullWidth={fullWidth}
      disabled={pending}
      aria-busy={pending}
      startIcon={pending ? <CircularProgress size={16} color="inherit" /> : startIcon}
    >
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
