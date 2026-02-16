import fs from 'fs-extra';
import axios from 'axios';
import * as d3 from 'd3';
import { D3Node } from 'd3-node';
import moment from 'moment';

const username = process.env.USERNAME;
const token = process.env.GH_TOKEN;
const headers = { Authorization: `token ${token}` };

const LANG_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Go: '#00ADD8',
  Rust: '#dea584',
  Shell: '#89e051',
  default: '#cccccc'
};

async function getRepos() {
  const res = await axios.get('https://api.github.com/user/repos?per_page=100', { headers });
  return res.data.filter(repo => !repo.fork);
}

async function getCommits(repo) {
  const since = moment().subtract(1, 'year').toISOString();
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${username}/${repo.name}/commits?author=${username}&since=${since}&per_page=100`,
      { headers }
    );
    return res.data;
  } catch {
    return [];
  }
}

function generateSVG(commitsMap, languageCount) {
  const d3n = new D3Node();
  const weekWidth = 15;
  const dayHeight = 15;
  const weeks = 53;
  const days = 7;
  const svgHeight = days * dayHeight + 50;
  const svgWidth = weeks * weekWidth + 20;
  const svg = d3n.createSVG(svgWidth, svgHeight);

  const dates = [];
  for (let i = 0; i <= 365; i++) {
    const day = moment().subtract(365 - i, 'days');
    dates.push(day);
  }

  const maxCommits = Math.max(...Object.values(commitsMap), 1);
  const colorScale = d3.scaleLinear()
    .domain([0, maxCommits])
    .range(['#ebedf0', '#196127']);

  dates.forEach(date => {
    const week = Math.floor((date.dayOfYear() + date.isoWeekday()) / 7);
    const dayOfWeek = date.day();
    const count = commitsMap[date.format('YYYY-MM-DD')] || 0;

    svg.append('rect')
      .attr('x', week * weekWidth + 10)
      .attr('y', dayOfWeek * dayHeight + 10)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', colorScale(count))
      .attr('rx', 3)
      .attr('ry', 3)
      .append('title')
      .text(`${count} commit(s) on ${date.format('YYYY-MM-DD')}`);
  });

  let xOffset = 10;
  const yOffset = days * dayHeight + 25;
  const totalLangs = Object.values(languageCount).reduce((a, b) => a + b, 0);
  Object.entries(languageCount).forEach(([lang, count]) => {
    const width = (count / totalLangs) * (weeks * weekWidth);
    svg.append('rect')
      .attr('x', xOffset)
      .attr('y', yOffset)
      .attr('width', width)
      .attr('height', 12)
      .attr('fill', LANG_COLORS[lang] || LANG_COLORS.default)
      .append('title')
      .text(`${lang}: ${count} repo(s)`);
    xOffset += width;
  });

  return d3n.svgString();
}

async function main() {
  const repos = await getRepos();
  const commitsMap = {};
  const languageCount = {};

  for (const repo of repos) {
    if (repo.language) {
      languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
    }

    const commits = await getCommits(repo);
    commits.forEach(c => {
      const date = moment(c.commit.author.date).format('YYYY-MM-DD');
      commitsMap[date] = (commitsMap[date] || 0) + 1;
    });
  }

  const svgString = generateSVG(commitsMap, languageCount);

  const statsBlock = `
<!-- stats start -->
**Repositories:** ${repos.length}  |  **Languages:** ${Object.keys(languageCount).join(', ')}  

![GitHub-style Calendar + Languages](data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')})
<!-- stats end -->
`;

  const readmePath = 'README.md';
  let readme = await fs.readFile(readmePath, 'utf-8');
  if (readme.includes('<!-- stats start -->')) {
    readme = readme.replace(/<!-- stats start -->[\s\S]*<!-- stats end -->/, statsBlock);
  } else {
    readme += `\n\n${statsBlock}`;
  }

  await fs.writeFile(readmePath, readme);
  console.log('README updated with GitHub-style calendar and language bars!');
}

await main();