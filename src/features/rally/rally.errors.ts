const KNOWN_ERRORS: ReadonlyArray<readonly [string, string]> = [
  ['result already recorded', 'Hasil untuk tim ini sudah tercatat.'],
  ['round is not active', 'Ronde ini belum atau tidak lagi aktif.'],
  ['staff post mismatch', 'Akun staf ini hanya boleh mengisi pos yang ditugaskan.'],
  ['online position', 'Pos online dinilai otomatis oleh sistem.'],
  ['event is not running', 'Acara belum berjalan.'],
  ['not enough money', 'Saldo tidak cukup.'],
  ['max level', 'Toko sudah di level maksimum.'],
  ['not allowed', 'Akun ini tidak punya izin untuk tindakan tersebut.'],
  ['not assigned', 'Tim tidak bertugas di pos ini pada ronde ini.'],
  ['solo positions accept', 'Pos solo hanya menerima Level 1, 2, atau 3.'],
  ['not a duel position', 'Pos ini bukan pos duel.'],
]

export function describeRpcError(message: string | null | undefined): string {
  const text = (message ?? '').toLowerCase()
  const match = KNOWN_ERRORS.find(([needle]) => text.includes(needle))
  return match ? match[1] : 'Gagal menyimpan. Periksa koneksi lalu coba lagi.'
}
