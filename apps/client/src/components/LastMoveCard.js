import React from 'react';
import { View, Text, Platform } from 'react-native';
import { colors, ui, mono } from '../theme';

export default function LastMoveCard({ move, color, compact = false }) {
  return <View testID="last-move-card" style={{
    padding: compact ? 18 : 24, borderRadius: 20, borderWidth: 1, borderColor: '#dfbb7b40',
    backgroundColor: '#342f26cc', gap: compact ? 10 : 20,
    ...(Platform.OS === 'web' ? { boxShadow: '0 12px 32px #0004', backdropFilter: 'blur(14px)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 7 }, shadowRadius: 12, shadowOpacity: 0.2, elevation: 5 }),
  }}>
    <View style={[ui.row, { justifyContent: 'space-between' }]}>
      <Text style={[ui.label, { color: colors.accent }]}>NƯỚC ĐI CUỐI</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{move ? (move.color === color ? 'BẠN' : 'ĐỐI THỦ') : 'CHỜ KHAI CUỘC'}</Text>
    </View>
    {move ? <View accessibilityLiveRegion="polite" accessibilityLabel={`Nước đi cuối: ${move.from} đến ${move.to}${move.promotion ? ', phong cấp ' + move.promotion : ''}`} style={[ui.row, { justifyContent: 'space-between' }]}>
      <Text style={{ color: colors.text, fontSize: compact ? 30 : 38, fontFamily: mono, fontWeight: '600' }}>{move.from}</Text>
      <Text style={{ color: colors.accent, fontSize: 29 }}>→</Text>
      <Text style={{ color: colors.accent, fontSize: compact ? 30 : 38, fontFamily: mono, fontWeight: '600' }}>{move.to}</Text>
      {move.promotion && <Text style={{ color: colors.accent, fontFamily: mono }}>={move.promotion.toUpperCase()}</Text>}
    </View> : <Text style={[ui.text, { color: colors.muted }]}>Nước đầu tiên đang chờ bạn.</Text>}
    {!compact && <Text style={[ui.muted, { fontSize: 12, lineHeight: 19 }]}>Ghi nhớ thay đổi này trong thế cờ của bạn.</Text>}
  </View>;
}
