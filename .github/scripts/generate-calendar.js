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
  JavaScript: '#FFE844',
  TypeScript: '#3B7FB5',
  HTML: '#FF5B5B',
  CSS: '#4FD47F',
  SCSS: '#D464E8',
  PHP: '#FF9500',
  Shell: '#5BA8E8',
  Python: '#2FB8E8',
  Go: '#FFB348',
  Rust: '#FF6B42',
  Java: '#4BD4D4',
  C: '#A8A8A8',
  'C++': '#E85B7F',
  Ruby: '#7FD47F',
  Swift: '#FF8C42',
  Kotlin: '#A875D4',
  Dart: '#5FA8FF',
  Vue: '#FF5B9F',
  Svelte: '#4FD4A0',
  Scala: '#E8B548',
  Lua: '#5B8FE8',
  Perl: '#FF6B7F',
  R: '#7FD499',
  'Objective-C': '#9D7FFF',
  CoffeeScript: '#FFD17F',
  Elixir: '#FF5B5B',
  Haskell: '#3FD4C4'
}

const trackedTechnologies = [
  { name: 'Angular', color: '#FF5B7F', packages: ['@angular/core'] },
  { name: 'React', color: '#4FD47F', packages: ['react'] },
  { name: 'Vue', color: '#FFB348', packages: ['vue'] },
  { name: 'Next.js', color: '#111111', packages: ['next'] },
  { name: 'Nuxt', color: '#5BA8E8', packages: ['nuxt'] },
  { name: 'NestJS', color: '#FF6B42', packages: ['@nestjs/core'] },
  { name: 'Express', color: '#8B8B8B', packages: ['express'] },
  { name: 'Fastify', color: '#FFD480', packages: ['fastify'] },
  { name: 'RxJS', color: '#7FD499', packages: ['rxjs'] },
  { name: 'NgRx', color: '#E8556B', packages: ['@ngrx/store'] },
  { name: 'Webpack', color: '#5FA8FF', packages: ['webpack'] },
  { name: 'Vite', color: '#FF8C5A', packages: ['vite'] },
  { name: 'Rollup', color: '#4FD4A0', packages: ['rollup'] },
  { name: 'Babel', color: '#FFE844', packages: ['@babel/core'] },
  { name: 'SCSS', color: '#D464E8', packages: ['sass', 'node-sass'] },
  { name: 'TypeScript', color: '#3B7FB5', packages: ['typescript'] },
  { name: 'GraphQL', color: '#FF5B5B', packages: ['graphql', '@apollo/client', '@apollo/server'] },
  { name: 'Prisma', color: '#7FD4C4', packages: ['prisma', '@prisma/client'] },
  { name: 'PostgreSQL', color: '#FF9D5C', packages: ['pg', 'postgres', 'typeorm', 'sequelize', 'knex'] },
  { name: 'MongoDB', color: '#4BD4A0', packages: ['mongodb', 'mongoose'] },
  { name: 'Redis', color: '#E85B5B', packages: ['redis', 'ioredis'] },
  { name: 'AWS', color: '#FFB840', packages: ['aws-sdk', '@aws-sdk/client-s3', '@aws-sdk/client-dynamodb', '@aws-sdk/client-lambda'] },
  { name: 'Docker', color: '#5FA8FF', packages: ['dockerode'] },
  { name: 'Kubernetes', color: '#FFD17F', packages: ['@kubernetes/client-node'] },
  { name: 'Deno', color: '#4FD4A0', packages: ['@deno/shim-deno'] },
  { name: 'Jest', color: '#E8556B', packages: ['jest'] },
  { name: 'Playwright', color: '#7FD480', packages: ['playwright', '@playwright/test'] },
  { name: 'Cypress', color: '#FFB348', packages: ['cypress'] },
  { name: 'Jasmine', color: '#5BA8E8', packages: ['jasmine-core', 'jasmine'] },
  { name: 'Karma', color: '#FF6B7F', packages: ['karma'] },
  { name: 'ESLint', color: '#7FD4A0', packages: ['eslint'] },
  { name: 'Prettier', color: '#FF8C5A', packages: ['prettier'] }
]

