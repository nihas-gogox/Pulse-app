import { Platform, type TextInputProps } from 'react-native';

export type SignUpPasswordFieldRole = 'new' | 'confirm';

/**
 * Autofill props for sign-up password fields.
 * On iOS, `secureTextEntry` + default password autofill shows a "Strong Password"
 * cover view that blocks manual typing in React Native — use `oneTimeCode` to disable it.
 */
export function signUpPasswordInputProps(
  role: SignUpPasswordFieldRole = 'new',
): Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'spellCheck'
  | 'textContentType'
  | 'autoComplete'
  | 'importantForAutofill'
  | 'keyboardType'
> {
  if (Platform.OS === 'ios') {
    return {
      autoCapitalize: 'none',
      autoCorrect: false,
      spellCheck: false,
      textContentType: 'oneTimeCode',
      autoComplete: 'off',
      keyboardType: 'default',
    };
  }
  if (Platform.OS === 'android') {
    return {
      autoCapitalize: 'none',
      autoCorrect: false,
      textContentType: 'password',
      autoComplete: 'password-new',
      importantForAutofill: 'no',
    };
  }
  // On iOS Safari, 'new-password' triggers the strong-password sheet which dismisses
  // the keyboard on the confirm field. Use 'off' for confirm to prevent that.
  return {
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: role === 'confirm' ? 'off' : 'new-password',
  };
}
