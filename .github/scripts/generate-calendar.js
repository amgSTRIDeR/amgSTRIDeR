const fs = require('fs-extra');
const axios = require('axios');
const d3 = require('d3');
const D3Node = require('d3-node').default || require('d3-node');
const moment = require('moment');

const username = process.env.USERNAME;
const token = process.env.GH_TOKEN;
const headers = { Authorization: `token ${token}` };

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

(async () => {
  const repos = await getRepos();
  let languageCount = {};
  const commitsMap = {};


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

  const d3n = new D3Node();
  const svgWidth = 53 * 15 + 20;
  const svgHeight = 7 * 15 + 20;
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
    const week = date.isoWeek() - moment().subtract(1, 'year').isoWeek();
    const dayOfWeek = date.day();

    const count = commitsMap[date.format('YYYY-MM-DD')] || 0;
    svg.append('rect')
      .attr('x', week * 15 + 10)
      .attr('y', dayOfWeek * 15 + 10)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', colorScale(count))
      .attr('rx', 3)
      .attr('ry', 3)
      .append('title')
      .text(`${count} commit(s) on ${date.format('YYYY-MM-DD')}`);
  });

  const svgString = d3n.svgString();

  const statsBlock = `
<!-- stats start -->
**Repositories:** ${repos.length}  |  **Languages:** ${Object.keys(languageCount).join(', ')}  

![GitHub-style Calendar](data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')})
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
  console.log('README updated with GitHub-style calendar!');
})();