async function getRepos() {
  let allRepos = []
  let page = 1
  let hasMore = true

  while (hasMore && page <= 3) {
    const res = await axios.get(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`,
      { headers }
    )
    allRepos = allRepos.concat(res.data)
    hasMore = res.data.length === 100
    page += 1
  }

  return allRepos
}

async function getLanguages(url) {
  const res = await axios.get(url, { headers })
  return res.data
}

async function getRepoPackageJson(repo) {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${repo.full_name}/contents/package.json`,
      { headers }
    )

    const base64Content = res.data?.content
    if (!base64Content) return null

    const decoded = Buffer.from(base64Content, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch (error) {
    if (error?.response?.status === 404) return null
    return null
  }
}

function getDependencySet(packageJson) {
  const sections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
  ]

  const deps = new Set()

  sections.forEach((section) => {
    const sectionDeps = packageJson?.[section]
    if (!sectionDeps || typeof sectionDeps !== 'object') return
    Object.keys(sectionDeps).forEach(depName => deps.add(depName))
  })

  return deps
}

function collectTechnologyUsage(techCounts, dependencySet) {
  trackedTechnologies.forEach((tech) => {
    const isUsed = tech.packages.some(packageName => dependencySet.has(packageName))
    if (isUsed) {
      techCounts[tech.name] = (techCounts[tech.name] || 0) + 1
    }
  })
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
  
  // Custom intervals: 1,2,3,4,5,6-10,11-15,16-20,21-30,31+
  const thresholds = [1,2,3,4,5,10,15,20,30];
  let ySteps = [];
  for (let i = 0; i < thresholds.length - 1; i++) {
    ySteps.push(thresholds[i]);
  }
  // Add last interval as maxContributions if больше 30
  if (maxContributions > 30) {
    ySteps.push(maxContributions);
  } else {
    ySteps.push(30);
  }
  const N = ySteps.length;

  let points = '';
  let areaPoints = `${startX},${startY + graphHeight} `;
  displayDays.forEach((count, i) => {
    const x = startX + i * stepX;
    // Find the interval index for the point
    let idx = 0;
    for (let t = 0; t < N; t++) {
      if (count >= ySteps[t]) idx = t;
      else break;
    }
    const y = startY + graphHeight - (idx / (N - 1)) * graphHeight;
    points += `${x},${y} `;
    areaPoints += `${x},${y} `;
  });
  areaPoints += `${startX + (displayDays.length - 1) * stepX},${startY + graphHeight}`;
  
  let gridLines = ''
  for (let i = 0; i <= 7; i++) {
    const y = startY + (graphHeight / 7) * i
    gridLines += `<line x1="${startX}" y1="${y}" x2="${startX + graphWidth}" y2="${y}" stroke="#30363d" stroke-width="1" opacity="0.3" />`
  }
  
  for (let i = 0; i < displayDays.length; i += 5) {
    const x = startX + i * stepX
    gridLines += `<line x1="${x}" y1="${startY}" x2="${x}" y2="${startY + graphHeight}" stroke="#30363d" stroke-width="1" opacity="0.2" />`
  }
  
  // Custom intervals: 1,2,3,4,5,6-10,11-15,16-20,21-30,31+
  let yLabels = '';
  ySteps.forEach((value, idx) => {
    // Equal spacing for Y axis
    const y = startY + graphHeight - (idx / (N - 1)) * graphHeight;
    let label = value;
    if (idx === 5) label = '6–10';
    else if (idx === 6) label = '11–15';
    else if (idx === 7) label = '16–20';
    else if (idx === 8) label = '21–30';
    else if (idx === 9) label = (maxContributions > 30 ? `${ySteps[N-2]+1}+` : '30');
    yLabels += `<text x="${startX - 10}" y="${y + 4}" text-anchor="end" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#c9d1d9">${label}</text>`;
  });
  
  let xLabels = ''
  const labelIndices = [0, Math.floor(displayDays.length / 2), displayDays.length - 1]
  labelIndices.forEach(i => {
    const x = startX + i * stepX
    const dayLabel = i === 0 ? displayDays.length : i === displayDays.length - 1 ? 1 : Math.floor(displayDays.length / 2)
    xLabels += `<text x="${x}" y="${startY + graphHeight + 20}" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#c9d1d9">${dayLabel}</text>`
  })
  

  let circles = '';
  displayDays.forEach((count, i) => {
    const x = startX + i * stepX;
    // Find the interval index
    let idx = 0;
    for (let t = 0; t < N; t++) {
      if (count >= ySteps[t]) idx = t;
      else break;
    }
    const y = startY + graphHeight - (idx / (N - 1)) * graphHeight;
    let fill = '#30363d', r = 2.5, opacity = 0.5, stroke = 'none', strokeWidth = 0;
    if (count > 0) {
      // Color by interval
      if (idx === 0) fill = '#39d353'; // 1
      else if (idx === 1) fill = '#28a745'; // 2
      else if (idx === 2) fill = '#2188ff'; // 3
      else if (idx === 3) fill = '#b392f0'; // 4
      else if (idx === 4) fill = '#ff7b72'; // 5
      else if (idx === 5) fill = '#ffb347'; // 6-10
      else if (idx === 6) fill = '#ff69b4'; // 11-15
      else if (idx === 7) fill = '#00bfff'; // 16-20
      else if (idx === 8) fill = '#8a2be2'; // 21-30
      else fill = '#d2691e'; // 31+
      r = 3.5; opacity = 1; stroke = '#0d1117'; strokeWidth = 2;
    }
    circles += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;
  });
  
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

  const technologyNameSet = new Set(
    trackedTechnologies.map((tech) => tech.name.toLowerCase())
  )

  if (!total) {
    return {
      svg: `<text x="${offsetX}" y="${offsetY + 14}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#8b949e">No language data available</text>`,
      height: 32
    }
  }

  const sorted = Object.entries(languages)
    .map(([name, value]) => ({
      name,
      percent: (value / total) * 100
    }))
    .filter((lang) => !technologyNameSet.has(lang.name.toLowerCase()) && lang.name !== 'Dockerfile')
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 10)

  if (!sorted.length) {
    return {
      svg: `<text x="${offsetX}" y="${offsetY + 14}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#8b949e">All top languages are represented in Technology Stack</text>`,
      height: 32
    }
  }

  const rowHeight = 38
  const barHeight = 30
  const startX = offsetX + 10
  const startY = offsetY + 8
  const maxPercent = sorted[0]?.percent || 1
  const maxBarWidth = Math.min(maxWidth - 120, 720)
  const minBarWidth = Math.max(220, Math.min(maxBarWidth - 80, 280))

  let svg = ''

  sorted.forEach((lang, index) => {
    const y = startY + index * rowHeight
    const color = githubLanguageColors[lang.name] || '#30363d'
    const ratio = lang.percent / maxPercent
    const barWidth = minBarWidth + (maxBarWidth - minBarWidth) * ratio
    const x1 = startX
    const x2 = startX + barWidth
    const topY = y
    const bottomY = y + barHeight
    const midY = y + barHeight / 2
    const cornerRadius = 4

    // Create smooth rounded rectangle bar
    const pathD = `
      M ${x1},${topY + cornerRadius}
      Q ${x1},${topY} ${x1 + cornerRadius},${topY}
      L ${x2 - cornerRadius},${topY}
      Q ${x2},${topY} ${x2},${topY + cornerRadius}
      L ${x2},${bottomY - cornerRadius}
      Q ${x2},${bottomY} ${x2 - cornerRadius},${bottomY}
      L ${x1 + cornerRadius},${bottomY}
      Q ${x1},${bottomY} ${x1},${bottomY - cornerRadius}
      Z
    `;
    const gradId = `langGrad${index}`;

    svg += `
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:0" />
          <stop offset="50%" style="stop-color:#FFFFFF;stop-opacity:0.25" />
          <stop offset="100%" style="stop-color:#FFFFFF;stop-opacity:0" />
        </linearGradient>
      </defs>
      <path d="${pathD}" fill="${color}" />
      <path d="${pathD}" fill="url(#${gradId})" />
      <text x="${startX + 16}" y="${y + 21}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#FFFFFF" filter="url(#textSoftShadow)" font-weight="700" letter-spacing="0.5">
        ${lang.name.toUpperCase()}
      </text>
      <text x="${x2 + 14}" y="${y + 21}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#FFFFFF" filter="url(#textSoftShadow)" font-weight="500">
        ${lang.percent.toFixed(1)}%
      </text>
    `;
  })
  
  return {
    svg,
    height: sorted.length * rowHeight + 12
  }
}

