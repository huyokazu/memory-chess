import { Platform, StyleSheet, Text, TextInput, ActivityIndicator, View } from 'react-native';
import React from 'react';
import SpringPressable from './components/SpringPressable';

export const colors = {
  bg: '#191918', panel: '#252422', panelAlt: '#302D28', border: '#403B33',
  text: '#F4EFE5', muted: '#B0A99B', accent: '#DFBB7B', ink: '#2C2116',
  danger: '#F3A69B', lightSquare: '#CCB999', darkSquare: '#775437',
};
export const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
export const ui = StyleSheet.create({
  text: { color: colors.text, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 24, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10, fontSize: 16, minHeight: 50 },
});

export function Button({ children, onPress, disabled, loading, variant = 'primary', style, accessibilityLabel, testID }) {
  return <SpringPressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID}
    disabled={disabled || loading} onPress={onPress}
    style={[{
      minHeight: 48, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 10,
      flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center',
      backgroundColor: variant === 'primary' ? colors.accent : variant === 'danger' ? '#402B28' : colors.panelAlt,
      borderWidth: variant === 'primary' ? 0 : 1, borderColor: colors.border,
      opacity: disabled || loading ? 0.45 : 1,
    }, style]}>
    {loading && <ActivityIndicator size="small" color={variant === 'primary' ? colors.ink : colors.accent} />}
    <Text style={{ color: variant === 'primary' ? colors.ink : variant === 'danger' ? colors.danger : colors.text, fontWeight: '700', fontSize: 14 }}>{children}</Text>
  </SpringPressable>;
}

export function Input({ label, style, ...props }) {
  return <View style={{ gap: 8 }}>
    {label && <Text style={ui.label}>{label}</Text>}
    <TextInput accessibilityLabel={label} placeholderTextColor="#847A6D" style={[ui.input, style]} {...props} />
  </View>;
}

export function Pill({ children, active = false }) {
  return <View style={{ alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: active ? '#3A3023' : colors.panelAlt }}>
    <Text style={{ color: active ? colors.accent : colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7 }}>{children}</Text>
  </View>;
}
