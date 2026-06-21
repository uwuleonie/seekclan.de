import { NextResponse } from 'next/server'
import net from 'net'

const SERVER_HOST = '148.251.181.111'
const SERVER_PORT = 25565

// Implementiert das Minecraft "Server List Ping" Protokoll (Handshake + Status-Request),
// um Online-Spielerzahl und Max-Spielerzahl live vom eigenen Server abzufragen.
function pingMinecraftServer(host: string, port: number, timeoutMs = 3000): Promise<{ online: number; max: number }> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let buffer = Buffer.alloc(0)

    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('Timeout'))
    }, timeoutMs)

    function writeVarInt(value: number): Buffer {
      const bytes: number[] = []
      while (true) {
        let temp = value & 0b01111111
        value >>>= 7
        if (value !== 0) temp |= 0b10000000
        bytes.push(temp)
        if (value === 0) break
      }
      return Buffer.from(bytes)
    }

    function writeString(str: string): Buffer {
      const strBuf = Buffer.from(str, 'utf8')
      return Buffer.concat([writeVarInt(strBuf.length), strBuf])
    }

    function readVarInt(buf: Buffer, offset: number): { value: number; length: number } {
      let value = 0, length = 0, currentByte: number
      do {
        currentByte = buf[offset + length]
        value |= (currentByte & 0b01111111) << (7 * length)
        length++
      } while ((currentByte & 0b10000000) !== 0)
      return { value, length }
    }

    socket.connect(port, host, () => {
      // Handshake-Paket
      const hostBuf = writeString(host)
      const handshakeData = Buffer.concat([
        writeVarInt(0x00), // Packet ID
        writeVarInt(763),  // Protokoll-Version (für die Status-Anfrage irrelevant, Wert egal)
        hostBuf,
        Buffer.from([port >> 8, port & 0xff]),
        writeVarInt(1), // Next state: status
      ])
      const handshake = Buffer.concat([writeVarInt(handshakeData.length), handshakeData])

      // Status-Request-Paket (leer)
      const statusRequest = Buffer.concat([writeVarInt(1), writeVarInt(0x00)])

      socket.write(handshake)
      socket.write(statusRequest)
    })

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data])
      try {
        let offset = 0
        const packetLength = readVarInt(buffer, offset)
        offset += packetLength.length
        const packetId = readVarInt(buffer, offset)
        offset += packetId.length
        const jsonLength = readVarInt(buffer, offset)
        offset += jsonLength.length

        if (buffer.length < offset + jsonLength.value) return // noch nicht alles da

        const jsonStr = buffer.slice(offset, offset + jsonLength.value).toString('utf8')
        const parsed = JSON.parse(jsonStr)

        clearTimeout(timeout)
        socket.destroy()
        resolve({
          online: parsed.players?.online ?? 0,
          max: parsed.players?.max ?? 0,
        })
      } catch {
        // Paket noch nicht komplett angekommen, auf weitere Daten warten
      }
    })

    socket.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

export async function GET() {
  try {
    const status = await pingMinecraftServer(SERVER_HOST, SERVER_PORT)
    return NextResponse.json({ online: true, players: status.online, maxPlayers: status.max })
  } catch {
    return NextResponse.json({ online: false, players: 0, maxPlayers: 0 })
  }
}