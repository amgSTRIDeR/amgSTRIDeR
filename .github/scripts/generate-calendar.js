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

function generateCalendar(weeks, offsetX, offsetY) {
  const cell = 12
  const gap = 3

  let svg = ''
  weeks.forEach((week, wIndex) => {
    week.contributionDays.forEach((day, dIndex) => {
      const x = offsetX + wIndex * (cell + gap)
      const y = offsetY + dIndex * (cell + gap)
      svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${getColor(day.contributionCount)}" />`
    })
  })

  return {
    svg,
    width: weeks.length * (cell + gap),
    height: 7 * (cell + gap)
  }
}

function generateLanguages(languages, offsetX, offsetY, maxWidth) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0)

  const sorted = Object.entries(languages)
    .map(([name, value]) => ({
      name,
      percent: (value / total) * 100
    }))
    .sort((a, b) => b.percent - a.percent)

  const barHeight = 18
  const gap = 10

  let svg = ''

  sorted.slice(0, 6).forEach((lang, i) => {
    const y = offsetY + i * (barHeight + gap)
    const barWidth = (lang.percent / 100) * maxWidth
    const color = githubLanguageColors[lang.name] || '#30363d'

    svg += `
      <rect x="${offsetX}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${color}" />
      <text x="${offsetX + 8}" y="${y + 13}" font-family="Segoe UI, Arial" font-size="12" fill="#ffffff">
        ${lang.name} ${lang.percent.toFixed(1)}%
      </text>
    `
  })

  return {
    svg,
    height: sorted.slice(0, 6).length * (barHeight + gap)
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

  const padding = 30
  const cardWidth = 900

  const calendar = generateCalendar(weeks, padding, 80)
  const languages = generateLanguages(
    languageTotals,
    padding,
    80 + calendar.height + 50,
    cardWidth - padding * 2
  )

  const totalHeight =
    80 + calendar.height + 50 + languages.height + 40

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${cardWidth}"
         height="${totalHeight}"
         viewBox="0 0 ${cardWidth} ${totalHeight}">
      
      <rect width="100%" height="100%" fill="#0d1117" />
      <rect x="10" y="10" width="${cardWidth - 20}" height="${totalHeight - 20}"
            rx="12" fill="#0d1117" stroke="#30363d" />

      <text x="${padding}" y="45"
            font-family="Segoe UI, Arial"
            font-size="22"
            fill="#c9d1d9">
        ${username}'s GitHub Activity
      </text>

      <text x="${padding}" y="70"
            font-family="Segoe UI, Arial"
            font-size="14"
            fill="#8b949e">
        Contribution Calendar
      </text>

      ${calendar.svg}

      <text x="${padding}" y="${80 + calendar.height + 25}"
            font-family="Segoe UI, Arial"
            font-size="14"
            fill="#8b949e">
        Top Languages
      </text>

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