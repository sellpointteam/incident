// Date entry guard for incident / KIA forms.
// Returns true if the date should be accepted, false if user cancels.
// Shows a window.confirm when:
//   - date is in the future
//   - date is more than 4 days older than today

export function todayLocalISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function confirmDateChange(nextValue: string): boolean {
  if (!nextValue || !/^\d{4}-\d{2}-\d{2}$/.test(nextValue)) return true;
  const [y, m, d] = nextValue.split("-").map((n) => parseInt(n, 10));
  // Ignore unrealistic years — native <input type="date"> fires onChange
  // mid-typing ("0002-06-20", "0020-06-20" …) and would otherwise spam confirms.
  const currentYear = new Date().getFullYear();
  if (y < 2024 || y > currentYear + 5) return true;
  const entered = new Date(y, m - 1, d);
  entered.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((entered.getTime() - today.getTime()) / 86_400_000);
  if (diffDays > 0) {
    return window.confirm(
      `The date you entered (${nextValue}) is ${diffDays} day(s) in the future. Are you sure?`
    );
  }
  if (diffDays < -4) {
    return window.confirm(
      `The date you entered (${nextValue}) is ${Math.abs(diffDays)} days old. Are you sure?`
    );
  }
  return true;
}
