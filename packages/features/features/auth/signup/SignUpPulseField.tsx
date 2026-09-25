import { memo, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { signUpPasswordInputProps, type SignUpPasswordFieldRole } from '@pulse/domain/lib/signupPasswordInput.util';
import { WEB_TRAILING_FOCUS_GUARD, scrollFocusedWebInputIntoView } from '@pulse/core/lib/webKeyboard';
import { useViewportWidth } from '@pulse/core/lib/hooks/useViewportWidth';
import {
  pulseInputShellErrorStyle,
  pulseInputShellStyle,
  pulseInputTextStyle,
  pulseInputTrailingHitSlop,
} from '@pulse/core/lib/pulseInputChrome';

import { useSignUpPulseFormStepContext } from '@pulse/ui/features/auth/signup/SignUpPulseFormStepContext';
import {
  SIGNUP_CONFIRM_PASSWORD_SCROLL_PAD,
  SIGNUP_PASSWORD_SCROLL_PAD,
  DESKTOP_BREAKPOINT,
} from '@pulse/domain/features/auth/signup/signUpConstants';
import { PULSE_SIGNUP, PULSE_SIGNUP_RADIUS, type SignUpTheme } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { createPulseSignUpTextStyles, SIGNUP_ERROR_COLOR } from '@pulse/domain/features/auth/signup/signUpTypography';

export interface SignUpPulseFieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  errorMessage?: string | null;
  hintMessage?: string | null;
  trailing?: ReactNode;
  theme?: SignUpTheme;
  /** Applies iOS-safe autofill props so Strong Password UI does not block typing. */
  passwordField?: SignUpPasswordFieldRole;
  /** Tighter vertical spacing (Account step with keyboard). */
  dense?: boolean;
  /** Sentence-case labels with extra vertical rhythm (sign-in). */
  comfortable?: boolean;
}

export const SignUpPulseField = memo(function SignUpPulseField({
  label,
  required,
  errorMessage,
  hintMessage,
  trailing,
  theme = PULSE_SIGNUP,
  passwordField,
  dense = false,
  comfortable = false,
  style,
  onSubmitEditing,
  returnKeyType,
  blurOnSubmit,
  multiline = false,
  onFocus,
  ...inputProps
}: SignUpPulseFieldProps) {
  const width = useViewportWidth();
  const isMobile = width < DESKTOP_BREAKPOINT;
  const hasError = !!errorMessage;
  const fieldStyles = useMemo(
    () => createFieldStyles(theme, dense, comfortable, isMobile),
    [theme, dense, comfortable, isMobile],
  );
  const passwordAutofillProps = passwordField
    ? signUpPasswordInputProps(passwordField)
    : {};
  const formStep = useSignUpPulseFormStepContext();
  const registerField = formStep?.registerField;
  const unregisterField = formStep?.unregisterField;
  const isLastSingleLineFieldFn = formStep?.isLastSingleLineField;
  const handleFieldSubmitFn = formStep?.handleFieldSubmit;
  const scrollFieldIntoView = formStep?.scrollFieldIntoView;
  const fieldRevision = formStep?.revision ?? 0;
  const inputRef = useRef<TextInput>(null);
  const wrapRef = useRef<View>(null);
  const fieldIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!registerField || !unregisterField) return undefined;
    const id = registerField(inputRef, !!multiline);
    fieldIdRef.current = id;
    return () => {
      unregisterField(id);
      if (fieldIdRef.current === id) {
        fieldIdRef.current = null;
      }
    };
  }, [registerField, unregisterField, multiline]);

  const fieldId = fieldIdRef.current;
  const isLastSingleLineField = useMemo(() => {
    if (!isLastSingleLineFieldFn || fieldId == null || multiline) return false;
    return isLastSingleLineFieldFn(fieldId);
  }, [isLastSingleLineFieldFn, fieldId, multiline, fieldRevision]);

  const resolvedReturnKeyType =
    returnKeyType ??
    (registerField && !multiline ? (isLastSingleLineField ? 'done' : 'next') : undefined);

  const resolvedBlurOnSubmit =
    blurOnSubmit ?? (registerField && !multiline ? isLastSingleLineField : undefined);

  const handleSubmitEditing: TextInputProps['onSubmitEditing'] = (event) => {
    onSubmitEditing?.(event);
    if (!multiline && handleFieldSubmitFn && fieldId != null) {
      handleFieldSubmitFn(fieldId);
    }
  };

  const handleFocus: TextInputProps['onFocus'] = (event) => {
    onFocus?.(event);
    // Inside a form step: only use ScrollView scroll — never document scrollIntoView.
    if (scrollFieldIntoView) {
      const extraBottomPad =
        passwordField === 'confirm'
          ? SIGNUP_CONFIRM_PASSWORD_SCROLL_PAD
          : passwordField === 'new'
            ? SIGNUP_PASSWORD_SCROLL_PAD
            : undefined;
      scrollFieldIntoView(
        wrapRef,
        extraBottomPad != null ? { extraBottomPad } : undefined,
      );
      return;
    }
    if (Platform.OS === 'web' && !formStep) {
      scrollFocusedWebInputIntoView();
    }
  };

  const shellWebProps =
    Platform.OS === 'web'
      ? ({
          className: hasError
            ? 'pulse-input-shell pulse-input-shell--error'
            : 'pulse-input-shell',
        } as object)
      : {};

  return (
    <View ref={wrapRef} style={fieldStyles.wrap} collapsable={false}>
      <Text style={fieldStyles.label}>
        {label}
        {required ? <Text style={fieldStyles.req}> *</Text> : null}
      </Text>
      <View
        style={[
          fieldStyles.inputShell,
          hasError && fieldStyles.inputShellError,
          multiline && fieldStyles.inputShellMultiline,
        ]}
        {...shellWebProps}
      >
        <TextInput
          ref={inputRef}
          {...passwordAutofillProps}
          {...inputProps}
          multiline={multiline}
          returnKeyType={resolvedReturnKeyType}
          blurOnSubmit={resolvedBlurOnSubmit}
          onSubmitEditing={handleSubmitEditing}
          onFocus={handleFocus}
          style={[
            fieldStyles.input,
            multiline && fieldStyles.inputMultiline,
            trailing ? fieldStyles.inputWithTrailing : null,
            style,
          ]}
          placeholderTextColor={theme.placeholder}
        />
        {trailing ? (
          <View
            style={fieldStyles.trailingWrap}
            {...(Platform.OS === 'web' ? (WEB_TRAILING_FOCUS_GUARD as object) : null)}
          >
            {trailing}
          </View>
        ) : null}
      </View>
      {errorMessage ? (
        <Text style={fieldStyles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{errorMessage}</Text>
      ) : hintMessage ? (
        <Text style={fieldStyles.hint}>{hintMessage}</Text>
      ) : null}
    </View>
  );
});

