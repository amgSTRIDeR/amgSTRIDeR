import fs from 'fs-extra'
import axios from 'axios'
import * as d3 from 'd3'

const username = process.env.USERNAME
const token = process.env.GH_TOKEN

if (!username || !token) process.exit(1)

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json'
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

function generateLanguageBars(languages) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0)

  const sorted = Object.entries(languages)
    .map(([name, value]) => ({
      name,
      percent: (value / total) * 100
    }))
    .sort((a, b) => b.percent - a.percent)

  const width = 700
  const barHeight = 24
  const gap = 10
  const startY = 30

  const colorScale = d3.scaleOrdinal(d3.schemeTableau10)

  let svg = `
    <text x="0" y="20" font-family="Arial" font-size="18" fill="#000">
      Top Languages by Usage
    </text>
  `

  sorted.forEach((lang, i) => {
    const y = startY + i * (barHeight + gap)
    const barWidth = (lang.percent / 100) * width
    const color = colorScale(lang.name)

    svg += `
      <rect x="0" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="6" />
      <text x="10" y="${y + 16}" font-family="Arial" font-size="14" fill="#ffffff">
        ${lang.name} ${lang.percent.toFixed(1)}%
      </text>
    `
  })

  return { svg, height: startY + sorted.length * (barHeight + gap) }
}

async function main() {
  const repos = await getRepos()

  let languageTotals = {}

  for (const repo of repos) {
    if (repo.fork) continue
    const langs = await getLanguages(repo.languages_url)
    for (const [name, value] of Object.entries(langs)) {
      languageTotals[name] = (languageTotals[name] || 0) + value
    }
  }

  const { svg: languageSvg, height } = generateLanguageBars(languageTotals)

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}">
      ${languageSvg}
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