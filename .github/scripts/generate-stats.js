const fs = require('fs-extra');
const axios = require('axios');
const D3Node = require('d3-node');
const d3 = require('d3');
const moment = require('moment');

const username = process.env.USERNAME;
const token = process.env.GH_TOKEN;
const headers = { Authorization: `token ${token}` };

async function getRepos() {
  const res = await axios.get('https://api.github.com/user/repos?per_page=100', { headers });
  return res.data.filter(repo => !repo.fork);
}

async function getCommits(repo) {
  const today = moment();
  const since = today.clone().subtract(30, 'days').toISOString();

  try {
    const res = await axios.get(
      `https://api.github.com/repos/${username}/${repo.name}/commits?author=${username}&since=${since}`,
      { headers }
    );
    return res.data;
  } catch {
    return [];
  }
}

function generateSVG(commitsPerDay) {
  const d3n = new D3Node();
  const width = 720;
  const height = 70;
  const svg = d3n.createSVG(width, height);

  const maxCommits = Math.max(...commitsPerDay, 1);
  const scale = d3.scaleLinear().domain([0, maxCommits]).range([0, 50]);

  commitsPerDay.forEach((c, i) => {
    svg.append('rect')
      .attr('x', i * 22)
      .attr('y', 50 - scale(c))
      .attr('width', 18)
      .attr('height', scale(c))
      .attr('fill', '#4caf50')
      .attr('rx', 3)
      .attr('ry', 3);
  });

  return d3n.svgString();
}

(async () => {
  const repos = await getRepos();
  let totalCommits = 0;
  const languageCount = {};
  const commitsPerDay = Array(30).fill(0);

  for (const repo of repos) {
    const commits = await getCommits(repo);
    totalCommits += commits.length;

    commits.forEach(c => {
      const dayDiff = moment().diff(moment(c.commit.author.date), 'days');
      if (dayDiff >= 0 && dayDiff < 30) {
        commitsPerDay[29 - dayDiff] += 1;
      }
    });

    if (repo.language) {
      languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
    }
  }

  const svgGraph = generateSVG(commitsPerDay);

  const statsBlock = `
<!-- stats start -->
**Repositories:** ${repos.length}  |  **Commits (last 30 days):** ${totalCommits}  
**Languages:** ${Object.keys(languageCount).join(', ')}  

![Commits graph](data:image/svg+xml;base64,${Buffer.from(svgGraph).toString('base64')})
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
  console.log('README updated with real stats!');
})();