import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const thumbnailsDir = path.join(__dirname, '../../docs/thumbnails')

const BORDER_COLOR = '#e1e4e8'
const BORDER_SIZE = 2
const IMAGE_WIDTH = 570
const IMAGE_HEIGHT = 320

async function generateSvgWrappers() {
  try {
    const files = await fs.readdir(thumbnailsDir)
    const webpFiles = files.filter(file => file.endsWith('.webp'))

    console.log(`Found ${webpFiles.length} WebP files`)

    const width = IMAGE_WIDTH + BORDER_SIZE * 2
    const height = IMAGE_HEIGHT + BORDER_SIZE * 2

    for (const file of webpFiles) {
      const filePath = path.join(thumbnailsDir, file)
      const imageBuffer = await fs.readFile(filePath)
      const base64 = imageBuffer.toString('base64')
      const dataUri = `data:image/webp;base64,${base64}`

      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${BORDER_COLOR}"/>
  <image href="${dataUri}" x="${BORDER_SIZE}" y="${BORDER_SIZE}" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}"/>
</svg>`

      const svgFilename = file.replace('.webp', '.svg')
      const svgPath = path.join(thumbnailsDir, svgFilename)
      await fs.writeFile(svgPath, svgContent)

      console.log(`✓ ${svgFilename}`)
    }

    console.log('\n✓ All SVG wrappers generated successfully!')
  } catch (error) {
    console.error('Error generating SVG wrappers:', error.message)
    process.exit(1)
  }
}

generateSvgWrappers()
