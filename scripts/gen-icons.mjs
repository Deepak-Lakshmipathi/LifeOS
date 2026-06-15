import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

function makePNG(width, height, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  function crc32(buf) {
    const table = []
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
      table[i] = c
    }
    let crc = 0xffffffff
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeB = Buffer.from(type)
    const crcB = Buffer.alloc(4)
    crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0)
    return Buffer.concat([len, typeB, data, crcB])
  }

  const rawData = []
  for (let y = 0; y < height; y++) {
    rawData.push(0)
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b)
    }
  }
  const compressed = deflateSync(Buffer.from(rawData))

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public/icons', { recursive: true })

const png192 = makePNG(192, 192, 99, 102, 241)
const png512 = makePNG(512, 512, 99, 102, 241)

writeFileSync('public/icons/icon-192.png', png192)
writeFileSync('public/icons/icon-512.png', png512)
writeFileSync('public/icons/icon-maskable-512.png', png512)
console.log('Icons generated!')
