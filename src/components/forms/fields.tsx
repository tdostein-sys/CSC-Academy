'use client';

import { useId, useState, type ChangeEvent, type HTMLAttributes, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import MuiTextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Button, { type ButtonProps } from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Eye, EyeOff } from 'lucide-react';
import type { FormState } from '@/lib/forms';
import { Notice } from '@/components/ui/notice';

/** Traduit une clé d'erreur (ex. « validation.required ») si elle existe. */
function useErrorText() {
  const t = useTranslations();
  return (error?: string) => (error ? (t.has(error) ? t(error) : error) : undefined);
}

/**
 * Libellé AU-DESSUS du champ (jamais flottant dans le champ : plus lisible,
 * et aucun chevauchement avec une valeur par défaut). Astérisque rouge pour
 * les champs obligatoires, mention « facultatif » sinon si demandé.
 */
export function FieldLabel({ htmlFor, id, required, optional, children }: { htmlFor?: string; id?: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  const t = useTranslations('common');
  return (
    <FormLabel
      htmlFor={htmlFor}
      id={id}
      required={required}
      sx={{
        display: 'block',
        mb: 1,
        fontSize: '0.875rem',
        fontWeight: 600,
        color: 'text.primary',
        '&.Mui-focused': { color: 'text.primary' },
        '&.Mui-error': { color: 'text.primary' },
        '& .MuiFormLabel-asterisk': { color: 'error.main' },
      }}
    >
      {children}
      {optional && (
        <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
          {' '}
          ({t('optional')})
        </Box>
      )}
    </FormLabel>
  );
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
  /** Unité affichée dans le champ, à droite (« FCFA », « USDT »). */
  suffix?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
}

/**
 * Champ texte : libellé au-dessus, aide sous le champ, message d'erreur
 * traduit et relié au champ (aria-invalid / aria-describedby), œil pour les
 * mots de passe, unité en suffixe.
 */
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
  required,
  suffix,
  onChange,
  onBlur,
  ...rest
}: FieldProps) {
  const t = useTranslations();
  const errorText = useErrorText();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  const endAdornment = isPassword ? (
    <InputAdornment position="end">
      <IconButton edge="end" onClick={() => setVisible((v) => !v)} aria-label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')} aria-pressed={visible}>
        {visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
      </IconButton>
    </InputAdornment>
  ) : suffix ? (
    <InputAdornment position="end">
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        {suffix}
      </Typography>
    </InputAdornment>
  ) : undefined;

  return (
    <Box>
      <FieldLabel htmlFor={id} required={required} optional={optionalLabel}>
        {label}
      </FieldLabel>
      <MuiTextField
        id={id}
        fullWidth
        name={name}
        size={size}
        required={required}
        type={isPassword && visible ? 'text' : type}
        error={Boolean(error)}
        helperText={errorText(error) ?? hint}
        onChange={onChange}
        onBlur={onBlur}
        inputProps={{ readOnly, autoCapitalize, inputMode, maxLength, minLength, min, max, 'aria-required': required || undefined }}
        InputProps={endAdornment ? { endAdornment } : undefined}
        FormHelperTextProps={error ? { role: 'alert' } : undefined}
        {...rest}
      />
    </Box>
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
  /** Compteur de caractères en direct (« 7 / 10 caractères minimum »). */
  minLength?: number;
  showCounter?: boolean;
}

export function TextAreaField({ name, label, hint, error, maxLength, minLength, showCounter = false, minRows = 5, monospace = true, required, defaultValue, ...rest }: TextAreaProps) {
  const t = useTranslations('common');
  const errorText = useErrorText();
  const id = useId();
  const counterId = `${id}-counter`;
  const [length, setLength] = useState((defaultValue ?? '').length);
  const tooShort = minLength !== undefined && length < minLength;

  return (
    <Box>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <MuiTextField
        id={id}
        fullWidth
        multiline
        minRows={minRows}
        name={name}
        required={required}
        defaultValue={defaultValue}
        error={Boolean(error)}
        helperText={errorText(error) ?? hint}
        FormHelperTextProps={error ? { role: 'alert' } : undefined}
        onChange={showCounter ? (e) => setLength(e.target.value.length) : undefined}
        inputProps={{
          maxLength,
          'aria-required': required || undefined,
          ...(showCounter ? { 'aria-describedby': counterId } : {}),
          style: monospace ? { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.875rem' } : undefined,
        }}
        {...rest}
      />
      {showCounter && (
        <Typography
          id={counterId}
          variant="caption"
          component="p"
          aria-live="polite"
          sx={{ mt: 0.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: tooShort ? 'warning.main' : 'text.secondary' }}
        >
          {tooShort ? t('charCountMin', { count: length, min: minLength }) : maxLength ? t('charCountMax', { count: length, max: maxLength }) : t('charCount', { count: length })}
        </Typography>
      )}
    </Box>
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
  const id = useId();
  return (
    <Box>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <MuiTextField
        id={id}
        select
        fullWidth
        name={name}
        size={size}
        required={required}
        defaultValue={defaultValue ?? ''}
        error={Boolean(error)}
        helperText={errorText(error) ?? hint}
        FormHelperTextProps={error ? { role: 'alert' } : undefined}
        SelectProps={{ native: true }}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </MuiTextField>
    </Box>
  );
}

export function CheckboxField({
  name,
  label,
  error,
  required,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: ReactNode;
  error?: string;
  required?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const errorText = useErrorText();
  const id = useId();
  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            name={name}
            required={required}
            defaultChecked={defaultChecked}
            onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
            inputProps={{ 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined }}
          />
        }
        label={label}
        sx={{ alignItems: 'flex-start', '& .MuiCheckbox-root': { mt: -1 }, '& .MuiFormControlLabel-label': { fontSize: '0.9375rem' } }}
      />
      {error && (
        <FormHelperText id={`${id}-error`} error role="alert">
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
  disabled = false,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: string;
  fullWidth?: boolean;
  color?: ButtonProps['color'];
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  startIcon?: ReactNode;
  /** Désactivé tant que le formulaire n'est pas prêt (ex. règles du mot de passe). */
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      color={color}
      size={size}
      fullWidth={fullWidth}
      disabled={pending || disabled}
      aria-busy={pending}
      startIcon={pending ? <CircularProgress size={16} color="inherit" /> : startIcon}
    >
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
