import fs from 'fs-extra'
import axios from 'axios'

const username = process.env.LEETCODE_USERNAME || 'amgSTRIDeR'

const leetcodeQuery = `
  query userProblemsSolved($username: String!) {
    allQuestionsCount {
      difficulty
      count
    }
    matchedUser(username: $username) {
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
  }
`

function getCountByDifficulty(items, difficulty) {
  return items.find(item => item.difficulty === difficulty)?.count || 0
}

function createShieldsBadge({ label, value, color, logo }) {
  const encodedLabel = encodeURIComponent(label)
  const encodedValue = encodeURIComponent(value)
  const logoPart = logo ? `&logo=${encodeURIComponent(logo)}` : ''

  return `https://img.shields.io/badge/${encodedLabel}-${encodedValue}-${color}?style=for-the-badge${logoPart}`
}

async function fetchLeetCodeStats() {
  const response = await axios.post(
    'https://leetcode.com/graphql/',
    {
      operationName: 'userProblemsSolved',
      query: leetcodeQuery,
      variables: { username }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Referer: `https://leetcode.com/${username}/`,
        Origin: 'https://leetcode.com'
      },
      timeout: 20000
    }
  )

  const data = response.data?.data
  const totalByDifficulty = data?.allQuestionsCount || []
  const solvedByDifficulty =
    data?.matchedUser?.submitStatsGlobal?.acSubmissionNum || []

  if (!totalByDifficulty.length || !solvedByDifficulty.length) {
    throw new Error('LeetCode API returned incomplete stats data')
  }

  return {
    total: {
      solved: getCountByDifficulty(solvedByDifficulty, 'All'),
      available: getCountByDifficulty(totalByDifficulty, 'All')
    },
    easy: {
      solved: getCountByDifficulty(solvedByDifficulty, 'Easy'),
      available: getCountByDifficulty(totalByDifficulty, 'Easy')
    },
    medium: {
      solved: getCountByDifficulty(solvedByDifficulty, 'Medium'),
      available: getCountByDifficulty(totalByDifficulty, 'Medium')
    },
    hard: {
      solved: getCountByDifficulty(solvedByDifficulty, 'Hard'),
      available: getCountByDifficulty(totalByDifficulty, 'Hard')
    }
  }
}

function buildLeetCodeBlock(stats) {
  const profileUrl = `https://leetcode.com/${username}`

  const totalBadge = createShieldsBadge({
    label: 'LeetCode',
    value: `${stats.total.solved}/${stats.total.available} Solved`,
    color: 'FFB81C',
    logo: 'leetcode'
  })

  const easyBadge = createShieldsBadge({
    label: 'Easy',
    value: `${stats.easy.solved}/${stats.easy.available}`,
    color: '00AF9B'
  })

  const mediumBadge = createShieldsBadge({
    label: 'Medium',
    value: `${stats.medium.solved}/${stats.medium.available}`,
    color: 'FFB800'
  })

  const hardBadge = createShieldsBadge({
    label: 'Hard',
    value: `${stats.hard.solved}/${stats.hard.available}`,
    color: 'FF375F'
  })

  return `<!-- leetcode start -->
[![LeetCode](${totalBadge})](${profileUrl})
[![Easy](${easyBadge})](${profileUrl}) [![Medium](${mediumBadge})](${profileUrl}) [![Hard](${hardBadge})](${profileUrl})
<!-- leetcode end -->`
}

async function updateReadme() {
  const stats = await fetchLeetCodeStats()
  const readme = await fs.readFile('README.md', 'utf-8')
  const leetcodeBlock = buildLeetCodeBlock(stats)

  const markerRegex = /<!-- leetcode start -->[\s\S]*?<!-- leetcode end -->/
  const singleBadgeRegex = /\[!\[LeetCode\]\([^\)]*\)\]\(https:\/\/leetcode\.com\/[A-Za-z0-9_-]+\)/

  let updated = readme
  if (markerRegex.test(readme)) {
    updated = readme.replace(markerRegex, leetcodeBlock)
  } else if (singleBadgeRegex.test(readme)) {
    updated = readme.replace(singleBadgeRegex, leetcodeBlock)
  } else {
    updated = `${readme.trimEnd()}\n\n${leetcodeBlock}\n`
  }

  await fs.writeFile('README.md', updated)
}

updateReadme().catch(error => {
  console.error('Failed to update LeetCode stats:', error.message)
  process.exit(1)
})