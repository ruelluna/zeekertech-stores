import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_STORE_HOURS } from '@wfh/shared';

// Placeholder until the staff screens are built in Phase 4–6 (PLAN.md §15).
export default function App() {
  const today = DEFAULT_STORE_HOURS[new Date().getDay()];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekend Food Hub · Staff</Text>
      <Text>
        Today: {today?.opensAt} – {today?.closesAt}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
});
