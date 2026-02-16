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
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  HTML: '#e34c26',
  CSS: '#563d7c',
  PHP: '#4F5D95',
  Shell: '#89e051',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Vue: '#41b883',
  Svelte: '#FF3E00',
  Scala: '#c22d40',
  Lua: '#000080',
  Perl: '#0298c3',
  R: '#198CE7',
  'Objective-C': '#438eff',
  CoffeeScript: '#244776',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086'
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

function generateContributionGraph(weeks, offsetX, offsetY, width, height) {
  const days = []
  weeks.forEach(week => {
    week.contributionDays.forEach(day => {
      days.push(day.contributionCount)
    })
  })

  const displayDays = days.slice(-35)
  const maxContributions = Math.max(...displayDays, 1)
  
  const graphWidth = width - 100
  const graphHeight = height - 60
  const startX = offsetX + 50
  const startY = offsetY + 30
  
  const stepX = graphWidth / (displayDays.length - 1)
  
  let points = ''
  let areaPoints = `${startX},${startY + graphHeight} `
  
  displayDays.forEach((count, i) => {
    const x = startX + i * stepX
    const y = startY + graphHeight - (count / maxContributions) * graphHeight
    points += `${x},${y} `
    areaPoints += `${x},${y} `
  })
  
  areaPoints += `${startX + (displayDays.length - 1) * stepX},${startY + graphHeight}`
  
  let gridLines = ''
  for (let i = 0; i <= 7; i++) {
    const y = startY + (graphHeight / 7) * i
    gridLines += `<line x1="${startX}" y1="${y}" x2="${startX + graphWidth}" y2="${y}" stroke="#30363d" stroke-width="1" opacity="0.3" />`
  }
  
  for (let i = 0; i < displayDays.length; i += 5) {
    const x = startX + i * stepX
    gridLines += `<line x1="${x}" y1="${startY}" x2="${x}" y2="${startY + graphHeight}" stroke="#30363d" stroke-width="1" opacity="0.2" />`
  }
  
  let yLabels = ''
  for (let i = 0; i <= 7; i++) {
    const y = startY + (graphHeight / 7) * (7 - i)
    const value = Math.round((maxContributions / 7) * i)
    yLabels += `<text x="${startX - 10}" y="${y + 4}" text-anchor="end" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#c9d1d9">${value}</text>`
  }
  
  let xLabels = ''
  const labelIndices = [0, Math.floor(displayDays.length / 2), displayDays.length - 1]
  labelIndices.forEach(i => {
    const x = startX + i * stepX
    const dayLabel = i === 0 ? displayDays.length : i === displayDays.length - 1 ? 1 : Math.floor(displayDays.length / 2)
    xLabels += `<text x="${x}" y="${startY + graphHeight + 20}" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#c9d1d9">${dayLabel}</text>`
  })
  

  let circles = ''
  displayDays.forEach((count, i) => {
    const x = startX + i * stepX
    const y = startY + graphHeight - (count / maxContributions) * graphHeight
    if (count > 0) {
      circles += `<circle cx="${x}" cy="${y}" r="3.5" fill="#39d353" stroke="#0d1117" stroke-width="2" />`
    } else {
      circles += `<circle cx="${x}" cy="${y}" r="2.5" fill="#30363d" opacity="0.5" />`
    }
  })
  
  let svg = `
    ${gridLines}
    <polyline points="${areaPoints}" fill="url(#areaGradient)" opacity="0.4" />
    <polyline points="${points}" fill="none" stroke="#39d353" stroke-width="2.5" stroke-linejoin="round" />
    ${circles}
    ${yLabels}
    ${xLabels}
    <text x="${startX + graphWidth / 2}" y="${startY + graphHeight + 45}" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#c9d1d9">Days</text>
    <text x="${startX - 35}" y="${startY + graphHeight / 2}" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#c9d1d9" transform="rotate(-90 ${startX - 35} ${startY + graphHeight / 2})">Contributions</text>
  `
  
  return {
    svg,
    width,
    height
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
      <text x="${offsetX + 8}" y="${y + 13}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#c9d1d9" font-weight="600">
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
  const graphHeight = 280

  const graph = generateContributionGraph(weeks, padding, 80, cardWidth - padding * 2, graphHeight)
  const languages = generateLanguages(
    languageTotals,
    padding,
    80 + graph.height + 50,
    cardWidth - padding * 2
  )

  const totalHeight =
    80 + graph.height + 50 + languages.height + 40

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${cardWidth}"
         height="${totalHeight}"
         viewBox="0 0 ${cardWidth} ${totalHeight}">
      
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#39d353;stop-opacity:0.6" />
          <stop offset="100%" style="stop-color:#39d353;stop-opacity:0.05" />
        </linearGradient>
      </defs>
      
      <rect width="100%" height="100%" fill="#0d1117" />
      <rect x="10" y="10" width="${cardWidth - 20}" height="${totalHeight - 20}"
            rx="12" fill="#0d1117" stroke="#30363d" />

      <text x="${padding}" y="45"
            font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="22"
            fill="#c9d1d9">
        ${username}'s Contribution Graph
      </text>

      <text x="${padding}" y="70"
            font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="14"
            fill="#c9d1d9">
        Last 35 Days Activity
      </text>

      ${graph.svg}

      <text x="${padding}" y="${80 + graph.height + 25}"
            font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="14"
            fill="#c9d1d9">
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