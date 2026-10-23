export function formatTime(d: Date): string {
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function timeAgo(from: Date, now: number = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - from.getTime()) / 1000));
  if (sec < 60) return "剛剛";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return `${Math.floor(hr / 24)} 天前`;
}
