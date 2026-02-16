import fs from 'fs-extra'
import axios from 'axios'
import * as d3 from 'd3'

const username = process.env.USERNAME
const token = process.env.GH_TOKEN

if (!username || !token) process.exit(1)

const graphqlHeaders = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
}

async function getContributions() {
  const query = {
    query: `
      query {
        user(login: "${username}") {
          contributionsCollection {
            contributionCalendar {
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `
  }

  const res = await axios.post(
    'https://api.github.com/graphql',
    query,
    { headers: graphqlHeaders }
  )

  return res.data.data.user.contributionsCollection.contributionCalendar.weeks
}

function getColor(count) {
  if (count === 0) return '#161b22'
  if (count < 2) return '#0e4429'
  if (count < 5) return '#006d32'
  if (count < 10) return '#26a641'
  return '#39d353'
}

function generateCalendarSvg(weeks) {
  const cell = 12
  const gap = 3
  const width = weeks.length * (cell + gap)
  const height = 7 * (cell + gap)

  let svg = ''

  weeks.forEach((week, wIndex) => {
    week.contributionDays.forEach((day, dIndex) => {
      const x = wIndex * (cell + gap)
      const y = dIndex * (cell + gap)
      const color = getColor(day.contributionCount)

      svg += `
        <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${color}" />
      `
    })
  })

  return { svg, width, height }
}

async function main() {
  const weeks = await getContributions()

  const { svg: calendarSvg, width, height } =
    generateCalendarSvg(weeks)

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}"
         height="${height}"
         viewBox="0 0 ${width} ${height}">
      ${calendarSvg}
    </svg>
  `

  await fs.writeFile('stats.svg', svgContent)

  const readme = await fs.readFile('README.md', 'utf-8')

  const updated = readme.replace(
    /<!-- stats start -->[\s\S]*?<!-- stats end -->/,
    `<!-- stats start -->
![GitHub Stats](stats.svg)
<!-- stats end -->`
  )

  await fs.writeFile('README.md', updated)
}

main()