function createFieldStyles(
  theme: SignUpTheme,
  dense: boolean,
  comfortable: boolean,
  isMobile: boolean,
) {
  const text = createPulseSignUpTextStyles(theme);

  const inputTypography = isMobile ? text.inputMobile : text.input;
  const inputMinHeight =
    Platform.OS === 'web' ? (isMobile ? 48 : 40) : isMobile ? 48 : 44;
  const inputPadH = isMobile ? 14 : 12;
  const inputPadV =
    Platform.OS === 'web' ? (isMobile ? 11 : 9) : isMobile ? 12 : 10;

  return StyleSheet.create({
    wrap: {
      marginBottom: comfortable ? 16 : dense ? 8 : isMobile ? 16 : 14,
    },
    label: comfortable
      ? {
          fontSize: isMobile ? 15 : 13,
          lineHeight: isMobile ? 21 : 18,
          fontWeight: '500',
          color: theme.text,
          marginBottom: isMobile ? 8 : 6,
        }
      : isMobile
        ? { ...text.fieldLabelMobile }
        : text.fieldLabel,
    req: {
      color: SIGNUP_ERROR_COLOR,
    },
    inputShell: pulseInputShellStyle({
      backgroundColor: theme.bg,
      borderColor: theme.border,
      borderRadius: PULSE_SIGNUP_RADIUS.input,
      minHeight: inputMinHeight,
      multiline: false,
    }),
    inputShellError: pulseInputShellErrorStyle,
    inputShellMultiline: {
      alignItems: 'flex-start',
      minHeight: undefined,
    },
    input: {
      ...pulseInputTextStyle(inputTypography, {
        minHeight: inputMinHeight,
        hasTrailing: false,
      }),
      paddingHorizontal: inputPadH,
      paddingVertical: inputPadV,
    },
    inputMultiline: pulseInputTextStyle(inputTypography, { multiline: true }),
    inputWithTrailing: pulseInputTextStyle(inputTypography, {
      minHeight: inputMinHeight,
      hasTrailing: true,
    }),
    trailingWrap: pulseInputTrailingHitSlop(),
    error: {
      ...(isMobile ? text.errorMobile : text.error),
      marginTop: 6,
    },
    hint: {
      ...(isMobile ? text.hintMobile : text.hint),
      marginTop: 6,
    },
  });
}
