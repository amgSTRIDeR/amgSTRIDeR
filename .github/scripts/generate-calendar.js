import fs from 'fs-extra'
import axios from 'axios'

const username = process.env.USERNAME
const token = process.env.GH_TOKEN

if (!username || !token) process.exit(1)

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json'
}

const graphqlHeaders = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
}

const githubLanguageColors = {
  JavaScript: '#ffd700',
  TypeScript: '#0057b8',
  HTML: '#e34c26',
  CSS: '#563d7c',
  PHP: '#4F5D95',
  Shell: '#89e051',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d'
}

async function getRepos() {
  const res = await axios.get(
    `https://api.github.com/users/${username}/repos?per_page=100`,
    { headers }
  )
  return res.data
}

async function getLanguages(url) {
  const res = await axios.get(url, { headers })
  return res.data
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

  let svg = ''
  weeks.forEach((week, wIndex) => {
    week.contributionDays.forEach((day, dIndex) => {
      const x = wIndex * (cell + gap)
      const y = dIndex * (cell + gap)
      svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${getColor(day.contributionCount)}" />`
    })
  })

  return {
    svg,
    width: weeks.length * (cell + gap),
    height: 7 * (cell + gap)
  }
}

function generateLanguageBars(languages, offsetY) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0)

  const sorted = Object.entries(languages)
    .map(([name, value]) => ({
      name,
      percent: (value / total) * 100
    }))
    .sort((a, b) => b.percent - a.percent)

  const width = 800
  const barHeight = 20
  const gap = 8

  let svg = ''

  sorted.slice(0, 6).forEach((lang, i) => {
    const y = offsetY + i * (barHeight + gap)
    const barWidth = (lang.percent / 100) * width
    const color = githubLanguageColors[lang.name] || '#30363d'

    svg += `
      <rect x="0" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${color}" />
      <text x="10" y="${y + 14}" font-family="Arial" font-size="13" fill="#ffffff">
        ${lang.name} ${lang.percent.toFixed(1)}%
      </text>
    `
  })

  return {
    svg,
    height: offsetY + sorted.slice(0, 6).length * (barHeight + gap)
  }
}

async function main() {
  const weeks = await getContributions()
  const repos = await getRepos()

  let languageTotals = {}

  for (const repo of repos) {
    if (repo.fork) continue
    const langs = await getLanguages(repo.languages_url)
    for (const [name, value] of Object.entries(langs)) {
      languageTotals[name] = (languageTotals[name] || 0) + value
    }
  }

  const calendar = generateCalendarSvg(weeks)
  const languages = generateLanguageBars(languageTotals, calendar.height + 30)

  const totalHeight = languages.height + 20
  const totalWidth = Math.max(calendar.width, 800)

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${totalWidth}"
         height="${totalHeight}"
         viewBox="0 0 ${totalWidth} ${totalHeight}">
      ${calendar.svg}
      ${languages.svg}
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