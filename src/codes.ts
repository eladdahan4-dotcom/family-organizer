// Family codes: whoever has the code can open that family's board.

/** Generates an unguessable 20-character code (no look-alike letters such as O/0, I/1). */
export function newFamilyCode(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 20; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export function normalizeCode(s: string) {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function prettyCode(s: string) {
  return s.replace(/(.{5})(?=.)/g, "$1-");
}