function generateTechnologyStackSvg(techCounts, analyzedReposCount) {
  const cardWidth = 900
  const sorted = trackedTechnologies
    .map((tech) => ({
      ...tech,
      count: techCounts[tech.name] || 0
    }))
    .filter(tech => tech.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  if (!analyzedReposCount || !sorted.length) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="140" viewBox="0 0 ${cardWidth} 140" role="img" aria-labelledby="title desc">
        <title id="title">Technology Stack</title>
        <desc id="desc">Technology stack based on package dependencies.</desc>
        <rect width="100%" height="100%" fill="#0d1117" rx="14" />
        <rect x="1" y="1" width="${cardWidth - 2}" height="138" fill="none" stroke="#30363d" rx="14" />
        <text x="30" y="50" fill="#c9d1d9" font-size="28" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="700">Technology Stack</text>
        <text x="30" y="88" fill="#8b949e" font-size="15" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">No dependency data available</text>
      </svg>
    `
  }

  const rowHeight = 38
  const barHeight = 30
  const startX = 30
  const startY = 86
  const maxCount = sorted[0]?.count || 1
  const maxBarWidth = 690
  const minBarWidth = 240
  const height = Math.max(170, startY + sorted.length * rowHeight + 18)

  let bars = ''

  sorted.forEach((tech, index) => {
    const y = startY + index * rowHeight
    const color = tech.color || '#30363d'
    const ratio = tech.count / maxCount
    const barWidth = minBarWidth + (maxBarWidth - minBarWidth) * ratio
    const x1 = startX
    const x2 = startX + barWidth
    const topY = y
    const bottomY = y + barHeight
    const midY = y + barHeight / 2
    const cornerRadius = 4

    // Create smooth rounded rectangle bar
    const pathD = `
      M ${x1},${topY + cornerRadius}
      Q ${x1},${topY} ${x1 + cornerRadius},${topY}
      L ${x2 - cornerRadius},${topY}
      Q ${x2},${topY} ${x2},${topY + cornerRadius}
      L ${x2},${bottomY - cornerRadius}
      Q ${x2},${bottomY} ${x2 - cornerRadius},${bottomY}
      L ${x1 + cornerRadius},${bottomY}
      Q ${x1},${bottomY} ${x1},${bottomY - cornerRadius}
      Z
    `

    // Gradient ID for inner glow effect
    const gradId = `techGrad${index}`

    bars += `
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:0" />
          <stop offset="50%" style="stop-color:#FFFFFF;stop-opacity:0.25" />
          <stop offset="100%" style="stop-color:#FFFFFF;stop-opacity:0" />
        </linearGradient>
      </defs>
      <path d="${pathD}" fill="${color}" />
      <path d="${pathD}" fill="url(#${gradId})" />
      <text x="${startX + 16}" y="${y + 21}" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="13" fill="#FFFFFF" filter="url(#textSoftShadow)" font-weight="700" letter-spacing="0.4">
        ${tech.name.toUpperCase()}
      </text>
      <text x="${x2 + 14}" y="${y + 21}" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="13" fill="#FFFFFF" filter="url(#textSoftShadow)" font-weight="600">
        ${tech.count} repos · ${((tech.count / analyzedReposCount) * 100).toFixed(1)}%
      </text>
    `
  })

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${height}" viewBox="0 0 ${cardWidth} ${height}" role="img" aria-labelledby="title desc">
      <title id="title">Technology Stack</title>
      <desc id="desc">Technology stack based on package dependencies.</desc>

      <defs>
        <filter id="textSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#000000" flood-opacity="0.6" />
        </filter>
      </defs>

      <rect width="100%" height="100%" fill="#0d1117" rx="14" />
      <rect x="1" y="1" width="${cardWidth - 2}" height="${height - 2}" fill="none" stroke="#30363d" rx="14" />

      <text x="30" y="48" fill="#c9d1d9" font-size="28" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="700">Technology Stack</text>
      <text x="30" y="72" fill="#8b949e" font-size="14" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif">Calculated from package.json dependencies in ${analyzedReposCount} repositories</text>

      ${bars}
    </svg>
  `
}

async function main() {
  const weeks = await getContributions()
  const repos = await getRepos()

  let languageTotals = {}
  let dependencyTechTotals = {}
  let analyzedDependencyRepos = 0

  for (const repo of repos) {
    if (repo.fork) continue

    const langs = await getLanguages(repo.languages_url)
    for (const [name, value] of Object.entries(langs)) {
      languageTotals[name] = (languageTotals[name] || 0) + value
    }

    const packageJson = await getRepoPackageJson(repo)
    if (packageJson) {
      analyzedDependencyRepos += 1
      const dependencySet = getDependencySet(packageJson)
      collectTechnologyUsage(dependencyTechTotals, dependencySet)
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
        <filter id="textSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#000000" flood-opacity="0.6" />
        </filter>
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
        Language Stack
      </text>

      ${languages.svg}
    </svg>
  `

  await fs.writeFile('docs/stats.svg', svgContent)
  const technologyStackSvg = generateTechnologyStackSvg(
    dependencyTechTotals,
    analyzedDependencyRepos
  )
  await fs.writeFile('docs/thumbnails/technology-stack.svg', technologyStackSvg)

  const readme = await fs.readFile('README.md', 'utf-8')

  const withStats = readme.replace(
    /<!-- stats start -->[\s\S]*?<!-- stats end -->/,
    `<!-- stats start -->
  ![GitHub Stats](docs/stats.svg)

![Technology Stack](docs/thumbnails/technology-stack.svg)
<!-- stats end -->`
  )

  await fs.writeFile('README.md', withStats)
}

main()