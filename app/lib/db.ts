import { Pool, types } from 'pg'

// pg gibt bigint-Spalten (Postgres-OID 20) standardmäßig als JavaScript-String
// zurück, nicht als Number — das soll Genauigkeitsverluste bei extrem großen
// Zahlen verhindern. In der Praxis führt das aber zu einem gefährlichen, leicht
// übersehenen Bug: Code wie "acc + row.spalte" macht dann Text-Verkettung statt
// Addition (z.B. "324636" + "257763" → "324636257763" statt 582399).
//
// Da unsere bigint-Spalten (z.B. blocks_broken, blocks_placed) niemals Werte
// erreichen, die den sicheren JavaScript-Number-Bereich (±2^53) überschreiten,
// parsen wir sie hier global als normale Number — das verhindert diesen
// Fehler dauerhaft, statt ihn an jeder einzelnen Stelle im Code per parseInt()
// einzeln nachträglich zu patchen.
types.setTypeParser(20, (val) => parseInt(val, 10))

// Zentrale Datenbank-Verbindung für den eigenen Postgres-Server
// (ersetzt die vorherige Supabase-JS-Bibliothek aus app/lib/supabase.ts).
//
// WICHTIG: Dieser Pool wird zwischen einzelnen Serverless-Function-Aufrufen
// auf Vercel wiederverwendet, solange die Funktion "warm" ist. Das hält die
// Anzahl gleichzeitig offener Verbindungen zum Server niedrig.
//
// Erwartete Umgebungsvariable: DATABASE_URL
// Format: postgresql://seekclan_app:PASSWORT@148.251.181.111:4336/seekclan
// WICHTIG: Kein "?sslmode=..." an die URL anhängen — das kann mit der ssl-Option
// unten in Konflikt geraten. SSL wird ausschließlich über die ssl-Option gesteuert.

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ist nicht gesetzt. Bitte in den Vercel-Umgebungsvariablen eintragen.')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Wir nutzen das Standard-Ubuntu-Snake-Oil-Zertifikat (selbstsigniert).
    // Die Verbindung ist trotzdem verschlüsselt; wir verzichten nur auf die
    // Prüfung der Zertifikats-Kette, da wir kein "echtes" CA-Zertifikat haben.
    rejectUnauthorized: false,
  },
  max: 10, // maximale Anzahl gleichzeitiger Verbindungen pro Funktions-Instanz
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  console.error('Unerwarteter Fehler im Postgres-Pool:', err)
})